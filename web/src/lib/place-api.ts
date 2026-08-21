import type { Place, PlaceType, RecommendedVisitLength } from './types';
import { apiRequest, authHeader } from './http';

// Self-service place submission (a business owner listing a destination
// that isn't in the catalog yet) — mirrors ClaimBusinessInput in
// business-api.ts. Deliberately excludes slug/featured/reviewStatus: the
// backend generates the slug and starts every submission unlisted until an
// admin approves it (see CreatePlaceSubmissionDto).
export interface SubmitPlaceInput {
  name: string;
  description: string;
  type: PlaceType;
  categoryId: string;
  countyId: string;
  city: string;
  latitude: number;
  longitude: number;
  tags?: string[];
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
}

export function submitPlace(token: string, input: SubmitPlaceInput): Promise<Place> {
  return apiRequest<Place>('/places', {
    method: 'POST',
    headers: authHeader(token),
    body: JSON.stringify(input),
  });
}

// A submitter's own places regardless of review status — findAll/findBySlug
// are approved-only, so a pending or rejected submission is only reachable
// this way.
export function getMyPlaces(token: string): Promise<Place[]> {
  return apiRequest<Place[]>('/places/mine', { headers: authHeader(token) });
}

export type UpdateMyPlaceInput = Partial<SubmitPlaceInput>;

// Editing a submission after the fact. On a REJECTED place this
// automatically resubmits it for review (see PlacesService.updateMine) —
// the UI doesn't need a separate "resubmit" action.
export function updateMyPlace(token: string, id: string, input: UpdateMyPlaceInput): Promise<Place> {
  return apiRequest<Place>(`/places/${id}`, {
    method: 'PATCH',
    headers: authHeader(token),
    body: JSON.stringify(input),
  });
}
