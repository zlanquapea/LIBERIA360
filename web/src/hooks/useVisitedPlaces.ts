'use client';

import { useCallback, useEffect, useState } from 'react';
import { useAuth } from './useAuth';
import { getMyVisitedPlaceIds, markVisited, unmarkVisited } from '@/lib/visited-places-api';

// The "Explorer" feature's account-only visited-places list — unlike
// useSavedPlaces, there's no device-local/anonymous state here (see
// VisitedPlace's doc comment): marking a place visited only ever makes
// sense once a traveler has an account to track progress against.
export function useVisitedPlaces() {
  const { token, ready } = useAuth();
  const [visitedPlaceIds, setVisitedPlaceIds] = useState<string[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!ready) return;
    if (!token) {
      setVisitedPlaceIds([]);
      setLoaded(true);
      return;
    }
    let cancelled = false;
    getMyVisitedPlaceIds(token).then(({ placeIds }) => {
      if (!cancelled) {
        setVisitedPlaceIds(placeIds);
        setLoaded(true);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [ready, token]);

  const toggle = useCallback(
    async (placeId: string) => {
      if (!token) return;
      const nowVisited = !visitedPlaceIds.includes(placeId);
      // Optimistic — mirrors useSavedPlaces' local-first update, then lets
      // the request settle in the background.
      setVisitedPlaceIds((prev) => (nowVisited ? [...prev, placeId] : prev.filter((id) => id !== placeId)));
      try {
        if (nowVisited) await markVisited(token, placeId);
        else await unmarkVisited(token, placeId);
      } catch {
        // Revert on failure so the UI never claims a state the server
        // doesn't have.
        setVisitedPlaceIds((prev) => (nowVisited ? prev.filter((id) => id !== placeId) : [...prev, placeId]));
      }
    },
    [token, visitedPlaceIds],
  );

  return { visitedPlaceIds, loaded, isVisited: (placeId: string) => visitedPlaceIds.includes(placeId), toggle };
}
