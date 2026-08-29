import type {
  Activity,
  Advertisement,
  AssistantReviewQueue,
  AdvertisementReviewStatus,
  AggregateAnalytics,
  AnalyticsOverview,
  ApplicationSettings,
  AuthUser,
  Business,
  BulkReviewResult,
  BusinessContent,
  BusinessContentStatus,
  BusinessReviewStatus,
  BusinessType,
  County,
  Category,
  CreateActivityInput,
  CreateBusinessAdminInput,
  CreateCategoryInput,
  CreatePlaceInput,
  Creator,
  CreatorVerificationStatus,
  Event,
  EventReviewStatus,
  ModerationQueue,
  PaginatedAdminActions,
  PaginatedBusinesses,
  PaginatedLoginActivity,
  PaginatedPlaces,
  PaginatedUsers,
  Place,
  PlaceDataQualityIssue,
  PlaceReviewStatus,
  PlatformKpis,
  SecurityOverview,
  SponsoredPlacement,
  SystemStatus,
  UpdateActivityInput,
  UpdateApplicationSettingsInput,
  UpdateBusinessAdminInput,
  UpdateCategoryInput,
  UpdateCountyInput,
  UpdateEventInput,
  UpdatePlaceInput,
  VerificationStatus,
} from './types';
import { apiRequest, authHeader } from './http';

export function getAssistantReviewQueue(token: string): Promise<AssistantReviewQueue> {
  return apiRequest<AssistantReviewQueue>('/admin/assistant-review?limit=250', {
    headers: authHeader(token),
  });
}

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

// Approve/reject one business-authored content item — mirrors
// setBusinessReviewStatus's shape, one level down (a single post, not
// the whole listing).
export function setBusinessContentReviewStatus(
  token: string,
  contentId: string,
  status: BusinessContentStatus,
  reason?: string,
): Promise<BusinessContent> {
  return apiRequest<BusinessContent>(`/admin/business-content/${contentId}/review-status`, {
    method: 'PATCH',
    headers: authHeader(token),
    body: JSON.stringify({ status, reason }),
  });
}

// Bulk sibling of setBusinessContentReviewStatus — see
// bulkSetBusinessReviewStatus.
export function bulkSetBusinessContentReviewStatus(
  token: string,
  ids: string[],
  status: BusinessContentStatus,
  reason?: string,
): Promise<BulkReviewResult> {
  return apiRequest<BulkReviewResult>('/admin/business-content/bulk-review-status', {
    method: 'POST',
    headers: authHeader(token),
    body: JSON.stringify({ ids, status, reason }),
  });
}

// The publish/moderation lifecycle — approve/reject/request changes
// (under_review)/suspend — distinct from setBusinessVerification's trust
// badge above. `reason` is the rejection reason, reviewer guidance, or
// suspension reason depending on `status` — see BusinessReviewStatus's
// doc comment on the backend.
export function setBusinessReviewStatus(
  token: string,
  businessId: string,
  status: BusinessReviewStatus,
  reason?: string,
): Promise<Business> {
  return apiRequest<Business>(`/admin/businesses/${businessId}/review-status`, {
    method: 'PATCH',
    headers: authHeader(token),
    body: JSON.stringify({ status, reason }),
  });
}

// Bulk sibling of setBusinessReviewStatus — up to 50 ids at once. See
// BulkReviewResult's doc comment for why the response is a
// succeeded/failed split rather than all-or-nothing.
export function bulkSetBusinessReviewStatus(
  token: string,
  ids: string[],
  status: BusinessReviewStatus,
  reason?: string,
): Promise<BulkReviewResult> {
  return apiRequest<BulkReviewResult>('/admin/businesses/bulk-review-status', {
    method: 'POST',
    headers: authHeader(token),
    body: JSON.stringify({ ids, status, reason }),
  });
}

