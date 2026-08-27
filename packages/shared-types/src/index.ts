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
  "attraction" | "nature_site" | "hotel" | "restaurant" | "activity_provider";

export type RecommendedVisitLength = "day_trip" | "overnight" | "multi_day";

export type VerificationStatus =
  | "unverified"
  | "verified"
  | "recommended"
  | "official"
  | "eco_certified"
  | "community_favorite";

export type ActivityDifficulty = "easy" | "moderate" | "challenging";

// api/src/places/entities/place.enums.ts — same shape and reasoning as
// BusinessReviewStatus (see that type below): whether a place is visible
// in the public catalog at all, orthogonal to VerificationStatus's "how
// much do we vouch for it."
export type PlaceReviewStatus =
  | "draft"
  | "submitted_for_review"
  | "under_review"
  | "approved"
  | "rejected"
  | "suspended";

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

// api/src/places/opening-hours.ts — computed from Place.openingHours on a
// best-effort basis (see that file's doc comment); null/absent means the
// free text couldn't be parsed, not "closed."
export interface OpeningPeriod {
  dayOfWeek: 0 | 1 | 2 | 3 | 4 | 5 | 6;
  opens: string; // "HH:MM", 24-hour
  closes: string; // "HH:MM", 24-hour; "24:00" for midnight/end-of-day
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
  structuredHours: OpeningPeriod[] | null;
  contactPhone: string | null;
  whatsapp: string | null;
  website: string | null;
  instagram: string | null;
  facebook: string | null;
  rating: number;
  reviewCount: number;
  verificationStatus: VerificationStatus;
  // Set by admin verification actions; optional for older/public responses.
  verifiedAt?: string | null;
  featured: boolean;
  activities?: Activity[];
  // Populated (non-null) only when the request included lat/lng/radiusKm —
  // distance from the *search point*, distinct from distanceFromMonroviaKm
  // above (which is a fixed catalog field, always from Monrovia).
  distanceKm?: number | null;
  // Self-service submission + admin review lifecycle (Place.reviewStatus
  // et al.) — see PlaceReviewStatus above. `owner` is only ever populated
  // on the admin list/detail responses (AdminContentService.findPlaces/
  // findPlaceById); every public place response omits it (undefined),
  // same reasoning as why the backend relation isn't eager.
  reviewStatus: PlaceReviewStatus;
  ownerUserId: string | null;
  owner?: AuthUser | null;
  rejectionReason: string | null;
  submittedAt: string | null;
  reviewedAt: string | null;
  reviewedByUserId: string | null;
}

// api/src/users/entities/user.enums.ts
export type TravelerType =
  "diaspora" | "tourist" | "expat" | "business_traveler" | "local_resident";

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
  /** True for an admin/super-admin account created via the "New person"
   * invite flow (AdminTeamService.createAdmin) that hasn't set a password
   * yet. See PublicUser's doc comment — not sensitive, just an activation
   * state. */
  pendingActivation: boolean;
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

