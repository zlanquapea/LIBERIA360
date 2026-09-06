'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { getModerationQueue } from '@/lib/admin-api';
import type { ModerationQueue } from '@/lib/types';
import { AdminPageHeader, EmptyState, LoadingState } from '@/components/admin-ui';

// Content > Content Reports — crowdsourced "still open?" freshness
// reports, distinct from Moderation's user-reported reviews/events: this
// is "is this place still here at all," not "is this content
// inappropriate." Same underlying moderation-queue endpoint, just its
// own focused view (and its own place in the nav, per the spec).
export default function ContentReportsPage() {
  const { token } = useAuth();
  const [queue, setQueue] = useState<ModerationQueue | null>(null);

  useEffect(() => {
    if (!token) return;
    getModerationQueue(token).then(setQueue);
  }, [token]);

  if (!token) return null;

  return (
    <div className="flex flex-col gap-6">
      <AdminPageHeader
        title="Content Reports"
        description="Places 3+ visitors independently reported as “no longer here” in the last 90 days."
      />

      {!queue ? (
        <LoadingState />
      ) : queue.possiblyClosedPlaces.length === 0 ? (
        <EmptyState title="Nothing flagged." description="No places have crossed the freshness-report threshold." />
      ) : (
        <ul className="flex flex-col gap-2">
          {queue.possiblyClosedPlaces.map(({ place, noLongerHereCount }) => (
            <li
              key={place.id}
              className="flex items-center justify-between gap-2 rounded-xl border border-amber-200 bg-amber-50/40 p-3 dark:border-amber-800 dark:bg-amber-900/20"
            >
              <div>
                <p className="font-medium text-slate-900 dark:text-slate-50">{place.name}</p>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {noLongerHereCount} report{noLongerHereCount === 1 ? '' : 's'} · {place.city}
                </p>
              </div>
              <Link
                href={`/places/${place.slug}`}
                target="_blank"
                className="shrink-0 rounded-full border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:border-brand-500 dark:border-slate-700 dark:text-slate-200"
              >
                View listing
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
