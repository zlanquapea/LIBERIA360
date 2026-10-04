import type { OpeningPeriod } from './types';


function minutes(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
}

export function formatClock(hhmm: string, locale = 'en-US'): string {
  const m = minutes(hhmm) % (24 * 60);
  const d = new Date(Date.UTC(2026, 0, 4, Math.floor(m / 60), m % 60));
  return new Intl.DateTimeFormat(locale, { hour: 'numeric', minute: '2-digit', timeZone: 'UTC' }).format(d);
}

/** Open around the clock every day of the week. */
export function isAlwaysOpen(hours: OpeningPeriod[] | null | undefined): boolean {
  if (!hours?.length) return false;
  for (let day = 0; day < 7; day++) {
    const all = hours.some((p) => p.dayOfWeek === day && minutes(p.opens) === 0 && minutes(p.closes) >= 24 * 60 - 1);
    if (!all) return false;
  }
  return true;
}

export interface DayHours {
  day: number;
  /** Ranges like [["08:00","17:00"]]; empty when closed. */
  ranges: Array<[string, string]>;
  today: boolean;
}

/** Monday-first week of opening ranges, with today flagged. */
export function weekRows(hours: OpeningPeriod[], now: Date = new Date()): DayHours[] {
  const today = now.getUTCDay();
  return [1, 2, 3, 4, 5, 6, 0].map((day) => ({
    day,
    ranges: hours
      .filter((p) => p.dayOfWeek === day)
      .sort((a, b) => minutes(a.opens) - minutes(b.opens))
      .map((p) => [p.opens, p.closes] as [string, string]),
    today: day === today,
  }));
}

export type HoursStatus =
  | { state: 'always' }
  | { state: 'open'; closesAt: string }
  | { state: 'closed'; opensAt: string; opensDay: 'today' | 'tomorrow' | number }
  | { state: 'closed-unknown' };

/** Whether it's open right now and when that changes. */
export function hoursStatus(hours: OpeningPeriod[] | null | undefined, now: Date = new Date()): HoursStatus | null {
  if (!hours?.length) return null;
  if (isAlwaysOpen(hours)) return { state: 'always' };
  const day = now.getUTCDay();
  const nowMin = now.getUTCHours() * 60 + now.getUTCMinutes();

  for (const p of hours) {
    const o = minutes(p.opens);
    const c = minutes(p.closes);
    const wraps = c <= o;
    if (p.dayOfWeek === day && nowMin >= o && (wraps || nowMin < c)) return { state: 'open', closesAt: p.closes };
    if (p.dayOfWeek === (day + 6) % 7 && wraps && nowMin < c) return { state: 'open', closesAt: p.closes };
  }

  for (let offset = 0; offset < 7; offset++) {
    const d = (day + offset) % 7;
    const next = hours
      .filter((p) => p.dayOfWeek === d && (offset > 0 || minutes(p.opens) > nowMin))
      .sort((a, b) => minutes(a.opens) - minutes(b.opens))[0];
    if (next) {
      return { state: 'closed', opensAt: next.opens, opensDay: offset === 0 ? 'today' : offset === 1 ? 'tomorrow' : d };
    }
  }
  return { state: 'closed-unknown' };
}