// The publish/moderation lifecycle for a self-submitted place — approve/
// reject/request changes (under_review)/suspend — distinct from
// setPlaceVerification's trust badge above. `reason` is the rejection
// reason, reviewer guidance, or suspension reason depending on `status`,
// same shape as setBusinessReviewStatus. This is what turns a pending
// submission into a live, public catalog entry.
export function setPlaceReviewStatus(
  token: string,
  placeId: string,
  status: PlaceReviewStatus,
  reason?: string,
): Promise<Place> {
  return apiRequest<Place>(`/admin/places/${placeId}/review-status`, {
    method: 'PATCH',
    headers: authHeader(token),
    body: JSON.stringify({ status, reason }),
  });
}

// Bulk sibling of setPlaceReviewStatus — see bulkSetBusinessReviewStatus.
export function bulkSetPlaceReviewStatus(
  token: string,
  ids: string[],
  status: PlaceReviewStatus,
  reason?: string,
): Promise<BulkReviewResult> {
  return apiRequest<BulkReviewResult>('/admin/places/bulk-review-status', {
    method: 'POST',
    headers: authHeader(token),
    body: JSON.stringify({ ids, status, reason }),
  });
}

// Every advertisement regardless of review status — an admin's own
// management view, so an already-approved ad can still be found and
// suspended. Distinct from moderation-queue's pendingAdvertisements
// (SUBMITTED_FOR_REVIEW-only slice).
export function getAllAdvertisements(token: string): Promise<Advertisement[]> {
  return apiRequest<Advertisement[]>('/admin/advertisements', { headers: authHeader(token) });
}

// The publish/moderation lifecycle for a self-submitted advertisement —
// approve/reject/suspend — same shape as setPlaceReviewStatus/
// setBusinessReviewStatus.
export function setAdvertisementReviewStatus(
  token: string,
  id: string,
  status: AdvertisementReviewStatus,
  reason?: string,
): Promise<Advertisement> {
  return apiRequest<Advertisement>(`/admin/advertisements/${id}/review-status`, {
    method: 'PATCH',
    headers: authHeader(token),
    body: JSON.stringify({ status, reason }),
  });
}

// Every place regardless of review status — the admin Places list, unlike
// the public catalog (getPlaces in api.ts), which is approved-only. Needed
// so a pending/rejected/suspended submission shows up for review at all.
export function listPlacesAdmin(
  token: string,
  {
    page = 1,
    limit = 20,
    search,
    reviewStatus,
  }: {
    page?: number;
    limit?: number;
    search?: string;
    reviewStatus?: PlaceReviewStatus;
  } = {},
): Promise<PaginatedPlaces> {
  const query = new URLSearchParams({ page: String(page), limit: String(limit) });
  if (search) query.set('search', search);
  if (reviewStatus) query.set('reviewStatus', reviewStatus);
  return apiRequest<PaginatedPlaces>(`/admin/places?${query}`, { headers: authHeader(token) });
}

// Single-place admin fetch by id, works regardless of review status — what
// the review panel loads (it navigates by id, not the public findBySlug's
// approved-only slug lookup), and includes the `owner` relation the public
// endpoints omit.
export function getPlaceAdmin(token: string, id: string): Promise<Place> {
  return apiRequest<Place>(`/admin/places/${id}`, { headers: authHeader(token) });
}

