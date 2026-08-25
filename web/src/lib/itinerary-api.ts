import type { AuthUser, BudgetBand, Itinerary, ItineraryDetail, TripPreviewResponse } from './types';
import { apiRequest, authHeader } from './http';

export interface GenerateTripInput {
  durationDays: number;
  startDate?: string;
  interests: string[];
  budgetBand: BudgetBand;
  // Optional starting point (must be given together, or not at all) — the
  // route is built outward from Monrovia's center when omitted, same as
  // before this existed.
  startLat?: number;
  startLng?: number;
  title?: string;
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

export function generateTrip(token: string, input: GenerateTripInput): Promise<ItineraryDetail> {
  return apiRequest<ItineraryDetail>('/itineraries', {
    method: 'POST',
    headers: authHeader(token),
    body: JSON.stringify(input),
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
