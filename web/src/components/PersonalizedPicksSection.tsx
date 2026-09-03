'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { ArrowRightIcon } from '@heroicons/react/24/outline';
import { SparklesIcon } from '@heroicons/react/24/solid';
import { useAuth } from '@/hooks/useAuth';
import { getPlaces } from '@/lib/api';
import type { Place, VerificationStatus } from '@/lib/types';
import { PlaceCardCompact } from './PlaceCardCompact';

// "Make it amazing" pass, item 2/5: the signup form has collected
// traveler-type and interests (category slugs, see InterestChips) since
// task #48/#49, but nothing on the app actually reads them back — every
// visitor sees the exact same home page regardless of what they told us
// they care about. This is the smallest real use of that data: a "For
// you" rail of places drawn from the visitor's own chosen interest
// categories, sitting alongside Featured Places rather than the raw
// discovery sections below the "Trending places" divider (see page.tsx's
// own comment on that divider) — this is curated *for this specific
// visitor*, not organic catalog activity.
//
// A client component, not a server-fetched section, because auth state on
// this app lives entirely in localStorage (see account/page.tsx's own
// doc comment) — the server-rendered Home has no way to know who's
// visiting. Renders nothing at all for a signed-out visitor or a
// signed-in one with no interests set, so this never costs anonymous
// traffic (the overwhelming majority of visits) so much as a layout
// shift: `null` before the client-side check resolves, `null` again once
// it resolves to "nothing to show."
const PICKS_LIMIT = 8;
const MAX_INTERESTS_QUERIED = 3;

export function PersonalizedPicksSection({
  businessVerificationByPlaceId,
}: {
  businessVerificationByPlaceId: Map<string, VerificationStatus | undefined>;
}) {
  const { user, ready } = useAuth();
  const [places, setPlaces] = useState<Place[] | null>(null);

  useEffect(() => {
    if (!ready) return;
    const interests = user?.interests ?? [];
    if (interests.length === 0) {
      setPlaces([]);
      return;
    }

    let cancelled = false;
    const queried = interests.slice(0, MAX_INTERESTS_QUERIED);
    const perCategory = Math.max(2, Math.ceil(PICKS_LIMIT / queried.length));

    Promise.all(
      queried.map((slug) =>
        getPlaces({ category: slug, sort: 'featured', limit: perCategory }).catch(
          () => ({ data: [], meta: { total: 0, page: 1, limit: perCategory, totalPages: 1 } }),
        ),
      ),
    ).then((pages) => {
      if (cancelled) return;
      const seen = new Set<string>();
      const merged: Place[] = [];
      outer: for (const page of pages) {
        for (const place of page.data) {
          if (seen.has(place.id)) continue;
          seen.add(place.id);
          merged.push(place);
          if (merged.length >= PICKS_LIMIT) break outer;
        }
      }
      setPlaces(merged);
    });

    return () => {
      cancelled = true;
    };
  }, [ready, user]);

  if (!places || places.length === 0) return null;

  return (
    <section aria-labelledby="for-you-heading" className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h2
          id="for-you-heading"
          className="flex items-center gap-1.5 font-display text-lg font-semibold text-slate-900 dark:text-slate-50"
        >
          <SparklesIcon aria-hidden className="h-5 w-5 text-gold-500" />
          For you
        </h2>
        <Link
          href="/account"
          className="flex items-center gap-0.5 text-sm font-medium text-brand-700 dark:text-brand-300 hover:underline"
        >
          Edit interests
          <ArrowRightIcon aria-hidden className="h-3.5 w-3.5" />
        </Link>
      </div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {places.map((place, i) => (
          <PlaceCardCompact
            key={place.id}
            place={place}
            verificationStatus={businessVerificationByPlaceId.get(place.id)}
            index={i}
          />
        ))}
      </div>
    </section>
  );
}
