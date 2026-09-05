'use client';

import { BookmarkIcon } from '@heroicons/react/24/outline';
import { BookmarkIcon as BookmarkIconSolid } from '@heroicons/react/24/solid';
import { useSavedPlaces } from '@/hooks/useSavedPlaces';
import { recordAnalyticsEvent } from '@/lib/analytics-api';

// placeId is optional in the type only because a couple of call sites
// historically only had the slug; every real caller today passes it, and
// it's what lets toggle() both attribute a "save" analytics event
// (Tech Spec §3.3) and mirror the save/unsave to a signed-in visitor's
// account in the background (see useSavedPlaces' doc comment) — no id,
// neither happens, but the device-local save itself still works either way.
export function SaveButton({ slug, placeId, className = '' }: { slug: string; placeId?: string; className?: string }) {
  const { isSaved, toggle } = useSavedPlaces();
  const saved = isSaved(slug);

  function handleClick() {
    const nowSaved = toggle(slug, placeId);
    if (nowSaved && placeId) {
      recordAnalyticsEvent(placeId, 'save');
    }
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      aria-pressed={saved}
      className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium transition-all active:scale-95 ${
        saved ? 'border-transparent bg-gold-500 text-white' : 'border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:border-brand-500'
      } ${className}`}
    >
      {saved ? (
        <BookmarkIconSolid aria-hidden className="h-4 w-4 animate-pop" />
      ) : (
        <BookmarkIcon aria-hidden className="h-4 w-4" />
      )}
      {saved ? 'Saved' : 'Save'}
    </button>
  );
}
