// schema.org JSON-LD builders — lets Google (Search + Maps) understand and
// surface individual destination/event pages directly in results, instead
// of relying solely on in-app discovery. Free organic-acquisition channel
// that costs almost nothing to emit; every major local-discovery product
// (Google Maps listings, TripAdvisor, Yelp) does this on every page like
// this one. See https://schema.org/LocalBusiness, /TouristAttraction,
// /Event.

import type { Business, BusinessType, Category, County, Creator, Event, Place, PlaceType } from './types';
import { absoluteUrl } from './site';

// schema.org doesn't have a dedicated "tour operator" type — LocalBusiness
// is the closest honest fit for that one.
const SCHEMA_TYPE_BY_PLACE_TYPE: Record<PlaceType, string> = {
  hotel: 'LodgingBusiness',
  restaurant: 'Restaurant',
  attraction: 'TouristAttraction',
  nature_site: 'TouristAttraction',
  activity_provider: 'LocalBusiness',
};

/** Drops undefined-valued keys so JSON.stringify doesn't emit them —
 * schema.org validators are picky about explicit nulls/empties. */
function compact<T extends Record<string, unknown>>(obj: T): T {
  return Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined)) as T;
}

export function placeJsonLd(place: Place) {
  return compact({
    '@context': 'https://schema.org',
    '@type': SCHEMA_TYPE_BY_PLACE_TYPE[place.type],
    name: place.name,
    description: place.description || undefined,
    image: place.images.length > 0 ? place.images : undefined,
    url: absoluteUrl(`/places/${place.slug}`),
    telephone: place.contactPhone || undefined,
    address: compact({
      '@type': 'PostalAddress',
      addressLocality: place.city,
      addressRegion: `${place.county.name} County`,
      addressCountry: 'LR',
    }),
    geo: {
      '@type': 'GeoCoordinates',
      latitude: place.latitude,
      longitude: place.longitude,
    },
    aggregateRating:
      place.reviewCount > 0
        ? {
            '@type': 'AggregateRating',
            ratingValue: place.rating,
            reviewCount: place.reviewCount,
          }
        : undefined,
    openingHours: place.openingHours || undefined,
  });
}

// schema.org has no dedicated "tour operator"/"event organizer"/"cultural
// org"/"creative business" type — LocalBusiness is the closest honest fit
// for those, same reasoning as SCHEMA_TYPE_BY_PLACE_TYPE above.
const SCHEMA_TYPE_BY_BUSINESS_TYPE: Record<BusinessType, string> = {
  hotel: 'LodgingBusiness',
  restaurant: 'Restaurant',
  tour_operator: 'LocalBusiness',
  transport: 'LocalBusiness',
  travel_agency: 'TravelAgency',
  beach_resort: 'Resort',
  attraction: 'TouristAttraction',
  event_organizer: 'LocalBusiness',
  shop: 'Store',
  cultural_org: 'LocalBusiness',
  creative_business: 'LocalBusiness',
  car_rental: 'AutoRental',
  other: 'LocalBusiness',
};

export function businessJsonLd(business: Business) {
  const place = business.linkedPlace;
  return compact({
    '@context': 'https://schema.org',
    '@type': SCHEMA_TYPE_BY_BUSINESS_TYPE[business.type],
    name: business.name,
    description: business.description || undefined,
    image: business.images.length > 0 ? business.images : undefined,
    url: absoluteUrl(`/businesses/${business.slug}`),
    telephone: business.phone || undefined,
    email: business.email || undefined,
    sameAs: [business.website, ...business.socialLinks].filter((v): v is string => Boolean(v)),
    address: compact({
      '@type': 'PostalAddress',
      addressLocality: place.city,
      addressRegion: `${place.county.name} County`,
      addressCountry: 'LR',
    }),
    geo: {
      '@type': 'GeoCoordinates',
      latitude: place.latitude,
      longitude: place.longitude,
    },
    // Same physical destination as its linked Place, not a separate
    // review-bearing entity (see the business profile page's Reviews
    // section, which reuses the Place's own reviews) — so the aggregate
    // figures come from there too.
    aggregateRating:
      place.reviewCount > 0
        ? {
            '@type': 'AggregateRating',
            ratingValue: place.rating,
            reviewCount: place.reviewCount,
          }
        : undefined,
    openingHours: business.openingHours || undefined,
    priceRange:
      business.priceRangeMin != null
        ? `$${business.priceRangeMin}${business.priceRangeMax != null ? `–$${business.priceRangeMax}` : '+'}`
        : undefined,
  });
}

