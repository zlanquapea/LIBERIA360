import { apiRequest, authHeader } from './http';

// The account-side half of Saved / Bucket List (api/README.md's "Saved
// Places" section) — see lib/saved-places.ts's doc comment for the full
// story. Save/unsave calls are fire-and-forget, same shape as
// analytics-api.ts's recordAnalyticsEvent: the device-local toggle is
// already the source of truth for the UI the instant it happens, so a
// dropped or failed background sync call should never surface an error or
// revert what the visitor just did — it'll just try again next login via
// syncSavedPlaces.

export function saveRemotePlace(token: string, placeId: string): void {
  apiRequest(`/saved-places/${placeId}`, {
    method: 'POST',
    headers: authHeader(token),
  }).catch(() => {
    /* best-effort — the device-local save already happened */
  });
}

export function unsaveRemotePlace(token: string, placeId: string): void {
  apiRequest(`/saved-places/${placeId}`, {
    method: 'DELETE',
    headers: authHeader(token),
  }).catch(() => {
    /* best-effort — the device-local unsave already happened */
  });
}

// Called once per login (useSavedPlaces' merge effect) with the device's
// local saved-slugs list at the time — folds them into the account and
// returns the full merged list, so the caller can overwrite the local
// cache with the authoritative copy. Unlike the fire-and-forget calls
// above, the caller needs this result (there's a local list to reconcile),
// so failures propagate for it to catch and just keep the local list as-is.
export function syncSavedPlaces(token: string, slugs: string[]): Promise<{ slugs: string[] }> {
  return apiRequest<{ slugs: string[] }>('/saved-places/sync', {
    method: 'POST',
    headers: authHeader(token),
    body: JSON.stringify({ slugs }),
  });
}
