// Mirrors api/src/places/entities/* — kept in sync by hand for now. If the
// monorepo grows a shared-types package later, this is the file to replace.

export type PlaceType = 'attraction' | 'nature_site' | 'hotel' | 'restaurant' | 'activity_provider';

export type RecommendedVisitLength = 'day_trip' | 'overnight' | 'multi_day';

export type VerificationStatus =
  | 'unverified'
  | 'verified'
  | 'recommended'
  | 'official'
  | 'eco_certified'
  | 'community_favorite';

export type ActivityDifficulty = 'easy' | 'moderate' | 'challenging';

export interface Category {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  icon: string | null;
  placeCount?: number;
}

export interface County {
  id: string;
  name: string;
  slug: string;
  rolloutStage: number;
  placeCount?: number;
}

export interface Activity {
  id: string;
  name: string;
  description: string | null;
  duration: string | null;
  price: number | null;
  difficulty: ActivityDifficulty | null;
  ageRange: string | null;
  guideRequired: boolean;
}

export interface Place {
  id: string;
  name: string;
  slug: string;
  description: string;
  type: PlaceType;
  category: Category;
  tags: string[];
  county: County;
  city: string;
  latitude: number;
  longitude: number;
  distanceFromMonroviaKm: number | null;
  recommendedVisitLength: RecommendedVisitLength | null;
  estimatedCostEntry: number | null;
  estimatedCostGuide: number | null;
  estimatedCostTransport: number | null;
  images: string[];
  videos: string[];
  openingHours: string | null;
  contactPhone: string | null;
  whatsapp: string | null;
  website: string | null;
  instagram: string | null;
  facebook: string | null;
  rating: number;
  reviewCount: number;
  verificationStatus: VerificationStatus;
  featured: boolean;
  activities?: Activity[];
  // Populated (non-null) only when the request included lat/lng/radiusKm —
  // distance from the *search point*, distinct from distanceFromMonroviaKm
  // above (which is a fixed catalog field, always from Monrovia).
  distanceKm?: number | null;
}

// Mirrors api/src/users/user.serializer.ts's PublicUser — passwordHash is
// never sent to the client, so it has no field for it here either.
export interface AuthUser {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  authProvider: string;
  homeCounty: County | null;
  isAdmin: boolean;
  createdAt: string;
}

