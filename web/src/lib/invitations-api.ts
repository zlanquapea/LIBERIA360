import type {
  InvitableUser,
  InvitationPreview,
  InvitationSummary,
  ItineraryDetail,
  MyInvitationSummary,
} from './types';
import { apiRequest, authHeader } from './http';

export interface InviteeInput {
  userId?: string;
  email?: string;
}

// "People you may want to invite" (Section 7) — owner-only, scoped to
// this trip so results exclude anyone already a collaborator or already
// pending-invited.
export function searchInvitablePeople(
  token: string,
  itineraryId: string,
  q: string,
): Promise<InvitableUser[]> {
  return apiRequest<InvitableUser[]>(
    `/itineraries/${itineraryId}/invitations/search-people?q=${encodeURIComponent(q)}`,
    { headers: authHeader(token) },
  );
}

// One call, many invitees — each either a platform pick (userId) or a
// bare email address (Section 7's "allow multiple invitations in one flow").
export function createInvitations(
  token: string,
  itineraryId: string,
  invitees: InviteeInput[],
): Promise<InvitationSummary[]> {
  return apiRequest<InvitationSummary[]>(`/itineraries/${itineraryId}/invitations`, {
    method: 'POST',
    headers: authHeader(token),
    body: JSON.stringify({ invitees }),
  });
}

// The People/Participants panel's invitation list — owner-only.
export function listInvitations(token: string, itineraryId: string): Promise<InvitationSummary[]> {
  return apiRequest<InvitationSummary[]>(`/itineraries/${itineraryId}/invitations`, {
    headers: authHeader(token),
  });
}

export function resendInvitation(
  token: string,
  itineraryId: string,
  invitationId: string,
): Promise<InvitationSummary[]> {
  return apiRequest<InvitationSummary[]>(
    `/itineraries/${itineraryId}/invitations/${invitationId}/resend`,
    { method: 'POST', headers: authHeader(token) },
  );
}

export function cancelInvitation(
  token: string,
  itineraryId: string,
  invitationId: string,
): Promise<InvitationSummary[]> {
  return apiRequest<InvitationSummary[]>(
    `/itineraries/${itineraryId}/invitations/${invitationId}`,
    { method: 'DELETE', headers: authHeader(token) },
  );
}

// Public, unauthenticated — the /invite/[token] landing page reads this
// before the visitor has necessarily signed in or has an account at all.
export function getInvitationPreview(inviteToken: string): Promise<InvitationPreview> {
  return apiRequest<InvitationPreview>(`/invitations/token/${inviteToken}`);
}

export function acceptInvitationByToken(authToken: string, inviteToken: string): Promise<ItineraryDetail> {
  return apiRequest<ItineraryDetail>(`/invitations/token/${inviteToken}/accept`, {
    method: 'POST',
    headers: authHeader(authToken),
  });
}

export async function declineInvitationByToken(authToken: string, inviteToken: string): Promise<void> {
  await apiRequest<void>(`/invitations/token/${inviteToken}/decline`, {
    method: 'POST',
    headers: authHeader(authToken),
  });
}

// "My Invitations" — every trip invite currently open for this account
// (Section 5), reachable without the original emailed link/token.
export function listMyInvitations(authToken: string): Promise<MyInvitationSummary[]> {
  return apiRequest<MyInvitationSummary[]>('/invitations/mine', { headers: authHeader(authToken) });
}

export function acceptInvitationById(authToken: string, invitationId: string): Promise<ItineraryDetail> {
  return apiRequest<ItineraryDetail>(`/invitations/${invitationId}/accept`, {
    method: 'POST',
    headers: authHeader(authToken),
  });
}

export async function declineInvitationById(authToken: string, invitationId: string): Promise<void> {
  await apiRequest<void>(`/invitations/${invitationId}/decline`, {
    method: 'POST',
    headers: authHeader(authToken),
  });
}
