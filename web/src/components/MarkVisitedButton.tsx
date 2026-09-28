'use client';

import Link from 'next/link';
import { MapPinIcon as MapPinOutline } from '@heroicons/react/24/outline';
import { MapPinIcon as MapPinSolid } from '@heroicons/react/24/solid';
import { useAuth } from '@/hooks/useAuth';
import { useVisitedPlaces } from '@/hooks/useVisitedPlaces';

// "Explorer" gamification — a sibling action to SaveButton, but
// account-only (see useVisitedPlaces' doc comment): a signed-out visitor
// sees a disabled tile pointing at /login instead of a working toggle,
// same treatment as PlaceKeyFacts' unclaimed "Book" tile.
export function MarkVisitedButton({ placeId, className = '' }: { placeId: string; className?: string }) {
  const { token, ready } = useAuth();
  const { isVisited, toggle } = useVisitedPlaces();
  const visited = isVisited(placeId);

  if (!ready) return null;

  if (!token) {
    return (
      <Link href="/login" className={className} title="Sign in to track the places you've visited.">
        <MapPinOutline aria-hidden className="h-5 w-5 text-slate-400" />
        Mark visited
      </Link>
    );
  }

  return (
    <button type="button" onClick={() => toggle(placeId)} aria-pressed={visited} className={className}>
      {visited ? (
        <MapPinSolid aria-hidden className="h-5 w-5 animate-pop text-emerald-600 dark:text-emerald-400" />
      ) : (
        <MapPinOutline aria-hidden className="h-5 w-5" />
      )}
      {visited ? 'Visited' : 'Mark visited'}
    </button>
  );
}
