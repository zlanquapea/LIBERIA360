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
