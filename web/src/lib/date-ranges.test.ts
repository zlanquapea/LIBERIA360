import { getThisMonthRange, getThisWeekendRange, getTodayRange } from './date-ranges';

describe('getTodayRange', () => {
  it('spans midnight to 23:59:59.999 of the given day', () => {
    const now = new Date(2026, 2, 15, 14, 30); // Sun Mar 15 2026, 2:30pm local
    const { from, to } = getTodayRange(now);
    expect(new Date(from).getDate()).toBe(15);
    expect(new Date(from).getHours()).toBe(0);
    expect(new Date(to).getDate()).toBe(15);
    expect(new Date(to).getHours()).toBe(23);
  });
});

describe('getThisWeekendRange', () => {
  it('resolves a weekday to the coming Saturday–Sunday', () => {
    const wednesday = new Date(2026, 2, 11); // Wed Mar 11 2026
    const { from, to } = getThisWeekendRange(wednesday);
    expect(new Date(from).getDay()).toBe(6); // Saturday
    expect(new Date(from).getDate()).toBe(14);
    expect(new Date(to).getDay()).toBe(0); // Sunday
    expect(new Date(to).getDate()).toBe(15);
  });

  it('treats a Saturday as the start of the current weekend, not next week', () => {
    const saturday = new Date(2026, 2, 14, 9, 0); // Sat Mar 14 2026, 9am
    const { from, to } = getThisWeekendRange(saturday);
    expect(new Date(from).getDate()).toBe(14);
    expect(new Date(to).getDate()).toBe(15);
  });

  it('treats a Sunday as still within the current weekend, not the next one', () => {
    const sunday = new Date(2026, 2, 15, 9, 0); // Sun Mar 15 2026, 9am
    const { from, to } = getThisWeekendRange(sunday);
    expect(new Date(from).getDate()).toBe(14); // Saturday before
    expect(new Date(to).getDate()).toBe(15); // today
  });
});

describe('getThisMonthRange', () => {
  it('spans the 1st through the last day of the given month', () => {
    const midMonth = new Date(2026, 1, 10); // Feb 10 2026 (28-day month)
    const { from, to } = getThisMonthRange(midMonth);
    expect(new Date(from).getMonth()).toBe(1);
    expect(new Date(from).getDate()).toBe(1);
    expect(new Date(to).getMonth()).toBe(1);
    expect(new Date(to).getDate()).toBe(28);
  });

  it('handles a 31-day month correctly', () => {
    const midMonth = new Date(2026, 0, 5); // Jan 5 2026
    const { to } = getThisMonthRange(midMonth);
    expect(new Date(to).getDate()).toBe(31);
  });
});
