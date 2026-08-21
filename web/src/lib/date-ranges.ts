// Date-range helpers behind the Events page's "Today / This weekend / This
// month" quick filters (EventFilters). Each returns dateFrom/dateTo as ISO
// strings — exactly what GET /events already accepts (EventsService.findAll
// filters on event.startDate between them), so no backend change was
// needed to support this. `now` is a parameter (defaulting to the real
// clock) purely so these are testable with a fixed date.

function startOfDay(d: Date): Date {
  const r = new Date(d);
  r.setHours(0, 0, 0, 0);
  return r;
}

function endOfDay(d: Date): Date {
  const r = new Date(d);
  r.setHours(23, 59, 59, 999);
  return r;
}

function addDays(d: Date, days: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + days);
  return r;
}

export interface DateRange {
  from: string;
  to: string;
}

export function getTodayRange(now: Date = new Date()): DateRange {
  return { from: startOfDay(now).toISOString(), to: endOfDay(now).toISOString() };
}

// "This weekend" means the coming Saturday–Sunday. If today already is the
// weekend (Saturday or Sunday), it's the one in progress rather than next
// week's — someone asking "what's on this weekend" on a Sunday afternoon
// means today, not seven days from now.
export function getThisWeekendRange(now: Date = new Date()): DateRange {
  const day = now.getDay(); // 0 = Sunday .. 6 = Saturday
  const saturday = day === 6 ? startOfDay(now) : day === 0 ? startOfDay(addDays(now, -1)) : startOfDay(addDays(now, 6 - day));
  const sunday = endOfDay(addDays(saturday, 1));
  return { from: saturday.toISOString(), to: sunday.toISOString() };
}

export function getThisMonthRange(now: Date = new Date()): DateRange {
  const from = startOfDay(new Date(now.getFullYear(), now.getMonth(), 1));
  // Day 0 of next month is the last day of this month.
  const to = endOfDay(new Date(now.getFullYear(), now.getMonth() + 1, 0));
  return { from: from.toISOString(), to: to.toISOString() };
}
