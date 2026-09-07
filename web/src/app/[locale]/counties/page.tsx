import Link from 'next/link';
import { CountyIcon } from '@/lib/icons';
import { colorForCounty } from '@/lib/category-colors';
import { getCounties } from '@/lib/api';
import { PageHeader } from '@/components/PageHeader';

export const metadata = { title: 'Counties — LIBERIA360' };

// County Browse screen (Tech Spec §4.1) — a 15-county grid, one per
// Liberian county (Business Plan §9.1). Every county is a real, equally
// inviting destination here — same colored icon badge as CategoryGrid, no
// disabled/grayed-out treatment for a county the catalog hasn't reached
// yet. Its place count is just told straight ("0 places" is honest, not a
// broken promise), and tapping through to an empty one shows its own
// honest "nothing here yet" state (see counties/[slug]/page.tsx) rather
// than this page pre-judging it as unclickable.
export default async function CountiesPage() {
  const counties = await getCounties();

  return (
    <main className="page-shell">
      <PageHeader eyebrow="Explore Liberia" title="Browse by county" description="All 15 counties of Liberia, one tap away." />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {counties.map((county) => {
          const placeCount = county.placeCount ?? 0;
          return (
            <Link
              key={county.id}
              href={`/counties/${county.slug}`}
              className="group flex flex-col items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-5 text-center shadow-card transition-all duration-300 hover:-translate-y-0.5 hover:shadow-card-hover dark:border-slate-800 dark:bg-slate-900"
            >
              <span
                aria-hidden
                className="flex h-14 w-14 items-center justify-center rounded-full text-white shadow-sm transition-transform group-hover:scale-105"
                style={{ backgroundColor: colorForCounty(county.slug) }}
              >
                <CountyIcon county={county} className="h-7 w-7 text-white" />
              </span>
              <span className="font-semibold text-slate-900 dark:text-slate-50">{county.name}</span>
              <span className="text-xs text-slate-500 dark:text-slate-400">
                {placeCount} place{placeCount === 1 ? '' : 's'}
              </span>
            </Link>
          );
        })}
      </div>
    </main>
  );
}
