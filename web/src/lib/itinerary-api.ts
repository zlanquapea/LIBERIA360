import type {
  AuthUser,
  BudgetBand,
  Itinerary,
  ItineraryDetail,
  PublicTripDetail,
  PublicTripSummary,
  RestrictedTripPreview,
  TripJoinRequestStatus,
  TripJoinRequestSummary,
  TripPreviewResponse,
  TripVisibility,
} from './types';
import { apiRequest, authHeader } from './http';

export interface GenerateTripInput {
  durationDays: number;
  startDate?: string;
  endDate?: string;
  interests: string[];
  budgetBand: BudgetBand;
  // Optional starting point (must be given together, or not at all) — the
  // route is built outward from Monrovia's center when omitted, same as
  // before this existed.
  startLat?: number;
  startLng?: number;
  title?: string;
  // Social travel experience (Aug 2026 spec) — all optional here since
  // POST /itineraries/preview (the only caller that leaves them out)
  // needs none of them; CreateTripInput below requires the three that
  // matter for an actually-saved trip.
  destinationPlaceId?: string;
  visibility?: TripVisibility;
  description?: string;
  coverImage?: string;
}

// POST /itineraries — every trip must have a name, a real catalog
// destination, and a deliberate public/private choice before it can be
// created (Sections 1-3 of the Aug 2026 spec), unlike the preview-only
// GenerateTripInput above.
export interface CreateTripInput extends GenerateTripInput {
  title: string;
  destinationPlaceId: string;
  visibility: TripVisibility;
}

