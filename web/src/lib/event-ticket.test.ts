import { eventCountdown, eventPrice, eventStub, eventTimeLabel } from './event-ticket';

describe('eventStub', () => {
  it('reads the date in Liberia time', () => {
    expect(eventStub('2026-10-17T19:00:00Z')).toEqual({ weekday: 'Sat', day: '17', month: 'Oct' });
    // 23:30 UTC is still Saturday in Monrovia, whatever the viewer's zone.
    expect(eventStub('2026-10-17T23:30:00Z').day).toBe('17');
  });
});

describe('eventTimeLabel', () => {
  it('shows a same-day range, or when a multi-day event ends', () => {
    expect(eventTimeLabel('2026-10-17T19:00:00Z', '2026-10-17T23:00:00Z')).toBe('7:00 PM – 11:00 PM');
    expect(eventTimeLabel('2026-10-17T19:00:00Z', null)).toBe('7:00 PM');
    expect(eventTimeLabel('2026-10-17T10:00:00Z', '2026-10-19T18:00:00Z')).toBe('10:00 AM · Mon, Oct 19');
  });
});

describe('eventCountdown', () => {
  const now = new Date('2026-10-14T12:00:00Z');
  it('counts calendar days', () => {
    expect(eventCountdown('2026-10-14T11:00:00Z', '2026-10-14T15:00:00Z', now)).toEqual({ kind: 'live' });
    expect(eventCountdown('2026-10-14T20:00:00Z', null, now)).toEqual({ kind: 'today' });
    expect(eventCountdown('2026-10-15T08:00:00Z', null, now)).toEqual({ kind: 'tomorrow' });
    expect(eventCountdown('2026-10-18T08:00:00Z', null, now)).toEqual({ kind: 'days', days: 4 });
    expect(eventCountdown('2026-10-30T08:00:00Z', null, now)).toBeNull();
    expect(eventCountdown('2026-10-01T08:00:00Z', '2026-10-01T10:00:00Z', now)).toBeNull();
  });
});

describe('eventPrice', () => {
  it('is free without any price, else the cheapest ticket', () => {
    expect(eventPrice({ ticketPrice: null, ticketTypes: [] })).toEqual({ free: true });
    expect(eventPrice({ ticketPrice: '0', ticketTypes: [] })).toEqual({ free: true });
    const types = [{ price: '25' }, { price: '10' }] as never;
    expect(eventPrice({ ticketPrice: null, ticketTypes: types })).toEqual({ free: false, from: 10 });
  });
});
