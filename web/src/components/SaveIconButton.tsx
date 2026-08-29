'use client';

import { BookmarkIcon } from '@heroicons/react/24/outline';
import { BookmarkIcon as BookmarkIconSolid } from '@heroicons/react/24/solid';
import { useSavedPlaces } from '@/hooks/useSavedPlaces';
import { recordAnalyticsEvent } from '@/lib/analytics-api';

// Icon-only save toggle for the corner of a place card's image — same
// save/unsave mechanism as SaveButton (device-local, no account required),
// just the compact badge treatment a card thumbnail needs instead of a
// full labeled pill (SaveButton stays in use on the Destination Profile,
// where there's room for one). Always rendered as a SIBLING of the card's
// <Link>, never nested inside it — a <button> inside an <a> is invalid
// HTML — so unlike a typical "stop this click reaching the card" overlay
// button, no stopPropagation/preventDefault is needed either: a click here
// can't reach the anchor to trigger navigation in the first place.
export function SaveIconButton({
  slug,
  placeId,
  className = '',
}: {
  slug: string;
  placeId?: string;
  className?: string;
}) {
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
      aria-label={saved ? 'Remove from saved places' : 'Save this place'}
      className={`flex h-8 w-8 items-center justify-center rounded-full bg-white/90 text-slate-500 shadow-sm backdrop-blur-sm transition-colors active:scale-90 hover:bg-white hover:text-slate-700 dark:bg-slate-900/80 dark:text-slate-300 dark:hover:bg-slate-900 ${className}`}
    >
      {saved ? (
        <BookmarkIconSolid aria-hidden className="h-4 w-4 animate-pop text-gold-500" />
      ) : (
        <BookmarkIcon aria-hidden className="h-4 w-4" />
      )}
    </button>
  );
}
