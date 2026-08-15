'use client';

import { useSavedPlaces } from '@/hooks/useSavedPlaces';
import { recordAnalyticsEvent } from '@/lib/analytics-api';

// placeId is optional because most callers (PlaceCard grids) only have the
// slug-keyed localStorage save state to toggle; the Destination Profile is
// the one place that also has the id to attribute a "save" analytics event
// to (Tech Spec §3.3) — no id, no event, save still works either way.
export function SaveButton({ slug, placeId, className = '' }: { slug: string; placeId?: string; className?: string }) {
  const { isSaved, toggle } = useSavedPlaces();
  const saved = isSaved(slug);

  function handleClick() {
    const nowSaved = toggle(slug);
    if (nowSaved && placeId) {
      recordAnalyticsEvent(placeId, 'save');
    }
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      aria-pressed={saved}
      className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium transition ${
        saved ? 'border-transparent bg-gold-500 text-white' : 'border-slate-300 text-slate-700 hover:border-brand-500'
      } ${className}`}
    >
      <span aria-hidden>{saved ? '🔖' : '📑'}</span>
      {saved ? 'Saved' : 'Save'}
    </button>
  );
}
