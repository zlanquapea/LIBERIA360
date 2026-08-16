import type {
  Activity,
  AggregateAnalytics,
  AuthUser,
  Business,
  County,
  CreateActivityInput,
  CreateBusinessAdminInput,
  CreatePlaceInput,
  Creator,
  Event,
  ModerationQueue,
  Place,
  SponsoredPlacement,
  UpdateActivityInput,
  UpdateBusinessAdminInput,
  UpdateCountyInput,
  UpdateEventInput,
  UpdatePlaceInput,
  VerificationStatus,
} from './types';
import { apiRequest, authHeader } from './http';

// Moderation (Tech Spec §7/§8)
export function getModerationQueue(token: string): Promise<ModerationQueue> {
  return apiRequest<ModerationQueue>('/admin/moderation-queue', { headers: authHeader(token) });
}

export function setPlaceVerification(token: string, placeId: string, status: VerificationStatus): Promise<Place> {
  return apiRequest<Place>(`/admin/places/${placeId}/verification`, {
    method: 'PATCH',
    headers: authHeader(token),
    body: JSON.stringify({ status }),
  });
}

export function setBusinessVerification(
  token: string,
  businessId: string,
  status: VerificationStatus,
): Promise<Business> {
  return apiRequest<Business>(`/admin/businesses/${businessId}/verification`, {
    method: 'PATCH',
    headers: authHeader(token),
    body: JSON.stringify({ status }),
  });
}

// Content management
export function createPlace(token: string, input: CreatePlaceInput): Promise<Place> {
  return apiRequest<Place>('/admin/places', { method: 'POST', headers: authHeader(token), body: JSON.stringify(input) });
}

export function updatePlace(token: string, id: string, input: UpdatePlaceInput): Promise<Place> {
  return apiRequest<Place>(`/admin/places/${id}`, {
    method: 'PATCH',
    headers: authHeader(token),
    body: JSON.stringify(input),
  });
}

export function createActivity(token: string, input: CreateActivityInput): Promise<Activity> {
  return apiRequest<Activity>('/admin/activities', {
    method: 'POST',
    headers: authHeader(token),
    body: JSON.stringify(input),
  });
}

export function updateActivity(token: string, id: string, input: UpdateActivityInput): Promise<Activity> {
  return apiRequest<Activity>(`/admin/activities/${id}`, {
    method: 'PATCH',
    headers: authHeader(token),
    body: JSON.stringify(input),
  });
}

export function createBusinessAdmin(token: string, input: CreateBusinessAdminInput): Promise<Business> {
  return apiRequest<Business>('/admin/businesses', {
    method: 'POST',
    headers: authHeader(token),
    body: JSON.stringify(input),
  });
}

export function updateBusinessAdmin(token: string, id: string, input: UpdateBusinessAdminInput): Promise<Business> {
  return apiRequest<Business>(`/admin/businesses/${id}`, {
    method: 'PATCH',
    headers: authHeader(token),
    body: JSON.stringify(input),
  });
}

export function updateEventAdmin(token: string, id: string, input: UpdateEventInput): Promise<Event> {
  return apiRequest<Event>(`/admin/events/${id}`, {
    method: 'PATCH',
    headers: authHeader(token),
    body: JSON.stringify(input),
  });
}

export function updateCountyAdmin(token: string, id: string, input: UpdateCountyInput): Promise<County> {
  return apiRequest<County>(`/admin/counties/${id}`, {
    method: 'PATCH',
    headers: authHeader(token),
    body: JSON.stringify(input),
  });
}

// Sponsored placements ("Featured this week" — Business Plan §8.3)
export function getAllSponsoredPlacements(token: string): Promise<SponsoredPlacement[]> {
  return apiRequest<SponsoredPlacement[]>('/sponsored-placements', { headers: authHeader(token) });
}

export function createSponsoredPlacement(
  token: string,
  input: { placeId: string; startDate: string; endDate: string },
): Promise<SponsoredPlacement> {
  return apiRequest<SponsoredPlacement>('/sponsored-placements', {
    method: 'POST',
    headers: authHeader(token),
    body: JSON.stringify(input),
  });
}

export function revokeSponsoredPlacement(token: string, id: string): Promise<void> {
  return apiRequest<void>(`/sponsored-placements/${id}`, { method: 'DELETE', headers: authHeader(token) });
}

// Featured creators
export function setCreatorFeatured(token: string, creatorId: string, featured: boolean): Promise<Creator> {
  return apiRequest<Creator>(`/creators/${creatorId}/featured`, {
    method: 'PATCH',
    headers: authHeader(token),
    body: JSON.stringify({ featured }),
  });
}

// B2B aggregate tourism analytics (Business Plan §8.4)
export function getAggregateAnalytics(token: string, limit?: number): Promise<AggregateAnalytics> {
  const query = limit ? `?limit=${limit}` : '';
  return apiRequest<AggregateAnalytics>(`/admin/analytics/aggregate${query}`, { headers: authHeader(token) });
}

// Team & Access — super admin only. See api/src/admin/admin-team.service.ts:
// the first self-service way to grant admin access (previously only a raw
// SQL UPDATE against the users table).
export function getTeamRoster(token: string): Promise<AuthUser[]> {
  return apiRequest<AuthUser[]>('/admin/team', { headers: authHeader(token) });
}

export function searchTeamMember(token: string, email: string): Promise<AuthUser> {
  return apiRequest<AuthUser>(`/admin/team/search?email=${encodeURIComponent(email)}`, {
    headers: authHeader(token),
  });
}

export function setTeamRoles(
  token: string,
  userId: string,
  roles: { isAdmin: boolean; isSuperAdmin: boolean },
): Promise<AuthUser> {
  return apiRequest<AuthUser>(`/admin/team/${userId}`, {
    method: 'PATCH',
    headers: authHeader(token),
    body: JSON.stringify(roles),
  });
}
