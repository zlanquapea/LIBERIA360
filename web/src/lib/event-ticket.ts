import type { Event, EventCategory } from './types';

// Liberia keeps UTC all year. Formatting in its zone (rather than the
// viewer's) gives the same stub on the server and in the browser, and the
// time people will actually turn up.
const ZONE = 'Africa/Monrovia';
const DAY_MS = 86_400_000;

function part(date: Date, options: Intl.DateTimeFormatOptions, locale: string) {
  return new Intl.DateTimeFormat(locale, { timeZone: ZONE, ...options }).format(date);
}

/** The torn-off date stub: "SAT / 14 / OCT". */
export function eventStub(startDate: string, locale = 'en-US') {
  const start = new Date(startDate);
  return {
    weekday: part(start, { weekday: 'short' }, locale),
    day: part(start, { day: 'numeric' }, locale),
    month: part(start, { month: 'short' }, locale),
  };
}

/** "7:00 PM – 11:00 PM", or "7:00 PM · until Sun 16 Oct" for a multi-day event. */
export function eventTimeLabel(startDate: string, endDate: string | null, locale = 'en-US'): string {
  const start = new Date(startDate);
  const time = (d: Date) => part(d, { hour: 'numeric', minute: '2-digit' }, locale);
  if (!endDate) return time(start);
  const end = new Date(endDate);
  const sameDay = part(start, { dateStyle: 'short' }, 'en-CA') === part(end, { dateStyle: 'short' }, 'en-CA');
  if (sameDay) return `${time(start)} – ${time(end)}`;
  return `${time(start)} · ${part(end, { weekday: 'short', day: 'numeric', month: 'short' }, locale)}`;
}

export type EventCountdown = { kind: 'live' } | { kind: 'today' } | { kind: 'tomorrow' } | { kind: 'days'; days: number } | null;

/** How soon, in calendar days: live, today, tomorrow, or "in N days" up
 * to a week out. Nothing for further away, or for past events. */
export function eventCountdown(startDate: string, endDate: string | null, now: Date = new Date()): EventCountdown {
  const start = new Date(startDate).getTime();
  const end = endDate ? new Date(endDate).getTime() : start + 6 * 60 * 60 * 1000;
  const t = now.getTime();
  if (t >= start && t <= end) return { kind: 'live' };
  if (t > end) return null;
  const days = Math.floor(start / DAY_MS) - Math.floor(t / DAY_MS);
  if (days <= 0) return { kind: 'today' };
  if (days === 1) return { kind: 'tomorrow' };
  if (days <= 6) return { kind: 'days', days };
  return null;
}

/** The cheapest way in. No ticket price or ticket types means free entry,
 * the same rule the event page uses. */
export function eventPrice(event: Pick<Event, 'ticketPrice' | 'ticketTypes'>): { free: true } | { free: false; from: number } {
  const prices = [event.ticketPrice, ...(event.ticketTypes ?? []).map((t) => t.price)]
    .map((p) => Number(p))
    .filter((p) => Number.isFinite(p) && p > 0);
  if (prices.length === 0) return { free: true };
  return { free: false, from: Math.min(...prices) };
}

/** A colour per kind of event, used on the stub and its accents. */
export const EVENT_ACCENT: Record<EventCategory, { text: string; bg: string }> = {
  concert: { text: 'text-sunset-600 dark:text-sunset-300', bg: 'bg-sunset-500' },
  festival: { text: 'text-fuchsia-600 dark:text-fuchsia-300', bg: 'bg-fuchsia-500' },
  sports: { text: 'text-sky-600 dark:text-sky-300', bg: 'bg-sky-500' },
  nightlife: { text: 'text-violet-600 dark:text-violet-300', bg: 'bg-violet-500' },
  seasonal: { text: 'text-emerald-600 dark:text-emerald-300', bg: 'bg-emerald-500' },
  other: { text: 'text-brand-700 dark:text-brand-300', bg: 'bg-brand-600' },
};
