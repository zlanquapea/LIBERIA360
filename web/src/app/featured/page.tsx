import Link from 'next/link';
import { StarIcon } from '@heroicons/react/24/solid';
import { getActiveSponsoredPlacements } from '@/lib/api';
import { PlaceCard } from '@/components/PlaceCard';

export const metadata = { title: 'Featured Destinations — LIBERIA360' };

// Home's "Featured Destination" banner shows only one paid placement,
// picked at random per page view (see page.tsx's doc comment on why) —
// this is where a visitor sees the full rotation instead of just whichever
// one they happened to land on.
export default async function FeaturedPage() {
  const placements = await getActiveSponsoredPlacements();

  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-4 px-4 py-6">
      <div>
        <h1 className="flex items-center gap-1.5 text-xl font-bold text-slate-900 dark:text-slate-50">
          <StarIcon aria-hidden className="h-5 w-5 text-gold-500" />
          Featured destinations
        </h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Every place currently featured on the Home page — Home spotlights one at random on each visit.
        </p>
      </div>

      {placements.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-slate-300 dark:border-slate-700 px-4 py-8 text-center">
          <p className="text-slate-500 dark:text-slate-400">Nothing is featured right now.</p>
          <Link href="/search" className="text-sm font-medium text-brand-700 dark:text-brand-300 hover:underline">
            Browse all places
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {placements.map((placement) => (
            <PlaceCard key={placement.id} place={placement.place} />
          ))}
        </div>
      )}
    </main>
  );
}
