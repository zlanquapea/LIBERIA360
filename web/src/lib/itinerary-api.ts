import type { AuthUser, BudgetBand, Itinerary, ItineraryDetail } from './types';
import { apiRequest, authHeader } from './http';

export interface GenerateTripInput {
  durationDays: number;
  startDate?: string;
  interests: string[];
  budgetBand: BudgetBand;
  title?: string;
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
