import type {
  Activity,
  AggregateAnalytics,
  AnalyticsOverview,
  AuthUser,
  Business,
  County,
  Category,
  CreateActivityInput,
  CreateBusinessAdminInput,
  CreateCategoryInput,
  CreatePlaceInput,
  Creator,
  Event,
  ModerationQueue,
  PaginatedAdminActions,
  PaginatedLoginActivity,
  PaginatedUsers,
  Place,
  PlatformKpis,
  SecurityOverview,
  SponsoredPlacement,
  SystemStatus,
  UpdateActivityInput,
  UpdateBusinessAdminInput,
  UpdateCategoryInput,
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

// Super-admin only (the API's own SuperAdminGuard is the real
// enforcement) — deleting a whole catalog entity, not moderating a piece
// of content, so it sits above what a regular admin can do.
export function deletePlace(token: string, id: string): Promise<void> {
  return apiRequest<void>(`/admin/places/${id}`, { method: 'DELETE', headers: authHeader(token) });
}

export function createCategory(token: string, input: CreateCategoryInput): Promise<Category> {
  return apiRequest<Category>('/admin/categories', {
    method: 'POST',
    headers: authHeader(token),
    body: JSON.stringify(input),
  });
}

export function updateCategory(token: string, id: string, input: UpdateCategoryInput): Promise<Category> {
  return apiRequest<Category>(`/admin/categories/${id}`, {
    method: 'PATCH',
    headers: authHeader(token),
    body: JSON.stringify(input),
  });
}

export function deleteCategory(token: string, id: string): Promise<void> {
  return apiRequest<void>(`/admin/categories/${id}`, { method: 'DELETE', headers: authHeader(token) });
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

export function deleteActivity(token: string, id: string): Promise<void> {
  return apiRequest<void>(`/admin/activities/${id}`, { method: 'DELETE', headers: authHeader(token) });
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

export function deleteBusinessAdmin(token: string, id: string): Promise<void> {
  return apiRequest<void>(`/admin/businesses/${id}`, { method: 'DELETE', headers: authHeader(token) });
}

export function updateEventAdmin(token: string, id: string, input: UpdateEventInput): Promise<Event> {
  return apiRequest<Event>(`/admin/events/${id}`, {
    method: 'PATCH',
    headers: authHeader(token),
    body: JSON.stringify(input),
  });
}

// Moderation removal — see the "flaggedContent" section of the
// moderation queue below.
export function deleteEventAdmin(token: string, id: string): Promise<void> {
  return apiRequest<void>(`/admin/events/${id}`, { method: 'DELETE', headers: authHeader(token) });
}

export function deleteReviewAdmin(token: string, id: string): Promise<void> {
  return apiRequest<void>(`/admin/reviews/${id}`, { method: 'DELETE', headers: authHeader(token) });
}

export function updateCountyAdmin(token: string, id: string, input: UpdateCountyInput): Promise<County> {
  return apiRequest<County>(`/admin/counties/${id}`, {
    method: 'PATCH',
    headers: authHeader(token),
    body: JSON.stringify(input),
  });
}

export function deleteCountyAdmin(token: string, id: string): Promise<void> {
  return apiRequest<void>(`/admin/counties/${id}`, { method: 'DELETE', headers: authHeader(token) });
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

// Audit log — super admin only. See api/src/admin/admin-audit.service.ts.
export function getAuditLog(token: string, page = 1, limit = 20): Promise<PaginatedAdminActions> {
  return apiRequest<PaginatedAdminActions>(`/admin/audit-log?page=${page}&limit=${limit}`, {
    headers: authHeader(token),
  });
}

// Platform KPIs — super admin only. See api/src/admin/admin.service.ts's
// getPlatformKpis().
export function getPlatformKpis(token: string): Promise<PlatformKpis> {
  return apiRequest<PlatformKpis>('/admin/kpis', { headers: authHeader(token) });
}

// Security — super admin only. See api/src/security/login-activity.service.ts
// and api/src/admin/admin-security.controller.ts.
export function getLoginActivity(
  token: string,
  { page = 1, limit = 20, onlyFailed }: { page?: number; limit?: number; onlyFailed?: boolean } = {},
): Promise<PaginatedLoginActivity> {
  const query = new URLSearchParams({ page: String(page), limit: String(limit) });
  if (onlyFailed) query.set('onlyFailed', 'true');
  return apiRequest<PaginatedLoginActivity>(`/admin/security/login-activity?${query}`, {
    headers: authHeader(token),
  });
}

export function getSecurityOverview(token: string): Promise<SecurityOverview> {
  return apiRequest<SecurityOverview>('/admin/security/overview', { headers: authHeader(token) });
}

// Ends every active session on the target account immediately — doesn't
// require that account's password, unlike the self-service
// POST /auth/logout-all a user can call on themselves.
export function revokeUserSessions(token: string, userId: string): Promise<AuthUser> {
  return apiRequest<AuthUser>(`/admin/security/users/${userId}/revoke-sessions`, {
    method: 'POST',
    headers: authHeader(token),
  });
}

// Decision-driving analytics — any admin. See admin-analytics.service.ts's
// getOverview().
export function getAnalyticsOverview(token: string, days = 7): Promise<AnalyticsOverview> {
  return apiRequest<AnalyticsOverview>(`/admin/analytics/overview?days=${days}`, {
    headers: authHeader(token),
  });
}

// Users & Roles > Users — every account, super admin only. Distinct from
// getTeamRoster() (admins only).
export function getUsers(
  token: string,
  {
    page = 1,
    limit = 20,
    search,
    isAdmin,
  }: { page?: number; limit?: number; search?: string; isAdmin?: boolean } = {},
): Promise<PaginatedUsers> {
  const query = new URLSearchParams({ page: String(page), limit: String(limit) });
  if (search) query.set('search', search);
  if (isAdmin !== undefined) query.set('isAdmin', String(isAdmin));
  return apiRequest<PaginatedUsers>(`/admin/users?${query}`, { headers: authHeader(token) });
}

// System / Operations — super admin only.
export function getSystemStatus(token: string): Promise<SystemStatus> {
  return apiRequest<SystemStatus>('/admin/system/status', { headers: authHeader(token) });
}
