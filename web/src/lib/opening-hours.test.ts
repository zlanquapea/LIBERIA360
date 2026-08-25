import { DEFAULT_CLOSE_TIME, DEFAULT_OPEN_TIME, formatDailyHours, isOpenAt, parseDailyHours } from './opening-hours';
import type { OpeningPeriod } from './types';

// Mirrors api/src/places/opening-hours.spec.ts's isOpenAt cases — this is
// the same algorithm, just re-implemented client-side so a browser can
// compute "open now" without a round trip. All times below are UTC, which
// is also Liberia local time (Liberia is UTC+0 year-round, no DST).
function at(isoWithoutZone: string): Date {
  return new Date(`${isoWithoutZone}Z`);
}

const weekdayHours: OpeningPeriod[] = [
  { dayOfWeek: 1, opens: '09:00', closes: '18:00' },
  { dayOfWeek: 2, opens: '09:00', closes: '18:00' },
  { dayOfWeek: 3, opens: '09:00', closes: '18:00' },
  { dayOfWeek: 4, opens: '09:00', closes: '18:00' },
  { dayOfWeek: 5, opens: '09:00', closes: '18:00' },
];

describe('isOpenAt', () => {
  it('returns false for null/empty hours', () => {
    expect(isOpenAt(null, new Date())).toBe(false);
    expect(isOpenAt([], new Date())).toBe(false);
  });

  it('is true inside the window on a matching day', () => {
    // 2026-08-24 is a Monday
    expect(isOpenAt(weekdayHours, at('2026-08-24T12:00:00'))).toBe(true);
  });

  it('is false before opening and at/after closing', () => {
    expect(isOpenAt(weekdayHours, at('2026-08-24T08:59:00'))).toBe(false);
    expect(isOpenAt(weekdayHours, at('2026-08-24T18:00:00'))).toBe(false);
  });

  it('is false on a day not listed', () => {
    // 2026-08-22 is a Saturday
    expect(isOpenAt(weekdayHours, at('2026-08-22T12:00:00'))).toBe(false);
  });

  it('handles a period that wraps past midnight', () => {
    const nightlife: OpeningPeriod[] = [{ dayOfWeek: 5, opens: '20:00', closes: '02:00' }];
    // Still Friday, well after opening
    expect(isOpenAt(nightlife, at('2026-08-21T23:00:00'))).toBe(true);
    // Saturday 01:00 — still within Friday's overnight window
    expect(isOpenAt(nightlife, at('2026-08-22T01:00:00'))).toBe(true);
    // Saturday 03:00 — past the wrapped closing time
    expect(isOpenAt(nightlife, at('2026-08-22T03:00:00'))).toBe(false);
    // Friday 19:00 — before opening
    expect(isOpenAt(nightlife, at('2026-08-21T19:00:00'))).toBe(false);
  });

  it('treats a full 24/7 week as always open', () => {
    const allDay: OpeningPeriod[] = ([0, 1, 2, 3, 4, 5, 6] as const).map((dayOfWeek) => ({
      dayOfWeek,
      opens: '00:00',
      closes: '24:00',
    }));
    expect(isOpenAt(allDay, at('2026-08-24T03:00:00'))).toBe(true);
    expect(isOpenAt(allDay, at('2026-08-24T23:59:00'))).toBe(true);
  });
});

describe('formatDailyHours', () => {
  it('formats a 24-hour open/close pair into 12-hour "Daily" text with an ASCII hyphen', () => {
    // A literal ASCII hyphen (not an en dash) is required — see
    // api/src/places/opening-hours.ts's SEGMENT_RE, which this must stay
    // parseable by for the "open now" badge to keep working.
    expect(formatDailyHours('07:00', '21:00')).toBe('Daily 7:00 AM - 9:00 PM');
  });

  it('handles midnight and noon correctly', () => {
    expect(formatDailyHours('00:00', '12:00')).toBe('Daily 12:00 AM - 12:00 PM');
  });

  it('defaults to 7am-9pm', () => {
    expect(formatDailyHours(DEFAULT_OPEN_TIME, DEFAULT_CLOSE_TIME)).toBe('Daily 7:00 AM - 9:00 PM');
  });
});

describe('parseDailyHours', () => {
  it('round-trips a string produced by formatDailyHours', () => {
    const text = formatDailyHours('08:30', '17:15');
    expect(parseDailyHours(text)).toEqual({ open: '08:30', close: '17:15' });
  });

  it('is case-insensitive', () => {
    expect(parseDailyHours('daily 7:00 am - 9:00 pm')).toEqual({ open: '07:00', close: '21:00' });
  });

  it('falls back to the defaults for null/empty/unrecognized text', () => {
    const fallback = { open: DEFAULT_OPEN_TIME, close: DEFAULT_CLOSE_TIME };
    expect(parseDailyHours(null)).toEqual(fallback);
    expect(parseDailyHours(undefined)).toEqual(fallback);
    expect(parseDailyHours('')).toEqual(fallback);
    expect(parseDailyHours('Mon-Fri 9am-5pm')).toEqual(fallback);
    expect(parseDailyHours('e.g. Mon–Sat 8am–9pm')).toEqual(fallback);
  });
});
