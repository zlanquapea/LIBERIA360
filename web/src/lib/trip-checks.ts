import { distanceKm, type Coordinates } from './geo';
import type { ItineraryStopDetail, RecommendedVisitLength, TransportMode, TripPace } from './types';

// Planning checks for a trip: rough travel times between stops, how full
// each day is, and what information is missing. Everything here is an
// estimate from stated assumptions (ASSUMPTIONS below), never a booking or
// a promise, and the UI shows those assumptions next to the numbers.

// Average door-to-door speed, including stops and road conditions.
export const SPEED_KMH: Record<TransportMode, number> = {
  own_car: 40,
  taxi: 35,
  public_transport: 25,
  tour_operator: 40,
  mixed: 30,
};
export const DEFAULT_SPEED_KMH = 35;
// Roads are longer than a straight line between two points.
export const ROAD_FACTOR = 1.4;
// Time at a stop when the listing gives no visit length.
export const DEFAULT_VISIT_HOURS = 1.5;
// A place's recommendedVisitLength says how long a trip it's worth from
// Monrovia, not hours on site; these are the on-site hours assumed for each.
export const VISIT_HOURS: Record<RecommendedVisitLength, number> = {
  day_trip: 3,
  overnight: 4,
  multi_day: 4,
};
export const EVENT_HOURS = 3;
// Hours of activity plus travel a day can hold before it's flagged.
export const PACE_HOURS: Record<TripPace, number> = { relaxed: 6, balanced: 9, packed: 12 };
export const DEFAULT_PACE: TripPace = 'balanced';
// A single drive longer than this gets its own warning.
export const LONG_LEG_HOURS = 4;

export interface TripLeg {
  fromTitle: string;
  toTitle: string;
  km: number;
  hours: number;
}

export interface DayPlan {
  day: number;
  stopCount: number;
  visitHours: number;
  travelHours: number;
  totalHours: number;
  limitHours: number;
  overLimit: boolean;
  legs: TripLeg[];
}

export type TripWarning =
  | { kind: 'day_too_full'; day: number; hours: number; limit: number }
  | { kind: 'long_leg'; day: number; from: string; to: string; hours: number }
  | { kind: 'empty_day'; day: number }
  | { kind: 'missing_hours'; title: string }
  | { kind: 'missing_price'; title: string }
  | { kind: 'event_outside_dates'; title: string };

export interface TripAnalysis {
  days: DayPlan[];
  warnings: TripWarning[];
  speedKmh: number;
  transportSet: boolean;
  paceSet: boolean;
}

function title(stop: ItineraryStopDetail): string {
  return stop.place?.name ?? stop.event?.name ?? stop.carListing?.title ?? '';
}

// Car rentals have no fixed location, so they don't count as a stop to
// travel to.
function coords(stop: ItineraryStopDetail): Coordinates | null {
  if (stop.place) return { lat: Number(stop.place.latitude), lng: Number(stop.place.longitude) };
  const p = stop.event?.place;
  if (p) return { lat: Number(p.latitude), lng: Number(p.longitude) };
  if (stop.event?.latitude != null && stop.event?.longitude != null) {
    return { lat: Number(stop.event.latitude), lng: Number(stop.event.longitude) };
  }
  return null;
}

function visitHours(stop: ItineraryStopDetail): number {
  if (stop.place) {
    return stop.place.recommendedVisitLength ? VISIT_HOURS[stop.place.recommendedVisitLength] : DEFAULT_VISIT_HOURS;
  }
  if (stop.event) return EVENT_HOURS;
  return 0;
}

const round1 = (n: number) => Math.round(n * 10) / 10;

