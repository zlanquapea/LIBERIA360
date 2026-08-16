// LIBERIA360 shared wire types — the single source of truth for what the
// API actually sends over HTTP, imported by web/ instead of a hand-copied
// duplicate (see web/src/lib/types.ts, which now just re-exports this
// package). Update this file whenever a response shape in api/ changes;
// each interface below notes which backend file it corresponds to.
//
// Why this isn't also imported *by* api/: these are wire (post-JSON)
// shapes — dates are ISO strings, exactly what a browser receives — while
// the backend's own TypeORM entities hold real `Date` objects internally
// and only become strings once JSON.stringify serializes the HTTP
// response. TypeScript has no built-in way to assert "this class
// serializes to that interface," so api/ can't literally `implements`
// these without fighting that mismatch on every date field. The backend
// files noted in each comment below are the ones to update in lockstep;
// the e2e tests (api/test/*.e2e-spec.ts) are what actually catch drift in
// practice, by asserting on real HTTP response bodies.

export type PlaceType =
  | "attraction"
  | "nature_site"
  | "hotel"
  | "restaurant"
  | "activity_provider";

export type RecommendedVisitLength = "day_trip" | "overnight" | "multi_day";

export type VerificationStatus =
  | "unverified"
  | "verified"
  | "recommended"
  | "official"
  | "eco_certified"
  | "community_favorite";

export type ActivityDifficulty = "easy" | "moderate" | "challenging";

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
  icon: string | null;
  emergencyNumber: string | null;
  safetyTips: string[];
  localCustoms: string | null;
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

// api/src/places/entities/place.entity.ts
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

// api/src/users/entities/user.enums.ts
export type TravelerType =
  | "diaspora"
  | "tourist"
  | "expat"
  | "business_traveler"
  | "local_resident";

// api/src/users/user.serializer.ts's PublicUser — passwordHash is never
// sent to the client, so it has no field for it here either.
export interface AuthUser {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  authProvider: string;
  homeCounty: County | null;
  isAdmin: boolean;
  isSuperAdmin: boolean;
  travelerType: TravelerType | null;
  interests: string[];
  twoFactorEnabled: boolean;
  emailVerified: boolean;
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

// api/src/reviews/entities/review.entity.ts (sanitized — user is the
// public shape, never a passwordHash).
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

// api/src/businesses/entities/business.enums.ts
export type BusinessType = "hotel" | "restaurant" | "tour_operator" | "transport";
export type SubscriptionTier = "free" | "premium";

// api/src/businesses/entities/business.entity.ts (sanitized — owner is
// the public user shape).
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

// api/src/creators/entities/creator.entity.ts (sanitized — user is the
// public shape).
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
  featured: boolean;
  createdAt: string;
}

// api/src/analytics/entities/analytics-event.enums.ts
export type AnalyticsEventType = "view" | "save" | "contact_click" | "booking_request";

// api/src/analytics/analytics.service.ts's AnalyticsTotals/BusinessAnalytics.
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

// api/src/sponsored-placements/entities/sponsored-placement.entity.ts
// (sanitized — createdBy is the public user shape). "Featured this week" —
// a time-boxed paid campaign, distinct from Place.featured (Phase 1's
// general editorial curation, no start/end date).
export interface SponsoredPlacement {
  id: string;
  place: Place;
  placeId: string;
  startDate: string;
  endDate: string;
  createdBy: AuthUser | null;
  createdByUserId: string;
  createdAt: string;
  updatedAt: string;
}

// api/src/bookings/entities/booking.enums.ts
export type BookingStatus = "pending" | "confirmed" | "declined" | "cancelled";
export type PaymentProvider = "mtn_momo";
export type PaymentStatus = "unpaid" | "pending" | "paid" | "refunded";

// api/src/bookings/entities/booking.entity.ts (sanitized — guest and
// business.owner are the public user shape). Request-to-book only —
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

