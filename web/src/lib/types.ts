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

export interface PaginatedCreators {
  data: Creator[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
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
}