// Product review readout (Aug 22, 2026)'s "editorial QA + automated
// record checks" — flags places with a slug/name mismatch, no photos, or
// a missing/placeholder description. See
// AdminContentService.auditPlaceDataQuality for the exact checks.
export function getPlaceDataQuality(token: string): Promise<PlaceDataQualityIssue[]> {
  return apiRequest<PlaceDataQualityIssue[]>('/admin/places/data-quality', { headers: authHeader(token) });
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

// Every business regardless of review status — the admin Business
// Management list, unlike the public directory (getBusinesses in api.ts),
// which is approved-only.
export function listBusinessesAdmin(
  token: string,
  {
    page = 1,
    limit = 20,
    search,
    reviewStatus,
    type,
    reportedOnly,
  }: {
    page?: number;
    limit?: number;
    search?: string;
    reviewStatus?: BusinessReviewStatus;
    type?: BusinessType;
    reportedOnly?: boolean;
  } = {},
): Promise<PaginatedBusinesses> {
  const query = new URLSearchParams({ page: String(page), limit: String(limit) });
  if (search) query.set('search', search);
  if (reviewStatus) query.set('reviewStatus', reviewStatus);
  if (type) query.set('type', type);
  if (reportedOnly) query.set('reportedOnly', 'true');
  return apiRequest<PaginatedBusinesses>(`/admin/businesses?${query}`, { headers: authHeader(token) });
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

// Every event regardless of review status — the admin events management
// table, unlike the public GET /events (approved-only). Distinct from
// moderation-queue's pendingEvents (PENDING-only slice). Mirrors
// getAllAdvertisements.
export function getAllEventsAdmin(token: string): Promise<Event[]> {
  return apiRequest<Event[]>('/admin/events', { headers: authHeader(token) });
}

// The approve/reject decision on a self-submitted event — mirrors
// setAdvertisementReviewStatus.
export function setEventReviewStatus(
  token: string,
  id: string,
  status: EventReviewStatus,
  reason?: string,
): Promise<Event> {
  return apiRequest<Event>(`/admin/events/${id}/review-status`, {
    method: 'PATCH',
    headers: authHeader(token),
    body: JSON.stringify({ status, reason }),
  });
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

export function setCreatorVerification(
  token: string,
  creatorId: string,
  status: CreatorVerificationStatus,
): Promise<Creator> {
  return apiRequest<Creator>(`/admin/creators/${creatorId}/verification`, {
    method: 'PATCH',
    headers: authHeader(token),
    body: JSON.stringify({ status }),
  });
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

// Creates a brand-new admin/super-admin account (no existing registration
// required) and emails them a set-password link. See
// api/src/admin/admin-team.service.ts's createAdmin().
export function createAdmin(
  token: string,
  input: { name: string; email: string; isSuperAdmin: boolean },
): Promise<AuthUser> {
  return apiRequest<AuthUser>('/admin/team', {
    method: 'POST',
    headers: authHeader(token),
    body: JSON.stringify(input),
  });
}

// Re-sends a still-pending invite (someone who hasn't set a password yet)
// with a fresh set-password link. See admin-team.service.ts's
// resendInvite() — refuses once the account is activated.
export function resendTeamInvite(token: string, userId: string): Promise<AuthUser> {
  return apiRequest<AuthUser>(`/admin/team/${userId}/resend-invite`, {
    method: 'POST',
    headers: authHeader(token),
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

// Sends a real test email to the calling super admin's own address and
// reports whether it actually delivered — the concrete "does this work or
// not" check behind the mail diagnostics on the same page.
export function sendTestEmail(token: string): Promise<{ success: boolean; error: string | null }> {
  return apiRequest<{ success: boolean; error: string | null }>('/admin/system/test-email', {
    method: 'POST',
    headers: authHeader(token),
  });
}

// Settings > Application — super admin only. The moderation/alerting
// thresholds AdminService and LoginActivityService now read from a real
// store instead of a hardcoded constant. See admin-settings.controller.ts.
export function getApplicationSettings(token: string): Promise<ApplicationSettings> {
  return apiRequest<ApplicationSettings>('/admin/settings/application', { headers: authHeader(token) });
}

export function updateApplicationSettings(
  token: string,
  input: UpdateApplicationSettingsInput,
): Promise<ApplicationSettings> {
  return apiRequest<ApplicationSettings>('/admin/settings/application', {
    method: 'PATCH',
    headers: authHeader(token),
    body: JSON.stringify(input),
  });
}
