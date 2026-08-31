import {
  businessJsonLd,
  categoryJsonLd,
  countyJsonLd,
  creatorJsonLd,
  eventJsonLd,
  placeJsonLd,
} from "./structured-data";
import type {
  Business,
  Category,
  County,
  Creator,
  Event,
  Place,
} from "./types";

const COUNTY: County = {
  id: "co1",
  name: "Montserrado",
  slug: "montserrado",
  rolloutStage: 1,
  icon: null,
  emergencyNumber: null,
  safetyTips: [],
  localCustoms: null,
};

const CATEGORY: Category = {
  id: "c1",
  name: "Beaches",
  slug: "beaches",
  description: "Beach spots",
  icon: "SunIcon",
};

const PLACE: Place = {
  id: "p1",
  name: "CeeCee Beach",
  slug: "ceecee-beach",
  description: "A quiet beach just outside Monrovia.",
  type: "nature_site",
  category: CATEGORY,
  tags: [],
  county: COUNTY,
  city: "Monrovia",
  latitude: 6.3,
  longitude: -10.8,
  distanceFromMonroviaKm: 5,
  recommendedVisitLength: null,
  estimatedCostEntry: null,
  estimatedCostGuide: null,
  estimatedCostTransport: null,
  images: [],
  videos: [],
  openingHours: null,
  structuredHours: null,
  contactPhone: null,
  whatsapp: null,
  website: null,
  instagram: null,
  facebook: null,
  rating: 4.5,
  reviewCount: 3,
  verificationStatus: "verified",
  featured: false,
  reviewStatus: "approved",
  ownerUserId: null,
  rejectionReason: null,
  submittedAt: null,
  reviewedAt: null,
  reviewedByUserId: null,
};

describe("placeJsonLd", () => {
  it("maps place type to the matching schema.org type", () => {
    expect(placeJsonLd(PLACE)["@type"]).toBe("TouristAttraction");
    expect(placeJsonLd({ ...PLACE, type: "restaurant" })["@type"]).toBe(
      "Restaurant",
    );
  });

  it("omits aggregateRating for a place with no reviews", () => {
    expect(placeJsonLd({ ...PLACE, reviewCount: 0 })).not.toHaveProperty(
      "aggregateRating",
    );
  });
});

describe("eventJsonLd", () => {
  const EVENT: Event = {
    id: "e1",
    name: "Beach Cleanup",
    category: "festival",
    place: null,
    placeId: null,
    locationText: "CeeCee Beach",
    latitude: null,
    longitude: null,
    county: COUNTY,
    startDate: "2026-09-01T09:00:00.000Z",
    endDate: null,
    description: "Community cleanup day.",
    images: [],
    ticketInfo: null,
    ticketPrice: null,
    ticketCurrency: "LRD",
    ticketCapacity: null,
    paymentInstructions: null,
    ticketTypes: [],
    createdBy: null,
    reviewStatus: "approved",
    rejectionReason: null,
    interestedCount: 0,
    goingCount: 0,
    createdAt: "2026-01-01T00:00:00.000Z",
  };

  it("uses locationText when there is no linked Place", () => {
    const data = eventJsonLd(EVENT) as { location: { name: string } };
    expect(data.location.name).toBe("CeeCee Beach");
  });

  it("omits geo coordinates when the event has no pin and no linked Place", () => {
    const data = eventJsonLd(EVENT) as { location: { geo?: unknown } };
    expect(data.location.geo).toBeUndefined();
  });

  it("includes geo coordinates from the event's own pin", () => {
    const data = eventJsonLd({ ...EVENT, latitude: 6.31, longitude: -10.8 }) as {
      location: { geo: { latitude: number; longitude: number } };
    };
    expect(data.location.geo).toEqual({
      "@type": "GeoCoordinates",
      latitude: 6.31,
      longitude: -10.8,
    });
  });

  it("falls back to the linked Place's coordinates when the event has no pin of its own", () => {
    const data = eventJsonLd({ ...EVENT, place: PLACE, placeId: PLACE.id }) as {
      location: { geo: { latitude: number; longitude: number } };
    };
    expect(data.location.geo).toEqual({
      "@type": "GeoCoordinates",
      latitude: PLACE.latitude,
      longitude: PLACE.longitude,
    });
  });
});

describe("countyJsonLd", () => {
  it("is a TouristDestination listing exactly the given places, not the whole catalog", () => {
    const data = countyJsonLd(COUNTY, [PLACE]) as {
      "@type": string;
      includesAttraction: Array<{ name: string; url: string }>;
    };
    expect(data["@type"]).toBe("TouristDestination");
    expect(data.includesAttraction).toHaveLength(1);
    expect(data.includesAttraction[0].name).toBe("CeeCee Beach");
  });

  it("omits includesAttraction entirely for an empty county", () => {
    expect(countyJsonLd(COUNTY, [])).not.toHaveProperty("includesAttraction");
  });
});

