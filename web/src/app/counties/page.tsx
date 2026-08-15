import Link from 'next/link';
import { getCounties } from '@/lib/api';

export const metadata = { title: 'Counties — LIBERIA360' };

// County Browse screen (Tech Spec §4.1) — 15-county grid, staged per
// Business Plan §9.1. Counties with no catalog yet are shown, honestly,
// as not-yet-launched rather than as empty browsable pages.
export default async function CountiesPage() {
  const counties = await getCounties();

  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-4 px-4 py-6">
      <div>
        <h1 className="text-xl font-bold text-slate-900">Browse by county</h1>
        <p className="text-sm text-slate-500">
          Rolling out county by county, starting with Greater Monrovia (Business Plan §9.1).
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {counties.map((county) => {
          const live = (county.placeCount ?? 0) > 0;
          return (
            <Link
              key={county.id}
              href={`/counties/${county.slug}`}
              className={`flex flex-col gap-1 rounded-xl border px-4 py-3 ${
                live ? 'border-slate-200 hover:border-brand-500' : 'border-slate-100'
              }`}
            >
              <span aria-hidden className={`text-xl ${live ? '' : 'opacity-40 grayscale'}`}>
                {county.icon ?? '📍'}
              </span>
              <span className={`font-medium ${live ? 'text-slate-900' : 'text-slate-400'}`}>{county.name}</span>
              <span className={`text-xs ${live ? 'text-slate-500' : 'text-slate-400'}`}>
                {live ? `${county.placeCount} place${county.placeCount === 1 ? '' : 's'}` : `Stage ${county.rolloutStage}`}
              </span>
            </Link>
          );
        })}
      </div>
    </main>
  );
}