export function analyzeTrip(
  stops: ItineraryStopDetail[],
  opts: {
    durationDays: number;
    transportMode: TransportMode | null;
    pace: TripPace | null;
    startDate?: string | null;
    endDate?: string | null;
  },
): TripAnalysis {
  const speed = opts.transportMode ? SPEED_KMH[opts.transportMode] : DEFAULT_SPEED_KMH;
  const limit = PACE_HOURS[opts.pace ?? DEFAULT_PACE];
  const warnings: TripWarning[] = [];
  const days: DayPlan[] = [];

  for (let day = 1; day <= opts.durationDays; day++) {
    const dayStops = stops.filter((s) => s.day === day).sort((a, b) => a.order - b.order);
    if (dayStops.length === 0) {
      if (opts.durationDays > 1) warnings.push({ kind: 'empty_day', day });
      continue;
    }
    const legs: TripLeg[] = [];
    let prev: ItineraryStopDetail | null = null;
    for (const stop of dayStops) {
      const here = coords(stop);
      const there = prev ? coords(prev) : null;
      if (prev && here && there) {
        const km = distanceKm(there, here) * ROAD_FACTOR;
        legs.push({ fromTitle: title(prev), toTitle: title(stop), km: round1(km), hours: round1(km / speed) });
      }
      if (here) prev = stop;
    }
    const visit = dayStops.reduce((sum, s) => sum + visitHours(s), 0);
    const travel = legs.reduce((sum, l) => sum + l.hours, 0);
    const total = round1(visit + travel);
    const plan: DayPlan = {
      day,
      stopCount: dayStops.length,
      visitHours: round1(visit),
      travelHours: round1(travel),
      totalHours: total,
      limitHours: limit,
      overLimit: total > limit,
      legs,
    };
    days.push(plan);
    if (plan.overLimit) warnings.push({ kind: 'day_too_full', day, hours: total, limit });
    for (const leg of legs) {
      if (leg.hours > LONG_LEG_HOURS) {
        warnings.push({ kind: 'long_leg', day, from: leg.fromTitle, to: leg.toTitle, hours: leg.hours });
      }
    }
  }

  const start = opts.startDate ? new Date(opts.startDate).getTime() : null;
  const end = opts.endDate ? new Date(opts.endDate).getTime() + 86_400_000 : null;
  for (const stop of stops) {
    if (stop.place) {
      if (!stop.place.openingHours && !(stop.place.structuredHours && stop.place.structuredHours.length > 0)) {
        warnings.push({ kind: 'missing_hours', title: stop.place.name });
      }
      if (stop.place.estimatedCostEntry == null) warnings.push({ kind: 'missing_price', title: stop.place.name });
    }
    if (stop.event && start !== null && end !== null) {
      const evStart = new Date(stop.event.startDate).getTime();
      const evEnd = new Date(stop.event.endDate ?? stop.event.startDate).getTime();
      if (evEnd < start || evStart >= end) warnings.push({ kind: 'event_outside_dates', title: stop.event.name });
    }
  }

  return { days, warnings, speedKmh: speed, transportSet: opts.transportMode !== null, paceSet: opts.pace !== null };
}

export interface CostBreakdown {
  // Sum of the prices that are listed.
  known: number;
  // Stops with no price on file, left out of `known` rather than counted
  // as free.
  unpriced: string[];
}

export function costBreakdown(stops: ItineraryStopDetail[]): CostBreakdown {
  let known = 0;
  const unpriced: string[] = [];
  for (const stop of stops) {
    if (stop.place) {
      if (stop.place.estimatedCostEntry == null) unpriced.push(stop.place.name);
      else known += Number(stop.place.estimatedCostEntry);
    } else if (stop.event) {
      if (stop.event.ticketPrice != null) known += Number(stop.event.ticketPrice);
      else if (stop.event.ticketTypes.length > 0) known += Math.min(...stop.event.ticketTypes.map((tt) => Number(tt.price)));
      else unpriced.push(stop.event.name);
    } else if (stop.carListing) {
      known += Number(stop.carListing.pricePerDay) * stop.carListing.minRentalDays;
    }
  }
  return { known: Math.round(known * 100) / 100, unpriced };
}