describe("categoryJsonLd", () => {
  it("is a CollectionPage whose ItemList mirrors the given places", () => {
    const data = categoryJsonLd(CATEGORY, [PLACE]) as {
      "@type": string;
      mainEntity: {
        numberOfItems: number;
        itemListElement: Array<{ position: number; name: string }>;
      };
    };
    expect(data["@type"]).toBe("CollectionPage");
    expect(data.mainEntity.numberOfItems).toBe(1);
    expect(data.mainEntity.itemListElement[0]).toMatchObject({
      position: 1,
      name: "CeeCee Beach",
    });
  });
});

describe("businessJsonLd", () => {
  const BUSINESS: Business = {
    id: "b1",
    name: "CeeCee Beach Bar",
    slug: "ceecee-beach-bar",
    type: "restaurant",
    owner: null,
    linkedPlaceId: "p1",
    linkedPlace: PLACE,
    phone: "+231770000000",
    whatsapp: null,
    email: "hello@example.com",
    website: "https://example.com",
    socialLinks: ["https://instagram.com/ceecee"],
    description: "Beachfront bar and grill.",
    images: [],
    logoImage: null,
    videos: [],
    openingHours: "Daily 10:00-22:00",
    priceRangeMin: 5,
    priceRangeMax: 20,
    servicesOffered: [],
    reviewStatus: "approved",
    rejectionReason: null,
    submittedAt: null,
    reviewedAt: null,
    reviewedByUserId: null,
    verificationStatus: "verified",
    subscriptionTier: "free",
    createdAt: "2026-01-01T00:00:00.000Z",
  };

  it("maps business type to the matching schema.org type and pulls address/geo from the linked place", () => {
    const data = businessJsonLd(BUSINESS) as {
      "@type": string;
      address: { addressLocality: string };
      geo: { latitude: number };
      aggregateRating: { reviewCount: number };
      priceRange: string;
    };
    expect(data["@type"]).toBe("Restaurant");
    expect(data.address.addressLocality).toBe("Monrovia");
    expect(data.geo.latitude).toBe(6.3);
    expect(data.aggregateRating.reviewCount).toBe(3); // from linkedPlace, not a separate business rating
    expect(data.priceRange).toBe("$5–$20");
  });

  it("collects the website and social links into sameAs", () => {
    const data = businessJsonLd(BUSINESS) as { sameAs: string[] };
    expect(data.sameAs).toEqual([
      "https://example.com",
      "https://instagram.com/ceecee",
    ]);
  });
});

describe("creatorJsonLd", () => {
  const CREATOR: Creator = {
    id: "cr1",
    user: null,
    name: "Jane Doe",
    username: "janedoe",
    bio: "Photographer capturing Liberia.",
    profileImage: "/uploads/jane.jpg",
    coverImage: null,
    category: "photographer",
    county: COUNTY,
    countyId: "co1",
    instagram: "janedoe",
    tiktok: null,
    youtube: null,
    contactEmail: "jane@example.com",
    contactPhone: null,
    whatsapp: null,
    website: null,
    languages: [],
    yearsExperience: null,
    certifications: [],
    availabilityNote: null,
    availabilityStatus: "accepting_requests",
    followerCount: 0,
    specialties: [],
    locationsCovered: [],
    contentLinks: [],
    verificationStatus: "verified",
    verifiedByUserId: null,
    verifiedAt: null,
    featured: false,
    rating: 4.8,
    reviewCount: 10,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  };

  it("wraps a Person in a ProfilePage, with social links collected into sameAs", () => {
    const data = creatorJsonLd(CREATOR) as {
      "@type": string;
      mainEntity: {
        "@type": string;
        name: string;
        sameAs: string[];
        aggregateRating: { ratingValue: number };
      };
    };
    expect(data["@type"]).toBe("ProfilePage");
    expect(data.mainEntity["@type"]).toBe("Person");
    expect(data.mainEntity.name).toBe("Jane Doe");
    expect(data.mainEntity.sameAs).toEqual(["https://instagram.com/janedoe"]);
    expect(data.mainEntity.aggregateRating.ratingValue).toBe(4.8);
  });

  it("omits aggregateRating for a creator with no reviews", () => {
    const data = creatorJsonLd({ ...CREATOR, reviewCount: 0 }) as {
      mainEntity: object;
    };
    expect(data.mainEntity).not.toHaveProperty("aggregateRating");
  });
});
