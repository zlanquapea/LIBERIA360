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
// visiting: `null` before the client-side check resolves.
//
// UX audit (Sep 5, 2026): this used to also render `null` for a
// signed-out visitor or a signed-in one with no interests set — exactly
// the two groups who'd most benefit from being told the feature exists
// at all, and the only two groups who could act on seeing it (sign up,
// or add interests). Those two now get a one-line prompt instead of
// nothing; the only remaining `null` case is a signed-in visitor who
// *does* have interests but genuinely has no catalog results for them
// (nothing to prompt them to do differently).
const PICKS_LIMIT = 8;
const MAX_INTERESTS_QUERIED = 3;

type PicksState =
  | { kind: 'loading' }
  | { kind: 'signed-out' }
  | { kind: 'no-interests' }
  | { kind: 'empty' }
  | { kind: 'ready'; places: Place[] };

export function PersonalizedPicksSection({
  businessVerificationByPlaceId,
}: {
  businessVerificationByPlaceId: Map<string, VerificationStatus | undefined>;
}) {
  const { user, ready } = useAuth();
  const [state, setState] = useState<PicksState>({ kind: 'loading' });

  useEffect(() => {
    if (!ready) return;
    if (!user) {
      setState({ kind: 'signed-out' });
      return;
    }
    const interests = user.interests ?? [];
    if (interests.length === 0) {
      setState({ kind: 'no-interests' });
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
      setState(merged.length > 0 ? { kind: 'ready', places: merged } : { kind: 'empty' });
    });

    return () => {
      cancelled = true;
    };
  }, [ready, user]);

  if (state.kind === 'loading' || state.kind === 'empty') return null;

  const heading = (
    <h2
      id="for-you-heading"
      className="flex items-center gap-1.5 font-display text-lg font-semibold text-slate-900 dark:text-slate-50"
    >
      <SparklesIcon aria-hidden className="h-5 w-5 text-gold-500" />
      For you
    </h2>
  );

  if (state.kind === 'signed-out' || state.kind === 'no-interests') {
    const isSignedOut = state.kind === 'signed-out';
    return (
      <section aria-labelledby="for-you-heading" className="flex flex-col gap-3">
        {heading}
        <Link
          href={isSignedOut ? '/signup' : '/account'}
          className="flex items-center justify-between gap-3 rounded-2xl border border-dashed border-brand-300 bg-brand-50/60 px-4 py-3.5 text-brand-900 transition-colors hover:border-brand-400 hover:bg-brand-50 dark:border-brand-800 dark:bg-brand-950/20 dark:text-brand-100 dark:hover:bg-brand-950/40"
        >
          <span className="min-w-0">
            <span className="block text-sm font-semibold">
              {isSignedOut ? 'Sign up for picks made for you' : 'Add your interests'}
            </span>
            <span className="mt-0.5 block text-xs text-brand-800/80 dark:text-brand-200/80">
              {isSignedOut
                ? 'Tell us what you love and we’ll build this section around it.'
                : 'A couple of taps and this section fills in with places you’ll actually want.'}
            </span>
          </span>
          <ArrowRightIcon aria-hidden className="h-4 w-4 shrink-0" />
        </Link>
      </section>
    );
  }

  return (
    <section aria-labelledby="for-you-heading" className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        {heading}
        <Link
          href="/account"
          className="flex items-center gap-0.5 text-sm font-medium text-brand-700 dark:text-brand-300 hover:underline"
        >
          Edit interests
          <ArrowRightIcon aria-hidden className="h-3.5 w-3.5" />
        </Link>
      </div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {state.places.map((place, i) => (
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