// No token param, deliberately — guest-first trip planning (product review
// readout, Aug 22, 2026) lets a visitor see a real generated route with no
// account at all. `generateTrip` below is what "save this" turns into once
// they do log in, called again with the same inputs.
export function previewTrip(input: GenerateTripInput): Promise<TripPreviewResponse> {
  return apiRequest<TripPreviewResponse>('/itineraries/preview', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export interface GenerateWeekendInput {
  startLat: number;
  startLng: number;
  maxTravelTimeMinutes: number;
  interests: string[];
  budgetBand: BudgetBand;
  durationDays?: number;
}

export function generateTrip(token: string, input: CreateTripInput): Promise<ItineraryDetail> {
  return apiRequest<ItineraryDetail>('/itineraries', {
    method: 'POST',
    headers: authHeader(token),
    body: JSON.stringify(input),
  });
}

export interface PaginatedPublicTrips {
  data: PublicTripSummary[];
  meta: { total: number; page: number; limit: number; totalPages: number };
}

// "Trips You Can Join" (Section 5/17) — unauthenticated by design, a
// visitor with no account should be able to browse these same as anyone.
export function getPublicTrips(params: { destinationPlaceId?: string; page?: number; limit?: number } = {}): Promise<PaginatedPublicTrips> {
  const query = new URLSearchParams();
  if (params.destinationPlaceId) query.set('destinationPlaceId', params.destinationPlaceId);
  if (params.page) query.set('page', String(params.page));
  if (params.limit) query.set('limit', String(params.limit));
  const qs = query.toString();
  return apiRequest<PaginatedPublicTrips>(`/itineraries/public${qs ? `?${qs}` : ''}`);
}

// A public trip's basic-info view — what a stranger (signed in or not)
// gets. For a real but PRIVATE trip this resolves to RestrictedTripPreview
// instead of throwing, so a shared private link can render "this is a
// private trip" rather than a bare error — see that type's doc comment.
export function getPublicTrip(id: string): Promise<PublicTripDetail | RestrictedTripPreview> {
  return apiRequest<PublicTripDetail | RestrictedTripPreview>(`/itineraries/public/${id}`);
}

export function requestToJoinTrip(token: string, itineraryId: string): Promise<{ status: TripJoinRequestStatus }> {
  return apiRequest<{ status: TripJoinRequestStatus }>(`/itineraries/${itineraryId}/join-requests`, {
    method: 'POST',
    headers: authHeader(token),
  });
}

// Owner-only: the join-request queue.
export function listJoinRequests(token: string, itineraryId: string): Promise<TripJoinRequestSummary[]> {
  return apiRequest<TripJoinRequestSummary[]>(`/itineraries/${itineraryId}/join-requests`, {
    headers: authHeader(token),
  });
}

export function approveJoinRequest(token: string, itineraryId: string, requestId: string): Promise<TripJoinRequestSummary[]> {
  return apiRequest<TripJoinRequestSummary[]>(`/itineraries/${itineraryId}/join-requests/${requestId}/approve`, {
    method: 'POST',
    headers: authHeader(token),
  });
}

export function declineJoinRequest(token: string, itineraryId: string, requestId: string): Promise<TripJoinRequestSummary[]> {
  return apiRequest<TripJoinRequestSummary[]>(`/itineraries/${itineraryId}/join-requests/${requestId}/decline`, {
    method: 'POST',
    headers: authHeader(token),
  });
}

// Owner-only, one-way — see Itinerary.cancelledAt's doc comment on the backend.
export function cancelTrip(token: string, itineraryId: string): Promise<ItineraryDetail> {
  return apiRequest<ItineraryDetail>(`/itineraries/${itineraryId}/cancel`, {
    method: 'POST',
    headers: authHeader(token),
  });
}

export function generateWeekend(token: string, input: GenerateWeekendInput): Promise<ItineraryDetail> {
  return apiRequest<ItineraryDetail>('/itineraries/weekend', {
    method: 'POST',
    headers: authHeader(token),
    body: JSON.stringify(input),
  });
}

export function getMyItineraries(token: string): Promise<Itinerary[]> {
  return apiRequest<Itinerary[]>('/itineraries', { headers: authHeader(token) });
}

export function getItinerary(token: string, id: string): Promise<ItineraryDetail> {
  return apiRequest<ItineraryDetail>(`/itineraries/${id}`, { headers: authHeader(token) });
}

// Trips someone else invited this user onto as a collaborator — the other
// half of "My Trips" alongside getMyItineraries.
export function getSharedWithMe(token: string): Promise<Itinerary[]> {
  return apiRequest<Itinerary[]>('/itineraries/shared-with-me', { headers: authHeader(token) });
}

// Inviting is now handled by lib/invitations-api.ts's pending invite
// flow (search-and-pick or invite-by-email, with accept/decline) instead
// of adding a collaborator immediately — see TripInvitation's doc comment.
export function removeCollaborator(token: string, itineraryId: string, userId: string): Promise<AuthUser[]> {
  return apiRequest<AuthUser[]>(`/itineraries/${itineraryId}/collaborators/${userId}`, {
    method: 'DELETE',
    headers: authHeader(token),
  });
}

// Owner or any collaborator can rename — shared planning metadata, not
// an ownership-only action (same tier as editing a stop's notes).
export function renameItinerary(token: string, itineraryId: string, title: string): Promise<ItineraryDetail> {
  return apiRequest<ItineraryDetail>(`/itineraries/${itineraryId}`, {
    method: 'PATCH',
    headers: authHeader(token),
    body: JSON.stringify({ title }),
  });
}

// Owner-only, permanent — deletes the trip and everyone's access to it.
export async function deleteItinerary(token: string, itineraryId: string): Promise<void> {
  await apiRequest<void>(`/itineraries/${itineraryId}`, {
    method: 'DELETE',
    headers: authHeader(token),
  });
}

export interface AddStopInput {
  placeId: string;
  day: number;
  notes?: string;
}

export function addItineraryStop(token: string, itineraryId: string, input: AddStopInput): Promise<ItineraryDetail> {
  return apiRequest<ItineraryDetail>(`/itineraries/${itineraryId}/stops`, {
    method: 'POST',
    headers: authHeader(token),
    body: JSON.stringify(input),
  });
}

export function updateItineraryStop(
  token: string,
  itineraryId: string,
  placeId: string,
  notes: string,
): Promise<ItineraryDetail> {
  return apiRequest<ItineraryDetail>(`/itineraries/${itineraryId}/stops/${placeId}`, {
    method: 'PATCH',
    headers: authHeader(token),
    body: JSON.stringify({ notes }),
  });
}

export function removeItineraryStop(token: string, itineraryId: string, placeId: string): Promise<ItineraryDetail> {
  return apiRequest<ItineraryDetail>(`/itineraries/${itineraryId}/stops/${placeId}`, {
    method: 'DELETE',
    headers: authHeader(token),
  });
}
