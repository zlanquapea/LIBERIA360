import { analyzeTrip, costBreakdown, DEFAULT_SPEED_KMH, ROAD_FACTOR } from './trip-checks';
import type { ItineraryStopDetail, Place } from './types';

function place(id: string, lat: number, lng: number, overrides: Partial<Place> = {}): Place {
  return {
    id,
    name: id,
    latitude: lat,
    longitude: lng,
    recommendedVisitLength: null,
    estimatedCostEntry: 5,
    openingHours: 'Daily 9-17',
    structuredHours: null,
    ...overrides,
  } as Place;
}
const stop = (day: number, order: number, p: Place): ItineraryStopDetail => ({ day, order, notes: null, place: p });

describe('analyzeTrip', () => {
  it('estimates legs from straight-line distance, road factor and speed', () => {
    const a = place('a', 6.3, -10.8);
    const b = place('b', 6.3, -10.5); // ~33 km apart
    const { days } = analyzeTrip([stop(1, 0, a), stop(1, 1, b)], { durationDays: 1, transportMode: null, pace: null });
    const leg = days[0].legs[0];
    expect(leg.km).toBeGreaterThan(33 * ROAD_FACTOR - 2);
    expect(leg.hours).toBeCloseTo(leg.km / DEFAULT_SPEED_KMH, 1);
    expect(days[0].visitHours).toBe(3); // 2 × default 1.5 h
  });

  it('follows the stop order within a day', () => {
    const a = place('a', 6.3, -10.8);
    const b = place('b', 6.3, -10.5);
    const { days } = analyzeTrip([stop(1, 1, a), stop(1, 0, b)], { durationDays: 1, transportMode: 'taxi', pace: null });
    expect(days[0].legs[0]).toEqual(expect.objectContaining({ fromTitle: 'b', toTitle: 'a' }));
  });

  it('flags a day that is too full for the chosen pace, and long drives', () => {
    const a = place('a', 6.3, -10.8, { recommendedVisitLength: 'day_trip' });
    const far = place('far', 7.5, -8.5, { recommendedVisitLength: 'day_trip' }); // ~290 km
    const { warnings, days } = analyzeTrip([stop(1, 0, a), stop(1, 1, far)], {
      durationDays: 2,
      transportMode: 'public_transport',
      pace: 'relaxed',
    });
    expect(days[0].overLimit).toBe(true);
    expect(warnings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ kind: 'day_too_full', day: 1, limit: 6 }),
        expect.objectContaining({ kind: 'long_leg', day: 1, from: 'a', to: 'far' }),
        { kind: 'empty_day', day: 2 },
      ]),
    );
  });

  it('flags missing hours and prices, and events outside the trip dates', () => {
    const bare = place('bare', 6.3, -10.8, { openingHours: null, estimatedCostEntry: null });
    const event = {
      day: 1,
      order: 1,
      notes: null,
      event: { name: 'Festival', startDate: '2026-12-20T10:00:00Z', endDate: null, place: null, latitude: null, longitude: null, ticketPrice: null, ticketTypes: [] },
    } as unknown as ItineraryStopDetail;
    const { warnings } = analyzeTrip([stop(1, 0, bare), event], {
      durationDays: 1,
      transportMode: null,
      pace: null,
      startDate: '2026-10-10T00:00:00Z',
      endDate: '2026-10-10T00:00:00Z',
    });
    expect(warnings).toEqual(
      expect.arrayContaining([
        { kind: 'missing_hours', title: 'bare' },
        { kind: 'missing_price', title: 'bare' },
        { kind: 'event_outside_dates', title: 'Festival' },
      ]),
    );
  });
});

describe('costBreakdown', () => {
  it('sums listed prices and lists unpriced stops instead of counting them as free', () => {
    const result = costBreakdown([
      stop(1, 0, place('paid', 0, 0, { estimatedCostEntry: 10 })),
      stop(1, 1, place('free', 0, 0, { estimatedCostEntry: 0 })),
      stop(1, 2, place('unknown', 0, 0, { estimatedCostEntry: null })),
    ]);
    expect(result).toEqual({ known: 10, unpriced: ['unknown'] });
  });
});