// api/src/admin/admin-content.service.ts's auditPlaceDataQuality —
// GET /admin/places/data-quality.
export interface PlaceDataQualityIssue {
  place: Place;
  issues: string[];
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
  // Set by admin verification actions; optional for older/public responses.
  verifiedAt?: string | null;
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
export type CreatorAvailabilityStatus =
  "accepting_requests" | "limited" | "unavailable";

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
  availabilityStatus: CreatorAvailabilityStatus;
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

export type CreatorPostMediaType = "image" | "video";
export type CreatorPostStatus = "published" | "hidden";

export interface CreatorPostAuthor {
  id: string;
  name: string;
  username: string;
  profileImage: string | null;
  verificationStatus: CreatorVerificationStatus;
  availabilityStatus: CreatorAvailabilityStatus;
  category: CreatorCategory;
  county: County | null;
}

export interface CreatorPost {
  id: string;
  creatorId: string;
  mediaType: CreatorPostMediaType;
  mediaUrl: string;
  caption: string | null;
  status: CreatorPostStatus;
  likeCount: number;
  commentCount: number;
  saveCount: number;
  shareCount: number;
  creator: CreatorPostAuthor;
  viewerLiked?: boolean;
  viewerSaved?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreatorPostComment {
  id: string;
  postId: string;
  userId: string;
  body: string;
  user: AuthUser | null;
  createdAt: string;
  updatedAt: string;
}

export interface PaginatedCreatorPosts {
  data: CreatorPost[];
  meta: { total: number; page: number; limit: number; totalPages: number };
}

// api/src/analytics/entities/analytics-event.enums.ts
export type AnalyticsEventType =
  "view" | "save" | "contact_click" | "booking_request";

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
// Targets either a Business or a Creator, never both — see the backend
// entity's doc comment.
export interface Booking {
  id: string;
  business: Business | null;
  businessId: string | null;
  creator: Creator | null;
  creatorId: string | null;
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
// the guest and the business owner. `readAt` is set once the *other*
// participant has opened the thread since this message was sent — null
// means the sender's UI should show "Delivered" rather than "Viewed".
// `editedAt` is set when the sender edits `body` after sending — show an
// "(edited)" marker to both participants. `deletedAt` is set when the
// sender deletes the message; the API always sends `body: null` once it
// is, so render a "This message was deleted" placeholder instead.
export interface BookingMessage {
  id: string;
  bookingId: string;
  sender: AuthUser | null;
  senderUserId: string;
  body: string | null;
  createdAt: string;
  readAt: string | null;
  editedAt: string | null;
  deletedAt: string | null;
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
export type EventCategory =
  "concert" | "festival" | "sports" | "nightlife" | "seasonal" | "other";
export type EventReviewStatus = "pending" | "approved" | "rejected";

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
  reviewStatus: EventReviewStatus;
  rejectionReason: string | null;
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

// POST /itineraries/preview — the one itinerary endpoint that needs no
// account (product review readout, Aug 22, 2026: "guest-first trip
// planning" — let a visitor see a real generated route before asking them
// to log in). Deliberately not an Itinerary/ItineraryDetail: there's no
// id, userId, or createdAt because nothing was persisted. "Save this trip"
// after logging in is just calling the normal generate-trip endpoint with
// the same inputs, which is deterministic against unchanged catalog data.
export interface TripPreviewResponse {
  title: string;
  kind: ItineraryKind;
  durationDays: number;
  budgetBand: BudgetBand;
  interests: string[];
  stops: ItineraryStopWithPlace[];
}

// Collaborative trip planning (Wanderlog/TripIt-style): the owner invites
// other users by email, and from then on anyone in `collaborators` can
// view and edit the trip's stops right alongside the owner.
export interface ItineraryDetail extends Omit<Itinerary, "stops"> {
  stops: ItineraryStopWithPlace[];
  collaborators: AuthUser[];
}

// Trip Collaboration & Invitations. See
// api/src/itineraries/entities/trip-invitation.entity.ts's doc comment
// for why only pending/accepted/declined are real persisted states —
// "viewed" and "expired" below are derived server-side (viewedAt /
// expiresAt vs now), not separate stored transitions.
export type InvitationDisplayStatus =
  "pending" | "viewed" | "accepted" | "declined" | "expired";

// api/src/users/user.serializer.ts's InvitableUser — the "people you may
// want to invite" search result. Deliberately thinner than AuthUser: a
// masked email (see maskEmail) is all a search result should ever leak
// about someone else's account.
export interface InvitableUser {
  id: string;
  name: string;
  maskedEmail: string;
}

// The trip owner's People/Participants panel — one row per invitation
// (pending, accepted, or declined; cancelled ones are deleted outright).
export interface InvitationSummary {
  id: string;
  email: string;
  status: InvitationDisplayStatus;
  invitee: AuthUser | null;
  emailDelivered: boolean;
  createdAt: string;
  respondedAt: string | null;
  expiresAt: string;
}

// GET /invitations/mine — the invited person's own inbox of open invites.
export interface MyInvitationSummary {
  id: string;
  tripId: string;
  tripTitle: string;
  destinationSummary: string;
  durationDays: number;
  organizerName: string;
  createdAt: string;
  expiresAt: string;
}

// GET /invitations/token/:token — public, pre-authentication preview.
// Deliberately thin (see the endpoint's doc comment): no stop list, no
// other participants' contact info.
export interface InvitationPreview {
  tripTitle: string;
  tripKind: ItineraryKind;
  durationDays: number;
  destinationSummary: string;
  overview: string;
  organizerName: string;
  invitedEmail: string;
  otherParticipantNames: string[];
  status: InvitationDisplayStatus;
  requiresAccount: boolean;
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
  // Filters to places whose structuredHours (api/src/places/opening-hours.ts)
  // say they're open right now. A place whose hours weren't recognized by
  // the parser is never included — "we don't know" isn't "open."
  openNow?: boolean;
  // Filters by place.estimatedCostEntry (USD). A place with no cost on
  // file is excluded once either bound is set — same conservative stance
  // as openNow.
  priceMin?: number;
  priceMax?: number;
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
  "offer" | "announcement" | "article" | "travel_tip" | "experience";
export type BusinessContentStatus =
  "draft" | "submitted_for_review" | "approved" | "rejected";

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

// api/src/admin/admin.service.ts's runBulk() — the shape every bulk
// moderation endpoint (places/businesses/business-content review-status)
// returns, so one bad id in a multi-select batch doesn't abort the rest.
export interface BulkReviewResult {
  succeeded: string[];
  failed: { id: string; error: string }[];
}

// api/src/admin/admin.service.ts's ModerationQueue (sanitized).
export interface ModerationQueue {
  pendingBusinesses: Business[];
  pendingPlaces: Place[];
  recentReviews: Review[];
  possiblyClosedPlaces: PossiblyClosedPlace[];
  flaggedContent: FlaggedContent[];
  pendingBusinessContent: BusinessContent[];
  pendingAdvertisements: Advertisement[];
  pendingEvents: Event[];
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

// api/src/mail/mail.service.ts's MailAttempt — the outcome of the most
// recent email this process tried to send (any of them, not just a test
// send), so "the button said Sent but nothing arrived" is diagnosable from
// SystemStatus.mail below instead of only from server logs.
export interface MailAttempt {
  at: string;
  to: string;
  subject: string;
  success: boolean;
  error: string | null;
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
    adminLoginIpAllowlist: boolean;
  };
  // Richer than integrations.email — whether SMTP creds are present AND
  // what happened the last time this process actually tried to send.
  mail: {
    configured: boolean;
    lastAttempt: MailAttempt | null;
  };
}

// api/src/settings/entities/application-settings.entity.ts — Settings >
// Application, GET/PATCH /admin/settings/application, super-admin only.
// The moderation/alerting thresholds that used to be hardcoded constants,
// now editable without a deploy. Always exactly one row (id: 1).
export interface ApplicationSettings {
  id: number;
  freshnessFlagThreshold: number;
  freshnessWindowDays: number;
  reportFlagThreshold: number;
  reportWindowDays: number;
  failedLoginAlertThreshold1h: number;
  failedLoginAlertThreshold24h: number;
  updatedByUserId: string | null;
  updatedAt: string;
}

export type UpdateApplicationSettingsInput = Partial<
  Pick<
    ApplicationSettings,
    | "freshnessFlagThreshold"
    | "freshnessWindowDays"
    | "reportFlagThreshold"
    | "reportWindowDays"
    | "failedLoginAlertThreshold1h"
    | "failedLoginAlertThreshold24h"
  >
>;

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
  "success" | "invalid_credentials" | "invalid_2fa_code";

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

// api/src/notifications/entities/notification.entity.ts — the in-app
// notification center, shared by regular users and admins alike (see that
// file's doc comment for why there's no separate "admin notification"
// shape). `type` stays a string here rather than a literal union so the
// frontend doesn't need a build-time change every time a backend trigger
// adds a new one — the UI only ever needs `title`/`body`/`link`/`read` to
// render a row.
export interface Notification {
  id: string;
  userId: string;
  type: string;
  title: string;
  body: string;
  link: string | null;
  read: boolean;
  createdAt: string;
}

export interface PaginatedNotifications {
  data: Notification[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

// api/src/advertisements/entities/advertisement.entity.ts — the
// self-service marketplace ad slot ("advertise your digital product or
// business"), sanitized (owner is the public user shape, same convention
// as Business.owner).
export type AdvertisementType = "digital_product" | "business";

export type AdvertisementReviewStatus =
  "draft" | "submitted_for_review" | "approved" | "rejected" | "suspended";

export interface Advertisement {
  id: string;
  owner: AuthUser | null;
  ownerUserId: string;
  type: AdvertisementType;
  title: string;
  description: string;
  images: string[];
  priceLabel: string | null;
  contactPhone: string | null;
  contactWhatsapp: string | null;
  contactEmail: string | null;
  externalLink: string | null;
  reviewStatus: AdvertisementReviewStatus;
  rejectionReason: string | null;
  submittedAt: string | null;
  reviewedAt: string | null;
  reviewedByUserId: string | null;
  createdAt: string;
  updatedAt: string;
}
