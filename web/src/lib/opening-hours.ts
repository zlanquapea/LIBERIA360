import type { OpeningPeriod } from './types';

// Mirrors api/src/places/opening-hours.ts's isOpenAt exactly (same
// day-index convention, same midnight-wrap handling). Liberia Standard
// Time is UTC+0 year-round with no DST, so evaluating against the
// visitor's own browser clock via the UTC getters gives the correct
// Liberia local time regardless of which timezone the visitor's device
// is set to — no timezone conversion needed.
function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
}

export function isOpenAt(hours: OpeningPeriod[] | null | undefined, at: Date): boolean {
  if (!hours || hours.length === 0) return false;
  const day = at.getUTCDay();
  const prevDay = (day + 6) % 7;
  const minutesNow = at.getUTCHours() * 60 + at.getUTCMinutes();

  for (const period of hours) {
    const opensMin = toMinutes(period.opens);
    const closesMin = toMinutes(period.closes);
    const wrapsPastMidnight = closesMin <= opensMin;

    if (period.dayOfWeek === day) {
      if (!wrapsPastMidnight) {
        if (minutesNow >= opensMin && minutesNow < closesMin) return true;
      } else if (minutesNow >= opensMin) {
        return true;
      }
    }
    if (period.dayOfWeek === prevDay && wrapsPastMidnight && minutesNow < closesMin) {
      return true;
    }
  }
  return false;
}

// Default daily hours offered to anyone entering opening/closing time for a
// place or claimed business for the first time (product decision, Aug 2026:
// "set default starting 7AM and close 9pm"). 24-hour "HH:mm" strings, the
// same shape <input type="time"> produces/consumes.
export const DEFAULT_OPEN_TIME = '07:00';
export const DEFAULT_CLOSE_TIME = '21:00';

function to12Hour(hhmm: string): string {
  const [h, m] = hhmm.split(':').map(Number);
  const period = h >= 12 ? 'PM' : 'AM';
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  return `${hour12}:${String(m).padStart(2, '0')} ${period}`;
}

// Formats a daily (all 7 days, same hours) open/close pair into the free-text
// shape api/src/places/opening-hours.ts's parseOpeningHoursText expects, so a
// picker-generated value still drives the "open now" badge server-side.
// IMPORTANT: parseOpeningHoursText's SEGMENT_RE requires a literal ASCII
// hyphen between the two times — do not swap this for an en dash or any
// other separator.
export function formatDailyHours(open24: string, close24: string): string {
  return `Daily ${to12Hour(open24)} - ${to12Hour(close24)}`;
}

const DAILY_HOURS_RE =
  /^daily\s+(\d{1,2}):(\d{2})\s*(am|pm)\s*-\s*(\d{1,2}):(\d{2})\s*(am|pm)$/i;

function to24Hour(hour12: string, minute: string, period: string): string {
  let h = Number(hour12) % 12;
  if (period.toLowerCase() === 'pm') h += 12;
  return `${String(h).padStart(2, '0')}:${minute}`;
}

// Best-effort reverse of formatDailyHours, for pre-filling the picker when
// editing a business/place that already has an opening-hours string. Only
// recognizes exactly the shape formatDailyHours produces — anything else
// (hand-typed legacy text, multi-day hours like "Mon-Fri 9am-5pm") falls
// back to the defaults rather than guessing at a partial parse.
export function parseDailyHours(text: string | null | undefined): {
  open: string;
  close: string;
} {
  const match = text?.trim().match(DAILY_HOURS_RE);
  if (!match) return { open: DEFAULT_OPEN_TIME, close: DEFAULT_CLOSE_TIME };
  const [, oh, om, op, ch, cm, cp] = match;
  return { open: to24Hour(oh, om, op), close: to24Hour(ch, cm, cp) };
}
