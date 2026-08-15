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

export interface PaginatedPlaces {
  data: Place[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

export interface PlacesQuery {
  category?: string;
  county?: string;
  tag?: string;
  type?: PlaceType;
  q?: string;
  sort?: 'featured' | 'rating' | 'distance' | 'name';
  page?: number;
  limit?: number;
}
