/** Calendar links for an event: Google Calendar, and an .ics file that
 * Apple Calendar and Outlook open. Events without an end time are given
 * three hours. */
export interface CalendarEvent {
  id: string;
  title: string;
  start: string;
  end: string | null;
  description?: string | null;
  location?: string | null;
  url?: string;
}

const DEFAULT_LENGTH_MS = 3 * 60 * 60 * 1000;

function stamp(date: Date): string {
  return date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
}

function range(event: CalendarEvent): [Date, Date] {
  const start = new Date(event.start);
  const end = event.end ? new Date(event.end) : new Date(start.getTime() + DEFAULT_LENGTH_MS);
  return [start, end > start ? end : new Date(start.getTime() + DEFAULT_LENGTH_MS)];
}

export function googleCalendarUrl(event: CalendarEvent): string {
  const [start, end] = range(event);
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: event.title,
    dates: `${stamp(start)}/${stamp(end)}`,
  });
  const details = [event.description, event.url].filter(Boolean).join('\n\n');
  if (details) params.set('details', details);
  if (event.location) params.set('location', event.location);
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

function escapeText(text: string): string {
  return text.replace(/\\/g, '\\\\').replace(/;/g, '\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
}

/** Lines longer than 75 octets are folded, as the iCalendar spec asks. */
function fold(line: string): string {
  const out: string[] = [];
  let rest = line;
  while (rest.length > 74) {
    out.push(rest.slice(0, 74));
    rest = ` ${rest.slice(74)}`;
  }
  out.push(rest);
  return out.join('\r\n');
}

export function icsContent(event: CalendarEvent, now: Date = new Date()): string {
  const [start, end] = range(event);
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//LIBERIA360//Events//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${event.id}@liberia360`,
    `DTSTAMP:${stamp(now)}`,
    `DTSTART:${stamp(start)}`,
    `DTEND:${stamp(end)}`,
    `SUMMARY:${escapeText(event.title)}`,
  ];
  const details = [event.description, event.url].filter(Boolean).join('\n\n');
  if (details) lines.push(`DESCRIPTION:${escapeText(details)}`);
  if (event.location) lines.push(`LOCATION:${escapeText(event.location)}`);
  if (event.url) lines.push(`URL:${event.url}`);
  lines.push('END:VEVENT', 'END:VCALENDAR');
  return lines.map(fold).join('\r\n') + '\r\n';
}
