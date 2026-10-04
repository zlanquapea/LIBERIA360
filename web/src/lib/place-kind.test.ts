import { KIND_CAPS, placeKind } from './place-kind';
import { hoursStatus, isAlwaysOpen, weekRows } from './weekly-hours';
import type { OpeningPeriod } from './types';

const cat = (slug: string, name = slug) => ({ type: 'attraction' as const, category: { slug, name } });

describe('placeKind', () => {
  it('reads health, services, stays, food, shops and destinations from the category', () => {
    expect(placeKind(cat('health-pharmacies', 'Health & Pharmacies'))).toBe('health');
    expect(placeKind(cat('hospitals-clinics', 'Hospitals & Clinics'))).toBe('health');
    expect(placeKind(cat('banks-atms', 'Banks & ATMs'))).toBe('service');
    expect(placeKind(cat('fuel-stations'))).toBe('service');
    expect(placeKind(cat('salons-barbers', 'Salons/Barbers Shops'))).toBe('service');
    expect(placeKind(cat('hotels-lodges'))).toBe('stay');
    expect(placeKind(cat('food-dining'))).toBe('eat');
    expect(placeKind(cat('nightlife'))).toBe('eat');
    expect(placeKind(cat('city-shopping', 'City & Shopping'))).toBe('shop');
    expect(placeKind(cat('waterfalls-nature'))).toBe('destination');
    expect(placeKind(cat('islands-boat-trips'))).toBe('destination');
  });

  it('lets the place type, a claimed business or a pharmacy decide', () => {
    expect(placeKind({ type: 'hotel', category: { slug: 'other', name: 'Other' } })).toBe('stay');
    // The category outranks a claimed business's own type.
    expect(placeKind({ type: 'restaurant', category: { slug: 'food-dining', name: 'Food & Dining' } }, { type: 'hotel' })).toBe('eat');
    expect(placeKind(cat('other'), { type: 'bar' })).toBe('eat');
    expect(placeKind(cat('city-shopping'), null, true)).toBe('health');
  });

  it('never offers trips or visits for health and services', () => {
    for (const kind of ['health', 'service'] as const) {
      expect(KIND_CAPS[kind].trips).toBe(false);
      expect(KIND_CAPS[kind].visited).toBe(false);
    }
    expect(KIND_CAPS.destination.trips).toBe(true);
  });
});

describe('weekly hours', () => {
  const weekdays: OpeningPeriod[] = [1, 2, 3, 4, 5].map((d) => ({ dayOfWeek: d as OpeningPeriod['dayOfWeek'], opens: '08:00', closes: '17:00' }));
  const allDay: OpeningPeriod[] = [0, 1, 2, 3, 4, 5, 6].map((d) => ({ dayOfWeek: d as OpeningPeriod['dayOfWeek'], opens: '00:00', closes: '24:00' }));

  it('spots round-the-clock places', () => {
    expect(isAlwaysOpen(allDay)).toBe(true);
    expect(isAlwaysOpen(weekdays)).toBe(false);
    expect(hoursStatus(allDay)).toEqual({ state: 'always' });
  });

  it('says when it closes, or when it next opens', () => {
    // Wednesday 2026-10-07
    expect(hoursStatus(weekdays, new Date('2026-10-07T10:00:00Z'))).toEqual({ state: 'open', closesAt: '17:00' });
    expect(hoursStatus(weekdays, new Date('2026-10-07T06:00:00Z'))).toEqual({ state: 'closed', opensAt: '08:00', opensDay: 'today' });
    expect(hoursStatus(weekdays, new Date('2026-10-07T18:00:00Z'))).toEqual({ state: 'closed', opensAt: '08:00', opensDay: 'tomorrow' });
    // Saturday → Monday
    expect(hoursStatus(weekdays, new Date('2026-10-10T12:00:00Z'))).toEqual({ state: 'closed', opensAt: '08:00', opensDay: 1 });
    expect(hoursStatus(null)).toBeNull();
  });

  it('lays the week out Monday first with today marked', () => {
    const rows = weekRows(weekdays, new Date('2026-10-07T10:00:00Z'));
    expect(rows.map((r) => r.day)).toEqual([1, 2, 3, 4, 5, 6, 0]);
    expect(rows.find((r) => r.today)?.day).toBe(3);
    expect(rows[5].ranges).toEqual([]);
  });
});
