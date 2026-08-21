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
// public shape, never a passwordHash). Targets either a Place or a
// Creator — exactly one of placeId/creatorId is non-null, never both.
export interface Review {
  id: string;
  placeId: string | null;
  creatorId: string | null;
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
export type BusinessType =
  | "hotel"
  | "restaurant"
  | "tour_operator"
  | "transport"
  | "travel_agency"
  | "beach_resort"
  | "attraction"
  | "event_organizer"
  | "shop"
  | "cultural_org"
  | "creative_business"
  | "other";
export type SubscriptionTier = "free" | "premium";
export type BusinessReviewStatus =
  | "draft"
  | "submitted_for_review"
  | "under_review"
  | "approved"
  | "rejected"
  | "suspended";

// api/src/businesses/entities/business.entity.ts (sanitized — owner is
// the public user shape).
export interface Business {
  id: string;
  name: string;
  slug: string;
  type: BusinessType;
  owner: AuthUser | null;
  linkedPlaceId: string;
  // Always present — Business.linkedPlace is an eager, non-nullable
  // relation on the backend (every Business is tied to an existing Place).
  linkedPlace: Place;
  phone: string | null;
  whatsapp: string | null;
  email: string | null;
  website: string | null;
  socialLinks: string[];
  description: string | null;
  images: string[];
  logoImage: string | null;
  videos: string[];
  openingHours: string | null;
  priceRangeMin: number | null;
  priceRangeMax: number | null;
  servicesOffered: string[];
  reviewStatus: BusinessReviewStatus;
  rejectionReason: string | null;
  submittedAt: string | null;
  reviewedAt: string | null;
  reviewedByUserId: string | null;
  verificationStatus: VerificationStatus;
  subscriptionTier: SubscriptionTier;
  createdAt: string;
}

export interface PaginatedBusinesses {
  data: Business[];
  meta: { total: number; page: number; limit: number; totalPages: number };
}

export interface QueryBusinessesParams {
  page?: number;
  limit?: number;
  search?: string;
  type?: BusinessType;
  countyId?: string;
}

export interface SetBusinessReviewStatusInput {
  status: BusinessReviewStatus;
  reason?: string;
}

// api/src/creators/entities/creator.entity.ts (sanitized — user is the
// public shape).
// api/src/creators/entities/creator.enums.ts
export type CreatorCategory =
  | "photographer"
  | "videographer"
  | "tour_guide"
  | "tour_operator"
  | "artist"
  | "chef"
  | "cultural"
  | "other";

// Deliberately just two states, unlike Place/Business's VerificationStatus
// above — see CreatorVerificationStatus's backend doc comment for why.
export type CreatorVerificationStatus = "unverified" | "verified";

export type CreatorPortfolioItemType = "image" | "video";

export interface CreatorPortfolioItem {
  id: string;
  creatorId: string;
  type: CreatorPortfolioItemType;
  url: string;
  caption: string | null;
  category: string | null;
  sortOrder: number;
  createdAt: string;
}

export interface CreatorOffering {
  id: string;
  creatorId: string;
  title: string;
  description: string | null;
  priceFrom: number | null;
  durationLabel: string | null;
  location: string | null;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface Creator {
  id: string;
  user: AuthUser | null;
  name: string;
  username: string;
  bio: string | null;
  profileImage: string | null;
  coverImage: string | null;
  category: CreatorCategory;
  county: County | null;
  countyId: string | null;
  instagram: string | null;
  tiktok: string | null;
  youtube: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  whatsapp: string | null;
  website: string | null;
  languages: string[];
  yearsExperience: number | null;
  certifications: string[];
  availabilityNote: string | null;
  followerCount: number;
  specialties: string[];
  locationsCovered: string[];
  contentLinks: string[];
  verificationStatus: CreatorVerificationStatus;
  verifiedByUserId: string | null;
  verifiedAt: string | null;
  featured: boolean;
  // Recomputed from the reviews table — see ReviewsService.
  // recalculateCreatorRating, same convention as Place.rating/reviewCount.
  rating: number;
  reviewCount: number;
  createdAt: string;
  updatedAt: string;
  // Present on GET /creators/me and GET /creators/:username (which load
  // and attach these as a separate query — see CreatorsService.
  // attachRelated); absent on the paginated GET /creators list, which
  // stays lightweight for directory/card rendering.
  portfolioItems?: CreatorPortfolioItem[];
  offerings?: CreatorOffering[];
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

export interface CreateCategoryInput {
  name: string;
  slug: string;
  icon?: string;
  description?: string;
}

export type UpdateCategoryInput = Partial<CreateCategoryInput>;

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
  logoImage?: string;
  videos?: string[];
  openingHours?: string;
  priceRangeMin?: number;
  priceRangeMax?: number;
  servicesOffered?: string[];
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
  logoImage?: string;
  videos?: string[];
  openingHours?: string;
  priceRangeMin?: number;
  priceRangeMax?: number;
  servicesOffered?: string[];
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

// api/src/reports/entities/content-report.enums.ts
export type ReportTargetType = "review" | "event" | "business";
export type ReportReason =
  | "spam"
  | "inappropriate"
  | "fake"
  | "fraudulent"
  | "misleading_offer"
  | "copyright"
  | "other";

export interface CreateContentReportInput {
  targetType: ReportTargetType;
  targetId: string;
  reason: ReportReason;
  details?: string;
}

// api/src/admin/admin.service.ts's FlaggedContent (sanitized) — a review
// or event that's crossed the report threshold, surfaced in the
// moderation queue below.
export interface FlaggedContent {
  targetType: ReportTargetType;
  targetId: string;
  reportCount: number;
  reasons: Record<ReportReason, number>;
  review: Review | null;
  event: Event | null;
  business: Business | null;
}

// api/src/business-content/entities/business-content.enums.ts
export type BusinessContentType =
  | "offer"
  | "announcement"
  | "article"
  | "travel_tip"
  | "experience";
export type BusinessContentStatus =
  | "draft"
  | "submitted_for_review"
  | "approved"
  | "rejected";

// api/src/business-content/entities/business-content.entity.ts (sanitized
// — business is the sanitized Business shape, present whenever the
// backend loaded that relation, e.g. in the admin moderation queue).
export interface BusinessContent {
  id: string;
  businessId: string;
  business?: Business | null;
  type: BusinessContentType;
  title: string;
  body: string;
  images: string[];
  externalLink: string | null;
  validFrom: string | null;
  validUntil: string | null;
  status: BusinessContentStatus;
  rejectionReason: string | null;
  submittedAt: string | null;
  reviewedAt: string | null;
  reviewedByUserId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PaginatedBusinessContent {
  data: BusinessContent[];
  meta: { total: number; page: number; limit: number; totalPages: number };
}

export interface CreateBusinessContentInput {
  businessId: string;
  type: BusinessContentType;
  title: string;
  body: string;
  images?: string[];
  externalLink?: string;
  validFrom?: string;
  validUntil?: string;
}

export type UpdateBusinessContentInput = Partial<
  Omit<CreateBusinessContentInput, "businessId" | "type">
>;

export interface SetBusinessContentReviewStatusInput {
  status: BusinessContentStatus;
  reason?: string;
}

// api/src/admin/admin.service.ts's ModerationQueue (sanitized).
export interface ModerationQueue {
  pendingBusinesses: Business[];
  recentReviews: Review[];
  possiblyClosedPlaces: PossiblyClosedPlace[];
  flaggedContent: FlaggedContent[];
  pendingBusinessContent: BusinessContent[];
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
  ipAddress: string | null;
  userAgent: string | null;
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

// api/src/admin/admin-users.service.ts — GET /admin/users, super-admin
// only. Every account, not just admins (that's AuthUser[] from
// GET /admin/team) — the Users & Roles > Users screen.
export interface PaginatedUsers {
  data: AuthUser[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

// api/src/admin/admin-system.service.ts — GET /admin/system/status,
// super-admin only. Real runtime flags, no secrets: which optional
// integrations are actually configured, not their credentials.
export interface SystemStatus {
  environment: string;
  apiUptimeSeconds: number;
  storageDriver: "local" | "s3";
  databaseSslEnabled: boolean;
  integrations: {
    email: boolean;
    pushNotifications: boolean;
    crashReporting: boolean;
  };
}

// api/src/admin/admin-analytics.service.ts's getOverview() — GET
// /admin/analytics/overview. Current-vs-previous-period comparisons
// computed from existing timestamped tables, not a stored metrics
// snapshot — see the service's own doc comment.
export interface MetricTrend {
  key: "newUsers" | "newReviews" | "newBookings" | "pageViews";
  label: string;
  current: number;
  previous: number;
  deltaPct: number | null;
  direction: "up" | "down" | "flat";
}

export interface NeglectedPlace {
  placeId: string;
  name: string;
  slug: string;
}

export interface TopReviewer {
  userId: string;
  name: string;
  reviewCount: number;
}

export interface AnalyticsOverview {
  periodDays: number;
  metrics: MetricTrend[];
  topPlaces: TopPlace[];
  neglectedPlaces: NeglectedPlace[];
  topReviewers: TopReviewer[];
  insights: string[];
}

// api/src/security/entities/login-activity.entity.ts (super-admin-only —
// see api/README.md's "Security — login activity & session revocation"
// section). Every completed login attempt, success or failure.
export type LoginActivityReason =
  | "success"
  | "invalid_credentials"
  | "invalid_2fa_code";

export interface LoginActivity {
  id: string;
  userId: string | null;
  user: AuthUser | null;
  emailAttempted: string;
  success: boolean;
  reason: LoginActivityReason;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: string;
}

export interface PaginatedLoginActivity {
  data: LoginActivity[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

// api/src/security/login-activity.service.ts's getOverview().
export interface SecurityOverview {
  failedLoginsLast1h: number;
  failedLoginsLast24h: number;
  distinctFailingIpsLast24h: number;
  adminTwoFactorAdoption: {
    total: number;
    enabled: number;
  };
}

// api/src/admin/admin.service.ts's getPlatformKpis() — GET /admin/kpis,
// super-admin only. No revenue figure: no money actually moves through
// the app yet (Booking.paymentStatus stays "unpaid" until a real MTN
// Mobile Money integration lands).
export interface PlatformKpis {
  totalUsers: number;
  newUsersLast7Days: number;
  totalPlaces: number;
  totalBusinessListings: number;
  claimedBusinessCount: number;
  businessClaimRate: number;
  totalReviews: number;
  totalBookings: number;
  bookingsByStatus: Record<BookingStatus, number>;
}
