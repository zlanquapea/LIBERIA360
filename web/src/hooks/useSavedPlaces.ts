'use client';

import { useCallback, useEffect, useState } from 'react';
import { getSavedSlugs, subscribeToSavedPlaces, toggleSavedPlace } from '@/lib/saved-places';

export function useSavedPlaces() {
  // Starts empty so server-rendered and first-client-render HTML match
  // (localStorage doesn't exist on the server) — populated in useEffect.
  const [savedSlugs, setSavedSlugs] = useState<string[]>([]);

  useEffect(() => {
    setSavedSlugs(getSavedSlugs());
    return subscribeToSavedPlaces(() => setSavedSlugs(getSavedSlugs()));
  }, []);

  const toggle = useCallback((slug: string) => {
    toggleSavedPlace(slug);
  }, []);

  return { savedSlugs, isSaved: (slug: string) => savedSlugs.includes(slug), toggle };
}
