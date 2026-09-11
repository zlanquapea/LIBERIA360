import { isPharmacyBusiness } from "./business-api";
import type { Business, Category, County, Place } from "./types";

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

function place(category: Category): Place {
  return {
    id: "p1",
    name: "Corner Pharmacy",
    slug: "corner-pharmacy",
    description: "A neighborhood pharmacy.",
    type: "attraction",
    category,
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
    contactPhone: "+231770000000",
    whatsapp: null,
    website: null,
    instagram: null,
    facebook: null,
    rating: 0,
    reviewCount: 0,
    verificationStatus: "unverified",
    featured: false,
    reviewStatus: "submitted_for_review",
    ownerUserId: "user-1",
    rejectionReason: null,
    submittedAt: null,
    reviewedAt: null,
    reviewedByUserId: null,
  };
}

function business(category: Category): Business {
  return {
    id: "b1",
    name: "Corner Pharmacy",
    slug: "corner-pharmacy",
    // The generic auto-claim mapping predates the pharmacy marketplace and
    // has no PHARMACY value — this ends up "attraction" no matter what the
    // place's actual category is (see mapPlaceTypeToBusinessType on the
    // backend), which is exactly what isPharmacyBusiness works around by
    // reading the linked place's category instead of trusting this field.
    type: "attraction",
    owner: null,
    linkedPlaceId: "p1",
    linkedPlace: place(category),
    phone: "+231770000000",
    whatsapp: null,
    email: null,
    website: null,
    socialLinks: [],
    description: null,
    images: [],
    logoImage: null,
    videos: [],
    openingHours: null,
    priceRangeMin: null,
    priceRangeMax: null,
    servicesOffered: [],
    reviewStatus: "submitted_for_review",
    rejectionReason: null,
    submittedAt: null,
    reviewedAt: null,
    reviewedByUserId: null,
    verificationStatus: "unverified",
    subscriptionTier: "free",
    createdAt: "2026-01-01T00:00:00.000Z",
  };
}

describe("isPharmacyBusiness", () => {
  it("matches the singular 'Pharmacy' category by slug", () => {
    expect(
      isPharmacyBusiness(
        business({ id: "c1", name: "Pharmacy", slug: "pharmacy", description: null, icon: null }),
      ),
    ).toBe(true);
  });

  it("matches the plural 'Pharmacies' category — the same slug/name variants PlacesService.submitPlace accepts", () => {
    expect(
      isPharmacyBusiness(
        business({ id: "c1", name: "Pharmacies", slug: "pharmacies", description: null, icon: null }),
      ),
    ).toBe(true);
  });

  it("is case- and whitespace-insensitive, matching the backend check", () => {
    expect(
      isPharmacyBusiness(
        business({ id: "c1", name: " PHARMACY ", slug: "pharmacy", description: null, icon: null }),
      ),
    ).toBe(true);
  });

  it("is false for an unrelated category, regardless of business.type", () => {
    expect(
      isPharmacyBusiness(
        business({ id: "c1", name: "Beaches", slug: "beaches", description: null, icon: null }),
      ),
    ).toBe(false);
  });
});
