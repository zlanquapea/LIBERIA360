// schema.org JSON-LD builders — lets Google (Search + Maps) understand and
// surface individual destination/event pages directly in results, instead
// of relying solely on in-app discovery. Free organic-acquisition channel
// that costs almost nothing to emit; every major local-discovery product
// (Google Maps listings, TripAdvisor, Yelp) does this on every page like
// this one. See https://schema.org/LocalBusiness, /TouristAttraction,
// /Event.

import type { Event, Place, PlaceType } from './types';
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
