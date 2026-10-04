'use client';

import { useSnap } from './SnapBurst';
import { BookmarkIcon } from '@heroicons/react/24/outline';
import { BookmarkIcon as BookmarkIconSolid } from '@heroicons/react/24/solid';
import { useSavedPlaces } from '@/hooks/useSavedPlaces';
import { recordAnalyticsEvent } from '@/lib/analytics-api';

// Icon-only save toggle for the corner of a place card's image — same
// save/unsave mechanism as SaveButton (device-local first, mirrored to a
// signed-in visitor's account in the background — see useSavedPlaces),
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
  tone = 'solid',
}: {
  slug: string;
  placeId?: string;
  className?: string;
  /** `glass` sits over a full-bleed photo. */
  tone?: 'solid' | 'glass';
}) {
  const { isSaved, toggle } = useSavedPlaces();
  const saved = isSaved(slug);
  const { snap, burst } = useSnap();

  function handleClick() {
    const nowSaved = toggle(slug, placeId);
    if (nowSaved) snap();
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
      className={`relative flex items-center justify-center rounded-full transition-[background-color,transform] active:scale-90 ${
        tone === 'glass'
          ? 'h-9 w-9 bg-black/25 text-white ring-1 ring-white/30 backdrop-blur-md before:absolute before:-inset-1 before:content-[""] hover:bg-black/45'
          : 'h-8 w-8 bg-white/90 text-slate-500 shadow-sm backdrop-blur-sm hover:bg-white hover:text-slate-700 dark:bg-slate-900/80 dark:text-slate-300 dark:hover:bg-slate-900'
      } ${className}`}
    >
      {saved ? (
        <BookmarkIconSolid aria-hidden className={`h-4 w-4 animate-pop ${tone === 'glass' ? 'text-gold-400' : 'text-gold-500'}`} />
      ) : (
        <BookmarkIcon aria-hidden className={tone === 'glass' ? 'h-[18px] w-[18px]' : 'h-4 w-4'} />
      )}
      {burst}
    </button>
  );
}
