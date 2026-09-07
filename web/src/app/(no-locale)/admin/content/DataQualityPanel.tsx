'use client';

import { useEffect, useState } from 'react';
import { ExclamationTriangleIcon } from '@heroicons/react/24/outline';
import { getPlaceDataQuality } from '@/lib/admin-api';
import type { PlaceDataQualityIssue } from '@/lib/types';

// Product review readout (Aug 22, 2026), "editorial QA + automated record
// checks" — a collapsed-by-default panel above the Places table surfacing
// the exact class of defect that prompted this (a listing served from a
// slug that named a different place entirely), plus missing photos and
// placeholder descriptions. Fetches once on mount rather than polling —
// this is a small catalog reviewed by hand, not a live health check.
export function DataQualityPanel({ token, onSelectPlace }: { token: string; onSelectPlace: (id: string) => void }) {
  const [issues, setIssues] = useState<PlaceDataQualityIssue[] | null>(null);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    getPlaceDataQuality(token).then(setIssues);
  }, [token]);

  if (!issues || issues.length === 0) return null;

  return (
    <div className="rounded-xl border border-amber-300 bg-amber-50/60 dark:border-amber-800 dark:bg-amber-900/20">
      <button
        type="button"
        onClick={() => setExpanded((e) => !e)}
        className="flex w-full items-center justify-between gap-2 px-4 py-3 text-left"
      >
        <span className="flex items-center gap-2 text-sm font-semibold text-amber-800 dark:text-amber-200">
          <ExclamationTriangleIcon aria-hidden className="h-4 w-4 shrink-0" />
          {issues.length} place{issues.length === 1 ? '' : 's'} need attention
        </span>
        <span className="text-xs font-medium text-amber-700 dark:text-amber-300">{expanded ? 'Hide' : 'Show'}</span>
      </button>
      {expanded && (
        <ul className="flex flex-col gap-2 border-t border-amber-200 px-4 py-3 dark:border-amber-800">
          {issues.map(({ place, issues: placeIssues }) => (
            <li key={place.id}>
              <button
                type="button"
                onClick={() => onSelectPlace(place.id)}
                className="text-left text-sm font-medium text-slate-900 hover:underline dark:text-slate-50"
              >
                {place.name}
              </button>
              <ul className="mt-0.5 flex flex-col gap-0.5 text-xs text-slate-600 dark:text-slate-300">
                {placeIssues.map((issue) => (
                  <li key={issue}>• {issue}</li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
