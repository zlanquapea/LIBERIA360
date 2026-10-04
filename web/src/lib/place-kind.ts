import type { Business, Place } from './types';

/**
 * What a place *is* to the person looking at it, which decides how its
 * page reads and what it lets you do. Categories are admin-managed and
 * grow over time, so this reads the category's slug and name (plus the
 * place type and any claimed business) rather than a fixed list.
 *
 * - destination: somewhere you go *for itself* — beaches, waterfalls,
 *   heritage, islands, hikes, wildlife, tours.
 * - stay: hotels, lodges, guesthouses, resorts.
 * - eat: restaurants, cafés, bars, nightlife.
 * - shop: markets and shops — worth a visit, so trips are allowed.
 * - health: hospitals, clinics, pharmacies, labs. Nobody plans a trip
 *   to one; people need to know if it's open, call, and get there.
 * - service: banks and ATMs, fuel, salons and barbers, transport,
 *   mechanics — errands, not outings.
 */
export type PlaceKind = 'destination' | 'stay' | 'eat' | 'shop' | 'health' | 'service';

const HEALTH = /health|hospital|clinic|pharmac|medic|dental|dentist|doctor|laborator|maternity|optic|drugstore/;
const SERVICE = /bank|atm|fuel|petrol|gas-?station|salon|barber|beauty|laundr|mechanic|garage|money|forex|exchange|telecom|police|embassy|post-office|car-?wash|transport|taxi|bus-?station|printing|tailor/;
const STAY = /hotel|lodge|guest-?house|resort|accommodation|motel|hostel|\binn\b|stay/;
const EAT = /food|dining|restaurant|cafe|café|nightlife|\bbars?\b|lounge|club|bakery|cookshop|grill|kitchen/;
const SHOP = /shop|market|mall|store|boutique|craft|supermarket/;

export function placeKind(
  place: Pick<Place, 'type'> & { category: { slug: string; name: string } },
  business?: Pick<Business, 'type'> | null,
  hasPharmacy = false,
): PlaceKind {
  const text = `${place.category.slug} ${place.category.name}`.toLowerCase();
  // The admin-set category speaks first, then the place's own type, and
  // only then a claimed business's self-declared type.
  if (hasPharmacy || HEALTH.test(text)) return 'health';
  if (SERVICE.test(text)) return 'service';
  if (STAY.test(text)) return 'stay';
  if (EAT.test(text)) return 'eat';
  if (SHOP.test(text)) return 'shop';
  if (place.type === 'hotel') return 'stay';
  if (place.type === 'restaurant') return 'eat';
  if (business?.type === 'transport') return 'service';
  if (business?.type === 'hotel' || business?.type === 'beach_resort') return 'stay';
  if (business?.type === 'restaurant' || business?.type === 'bar') return 'eat';
  if (business?.type === 'shop') return 'shop';
  return 'destination';
}

export interface PlaceKindCaps {
  /** "Add to trip" and the closing "Plan a trip" call to action. */
  trips: boolean;
  /** "Mark visited" for the Explorer passport. */
  visited: boolean;
  /** Request-to-book through a claimed business. */
  booking: boolean;
  /** Entry / guide / transport cost planning. */
  visitCosts: boolean;
  /** Creator guides and community trips that feature the place. */
  stories: boolean;
}

export const KIND_CAPS: Record<PlaceKind, PlaceKindCaps> = {
  destination: { trips: true, visited: true, booking: true, visitCosts: true, stories: true },
  stay: { trips: true, visited: true, booking: true, visitCosts: false, stories: true },
  eat: { trips: true, visited: true, booking: true, visitCosts: false, stories: true },
  shop: { trips: true, visited: true, booking: false, visitCosts: false, stories: true },
  health: { trips: false, visited: false, booking: false, visitCosts: false, stories: false },
  service: { trips: false, visited: false, booking: false, visitCosts: false, stories: false },
};

/** Which neighbours are worth showing next to a place of each kind, in
 * order: somewhere to stay and eat near a sight, things to do near a
 * hotel, other clinics near a clinic. */
export const NEARBY_KINDS: Record<PlaceKind, PlaceKind[]> = {
  destination: ['stay', 'eat'],
  stay: ['destination', 'eat'],
  eat: ['destination', 'stay'],
  shop: ['eat', 'destination'],
  health: ['health'],
  service: ['service', 'health'],
};
