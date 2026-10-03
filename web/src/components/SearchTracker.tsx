'use client';

import { useEffect } from 'react';
import { recordSearch } from '@/lib/analytics-api';

// Records a search once per distinct query, from the browser like every
// other analytics beacon. Renders nothing.
export function SearchTracker({ query }: { query: string | undefined }) {
  useEffect(() => {
    if (query) recordSearch(query);
  }, [query]);
  return null;
}
