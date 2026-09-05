'use client';

import { useCallback, useEffect, useState } from 'react';
import { useAuth } from './useAuth';
import {
  getSavedSlugs,
  hasSyncedSavedPlacesForUser,
  markSavedPlacesSyncedForUser,
  setSavedSlugs,
  subscribeToSavedPlaces,
  toggleSavedPlace,
} from '@/lib/saved-places';
import { saveRemotePlace, syncSavedPlaces, unsaveRemotePlace } from '@/lib/saved-places-api';

export function useSavedPlaces() {
  // Starts empty so server-rendered and first-client-render HTML match
  // (localStorage doesn't exist on the server) — populated in useEffect.
  const [savedSlugs, setSlugs] = useState<string[]>([]);
  const { user, token, ready } = useAuth();

  useEffect(() => {
    setSlugs(getSavedSlugs());
    return subscribeToSavedPlaces(() => setSlugs(getSavedSlugs()));
  }, []);

  // Cross-device sync (Sep 5, 2026): once per login, fold whatever this
  // device saved before/without an account into the now-signed-in
  // account, then overwrite the local cache with the merged, authoritative
  // result — see lib/saved-places.ts's doc comment for why overwriting
  // (rather than only ever unioning) is what keeps a shared device from
  // leaking one account's saves into the next one that signs in on it.
  useEffect(() => {
    if (!ready || !user || !token) return;
    if (hasSyncedSavedPlacesForUser(user.id)) return;
    markSavedPlacesSyncedForUser(user.id);
    syncSavedPlaces(token, getSavedSlugs())
      .then(({ slugs }) => setSavedSlugs(slugs))
      .catch(() => {
        // Sync failed (offline, server hiccup) — the device keeps working
        // off its own local list; nothing lost, just not yet merged. Allow
        // a retry on the next mount/navigation rather than latching a
        // permanent failure for this login.
        markSavedPlacesSyncedForUser(null);
      });
  }, [ready, user, token]);

  const toggle = useCallback(
    (slug: string, placeId?: string) => {
      const nowSaved = toggleSavedPlace(slug);
      // Mirror to the account in the background when signed in — the
      // local toggle above is already the source of truth for the UI, so
      // this never blocks or can fail the toggle itself. A guest visitor
      // (or a call site with no placeId to hand) just gets the
      // device-local behavior, same as before this feature existed.
      if (token && placeId) {
        if (nowSaved) saveRemotePlace(token, placeId);
        else unsaveRemotePlace(token, placeId);
      }
      return nowSaved;
    },
    [token],
  );

  return { savedSlugs, isSaved: (slug: string) => savedSlugs.includes(slug), toggle };
}
