import type { ExplorerProgress, PublicExplorerProfile } from './types';
import { apiRequest, authHeader } from './http';

// The account-side "Explorer" feature — see VisitedPlace's own doc
// comment for why this is deliberately not named "Bucket List" (that
// name is already used by saved-places).

export function getMyVisitedPlaceIds(token: string): Promise<{ placeIds: string[] }> {
  return apiRequest<{ placeIds: string[] }>('/visited-places', {
    headers: authHeader(token),
  });
}

export function getExplorerProgress(token: string): Promise<ExplorerProgress> {
  return apiRequest<ExplorerProgress>('/visited-places/progress', {
    headers: authHeader(token),
  });
}

// Idempotent, same fire-and-forget contract as saveRemotePlace — a
// double-click or retried request can never error or duplicate a mark.
export function markVisited(token: string, placeId: string): Promise<void> {
  return apiRequest<void>(`/visited-places/${placeId}`, {
    method: 'POST',
    headers: authHeader(token),
  });
}

export function unmarkVisited(token: string, placeId: string): Promise<void> {
  return apiRequest<void>(`/visited-places/${placeId}`, {
    method: 'DELETE',
    headers: authHeader(token),
  });
}

// Public, 404s unless that account opted in via explorerProfilePublic.
export function getPublicExplorerProfile(userId: string): Promise<PublicExplorerProfile> {
  return apiRequest<PublicExplorerProfile>(`/explorers/${userId}`);
}