export interface PaginatedPlaces {
  data: Place[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

// Mirrors api/src/reviews/entities/review.entity.ts (sanitized — user is
// the public shape, never a passwordHash).
export interface Review {
  id: string;
  placeId: string;
  user: AuthUser | null;
  overallRating: number;
  experienceRating: number | null;
  accessibilityRating: number | null;
  cleanlinessRating: number | null;
  valueRating: number | null;
  safetyRating: number | null;
  serviceRating: number | null;
  comment: string | null;
  photos: string[];
  verifiedVisit: boolean;
  createdAt: string;
}

export interface PaginatedReviews {
  data: Review[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

// Mirrors api/src/businesses/entities/business.enums.ts.
export type BusinessType = 'hotel' | 'restaurant' | 'tour_operator' | 'transport';
export type SubscriptionTier = 'free' | 'premium';

// Mirrors api/src/businesses/entities/business.entity.ts (sanitized — owner
// is the public user shape).
export interface Business {
  id: string;
  name: string;
  type: BusinessType;
  owner: AuthUser | null;
  linkedPlaceId: string;
  phone: string | null;
  whatsapp: string | null;
  email: string | null;
  website: string | null;
  socialLinks: string[];
  description: string | null;
  images: string[];
  verificationStatus: VerificationStatus;
  subscriptionTier: SubscriptionTier;
  createdAt: string;
}

// Mirrors api/src/creators/entities/creator.entity.ts (sanitized — user is
// the public shape).
export interface Creator {
  id: string;
  user: AuthUser | null;
  name: string;
  username: string;
  bio: string | null;
  profileImage: string | null;
  instagram: string | null;
  tiktok: string | null;
  youtube: string | null;
  followerCount: number;
  specialties: string[];
  locationsCovered: string[];
  contentLinks: string[];
  verified: boolean;
  createdAt: string;
}

// Mirrors api/src/analytics/entities/analytics-event.enums.ts.
export type AnalyticsEventType = 'view' | 'save' | 'contact_click' | 'booking_request';

// Mirrors api/src/analytics/analytics.service.ts's AnalyticsTotals/BusinessAnalytics.
export interface AnalyticsTotals {
  view: number;
  save: number;
  contact_click: number;
  booking_request: number;
}

export interface BusinessAnalytics {
  totals: AnalyticsTotals;
  byDay: (AnalyticsTotals & { date: string })[];
}

// Mirrors api/src/bookings/entities/booking.enums.ts.
export type BookingStatus = 'pending' | 'confirmed' | 'declined' | 'cancelled';
export type PaymentProvider = 'mtn_momo';
export type PaymentStatus = 'unpaid' | 'pending' | 'paid' | 'refunded';

// Mirrors api/src/bookings/entities/booking.entity.ts (sanitized — guest
// and business.owner are the public user shape). Request-to-book only —
// paymentStatus stays 'unpaid' until a real MTN MoMo integration exists.
export interface Booking {
  id: string;
  business: Business;
  businessId: string;
  guest: AuthUser | null;
  guestUserId: string;
  requestedDate: string;
  requestedEndDate: string | null;
  partySize: number | null;
  notes: string | null;
  status: BookingStatus;
  businessResponse: string | null;
  respondedAt: string | null;
  paymentProvider: PaymentProvider;
  paymentStatus: PaymentStatus;
  paymentReference: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PaginatedCreators {
  data: Creator[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

// Mirrors api/src/events/entities/event.enums.ts.
export type EventCategory = 'concert' | 'festival' | 'sports' | 'nightlife' | 'seasonal' | 'other';

// Mirrors api/src/events/entities/event.entity.ts (sanitized — createdBy is
// the public user shape).
export interface Event {
  id: string;
  name: string;
  category: EventCategory;
  place: Place | null;
  placeId: string | null;
  locationText: string | null;
  county: County;
  startDate: string;
  endDate: string | null;
  description: string | null;
  images: string[];
  ticketInfo: string | null;
  createdBy: AuthUser | null;
  createdAt: string;
}

export interface PaginatedEvents {
  data: Event[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

// Mirrors api/src/itineraries/entities/itinerary.enums.ts.
export type BudgetBand = 'budget' | 'moderate' | 'premium';
export type ItineraryKind = 'trip' | 'weekend';

// GET /itineraries (list) returns stops as stored — placeId only, not
// resolved. GET /itineraries/:id and the two generate endpoints return
// stops with the full Place resolved (ItineraryStopWithPlace below).
export interface ItineraryStop {
  day: number;
  order: number;
  placeId: string;
  notes: string | null;
}

export interface Itinerary {
  id: string;
  title: string;
  kind: ItineraryKind;
  durationDays: number;
  budgetBand: BudgetBand;
  interests: string[];
  stops: ItineraryStop[];
  createdAt: string;
}

export interface ItineraryStopWithPlace {
  day: number;
  order: number;
  notes: string | null;
  place: Place;
}

export interface ItineraryDetail extends Omit<Itinerary, 'stops'> {
  stops: ItineraryStopWithPlace[];
}

export type PlaceSort = 'featured' | 'rating' | 'distance' | 'name';

export interface PlacesQuery {
  category?: string;
  county?: string;
  tag?: string;
  type?: PlaceType;
  q?: string;
  sort?: PlaceSort;
  page?: number;
  limit?: number;
  // "Near Me" (Tech Spec §3.2) — must be supplied together, or omitted.
  lat?: number;
  lng?: number;
  radiusKm?: number;
}