// api/src/booking-messages/entities/booking-message.entity.ts (sanitized —
// sender is the public user shape). Threaded notes on a booking between
// the guest and the business owner.
export interface BookingMessage {
  id: string;
  bookingId: string;
  sender: AuthUser | null;
  senderUserId: string;
  body: string;
  createdAt: string;
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

// api/src/events/entities/event.enums.ts
export type EventCategory = "concert" | "festival" | "sports" | "nightlife" | "seasonal" | "other";

// api/src/events/entities/event.entity.ts (sanitized — createdBy is the
// public user shape).
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

// api/src/itineraries/entities/itinerary.enums.ts
export type BudgetBand = "budget" | "moderate" | "premium";
export type ItineraryKind = "trip" | "weekend";

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
  userId: string;
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

// Collaborative trip planning (Wanderlog/TripIt-style): the owner invites
// other users by email, and from then on anyone in `collaborators` can
// view and edit the trip's stops right alongside the owner.
export interface ItineraryDetail extends Omit<Itinerary, "stops"> {
  stops: ItineraryStopWithPlace[];
  collaborators: AuthUser[];
}

export type PlaceSort = "featured" | "rating" | "distance" | "name";

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

// --- Admin dashboard (Tech Spec §7/§8) — mirrors api/src/admin/dto/*. ---

export interface CreatePlaceInput {
  name: string;
  slug: string;
  description: string;
  type: PlaceType;
  categoryId: string;
  countyId: string;
  city: string;
  latitude: number;
  longitude: number;
  tags?: string[];
  distanceFromMonroviaKm?: number;
  recommendedVisitLength?: RecommendedVisitLength;
  estimatedCostEntry?: number;
  estimatedCostGuide?: number;
  estimatedCostTransport?: number;
  images?: string[];
  videos?: string[];
  openingHours?: string;
  contactPhone?: string;
  whatsapp?: string;
  website?: string;
  instagram?: string;
  facebook?: string;
  featured?: boolean;
}

export type UpdatePlaceInput = Partial<CreatePlaceInput>;

export interface CreateActivityInput {
  placeId: string;
  name: string;
  description?: string;
  duration?: string;
  price?: number;
  difficulty?: ActivityDifficulty;
  ageRange?: string;
  guideRequired?: boolean;
}

export type UpdateActivityInput = Partial<Omit<CreateActivityInput, "placeId">>;

export interface CreateBusinessAdminInput {
  placeId: string;
  name: string;
  type: BusinessType;
  ownerUserId?: string;
  phone?: string;
  whatsapp?: string;
  email?: string;
  website?: string;
  socialLinks?: string[];
  description?: string;
  images?: string[];
}

export interface UpdateBusinessAdminInput {
  name?: string;
  type?: BusinessType;
  ownerUserId?: string | null;
  phone?: string;
  whatsapp?: string;
  email?: string;
  website?: string;
  socialLinks?: string[];
  description?: string;
  images?: string[];
}

export interface UpdateEventInput {
  name?: string;
  category?: EventCategory;
  placeId?: string;
  locationText?: string;
  countyId?: string;
  startDate?: string;
  endDate?: string;
  description?: string;
  images?: string[];
  ticketInfo?: string;
}

// PATCH /admin/counties/:id — safety & practical-info panel fields only;
// name/slug/rolloutStage/icon aren't editable through this endpoint.
export interface UpdateCountyInput {
  emergencyNumber?: string;
  safetyTips?: string[];
  localCustoms?: string;
}

export interface PossiblyClosedPlace {
  place: Place;
  noLongerHereCount: number;
}

// api/src/admin/admin.service.ts's ModerationQueue (sanitized).
export interface ModerationQueue {
  pendingBusinesses: Business[];
  recentReviews: Review[];
  possiblyClosedPlaces: PossiblyClosedPlace[];
}

// api/src/freshness/entities/place-freshness-report.enums.ts
export type FreshnessResponse = "still_here" | "no_longer_here";

export interface PlaceFreshnessReport {
  id: string;
  placeId: string;
  userId: string;
  response: FreshnessResponse;
  createdAt: string;
}

// api/src/admin/admin-analytics.service.ts
export interface TopPlace {
  placeId: string;
  name: string;
  slug: string;
  views: number;
  saves: number;
  contactClicks: number;
  bookingRequests: number;
  total: number;
}

export interface InterestBreakdown {
  id: string;
  name: string;
  totalEvents: number;
}

export interface AggregateAnalytics {
  topPlaces: TopPlace[];
  byCategory: InterestBreakdown[];
  byCounty: InterestBreakdown[];
}

// api/src/admin/admin-audit.service.ts (super-admin-only — see
// api/README.md's "Admin audit trail" bullet).
export interface AdminAction {
  id: string;
  adminUserId: string;
  adminUser: AuthUser;
  action: string;
  targetType: string;
  targetId: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
}

export interface PaginatedAdminActions {
  data: AdminAction[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}
