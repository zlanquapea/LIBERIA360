import { googleCalendarUrl, icsContent } from './calendar';

const event = {
  id: 'e1',
  title: 'Beach Jam, Live',
  start: '2026-10-17T19:00:00.000Z',
  end: null,
  description: 'Music; food\nand dancing',
  location: 'ELWA Beach, Monrovia',
  url: 'https://liberia360.com/events/e1',
};

describe('calendar links', () => {
  it('builds a Google Calendar link with a 3-hour default length', () => {
    const url = new URL(googleCalendarUrl(event));
    expect(url.searchParams.get('text')).toBe('Beach Jam, Live');
    expect(url.searchParams.get('dates')).toBe('20261017T190000Z/20261017T220000Z');
    expect(url.searchParams.get('location')).toBe('ELWA Beach, Monrovia');
  });

  it('writes a valid, escaped .ics file', () => {
    const ics = icsContent({ ...event, end: '2026-10-17T23:30:00.000Z' }, new Date('2026-10-01T00:00:00Z'));
    expect(ics).toContain('BEGIN:VEVENT\r\n');
    expect(ics).toContain('DTSTART:20261017T190000Z');
    expect(ics).toContain('DTEND:20261017T233000Z');
    expect(ics).toContain('SUMMARY:Beach Jam\\, Live');
    expect(ics).toContain('Music\; food\\nand dancing');
    expect(ics.split('\r\n').every((line) => line.length <= 75)).toBe(true);
  });
});