export function creatorJsonLd(creator: Creator) {
  return compact({
    '@context': 'https://schema.org',
    '@type': 'ProfilePage',
    mainEntity: compact({
      '@type': 'Person',
      name: creator.name,
      alternateName: `@${creator.username}`,
      description: creator.bio || undefined,
      image: creator.profileImage ? absoluteUrl(creator.profileImage) : undefined,
      email: creator.contactEmail || undefined,
      address: creator.county
        ? {
            '@type': 'PostalAddress',
            addressRegion: `${creator.county.name} County`,
            addressCountry: 'LR',
          }
        : undefined,
      sameAs: [
        creator.website,
        creator.instagram ? `https://instagram.com/${creator.instagram}` : null,
        creator.tiktok ? `https://tiktok.com/@${creator.tiktok}` : null,
        creator.youtube ? `https://youtube.com/@${creator.youtube}` : null,
      ].filter((v): v is string => Boolean(v)),
      aggregateRating:
        creator.reviewCount > 0
          ? {
              '@type': 'AggregateRating',
              ratingValue: creator.rating,
              reviewCount: creator.reviewCount,
            }
          : undefined,
    }),
    url: absoluteUrl(`/creators/${creator.username}`),
  });
}

// A county is a real geographic region, not just a listing page — schema.
// org's TouristDestination ("a tourist destination... from a City, Region,
// Country...") is the correct fit, distinct from the CollectionPage used
// for a category below. `places` should be exactly what's rendered on the
// page, not the full catalog — Google's own guidance is that structured
// data must mirror visible content, not describe more than the page shows.
export function countyJsonLd(county: County, places: Place[]) {
  return compact({
    '@context': 'https://schema.org',
    '@type': 'TouristDestination',
    name: `${county.name} County`,
    url: absoluteUrl(`/counties/${county.slug}`),
    includesAttraction:
      places.length > 0
        ? places.map((p) => ({
            '@type': 'TouristAttraction',
            name: p.name,
            url: absoluteUrl(`/places/${p.slug}`),
          }))
        : undefined,
  });
}

// A category page is a curated list, not a place — CollectionPage +
// ItemList is the honest fit (no dedicated schema.org type for "a
// business/attraction category"). Same "mirror what's on the page" rule
// as countyJsonLd.
export function categoryJsonLd(category: Category, places: Place[]) {
  return compact({
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: category.name,
    description: category.description || undefined,
    url: absoluteUrl(`/categories/${category.slug}`),
    mainEntity: compact({
      '@type': 'ItemList',
      numberOfItems: places.length,
      itemListElement: places.map((p, i) => ({
        '@type': 'ListItem',
        position: i + 1,
        url: absoluteUrl(`/places/${p.slug}`),
        name: p.name,
      })),
    }),
  });
}

export function eventJsonLd(event: Event) {
  const location = event.place
    ? compact({
        '@type': 'Place',
        name: event.place.name,
        address: compact({
          '@type': 'PostalAddress',
          addressLocality: event.place.city,
          addressRegion: `${event.county.name} County`,
          addressCountry: 'LR',
        }),
      })
    : compact({
        '@type': 'Place',
        name: event.locationText ?? event.county.name,
        address: {
          '@type': 'PostalAddress',
          addressRegion: `${event.county.name} County`,
          addressCountry: 'LR',
        },
      });

  return compact({
    '@context': 'https://schema.org',
    '@type': 'Event',
    name: event.name,
    startDate: event.startDate,
    endDate: event.endDate || undefined,
    eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode',
    eventStatus: 'https://schema.org/EventScheduled',
    description: event.description || undefined,
    image: event.images.length > 0 ? event.images : undefined,
    url: absoluteUrl(`/events/${event.id}`),
    location,
    organizer: event.createdBy
      ? {
          '@type': 'Person',
          name: event.createdBy.name,
        }
      : undefined,
  });
}
