import Link from 'next/link';
import { getCounties, getCreators } from '@/lib/api';
import { CreatorCard } from '@/components/CreatorCard';
import { CreatorFilters } from '@/components/CreatorFilters';
import type { CreatorCategory } from '@/lib/types';

export const metadata = { title: 'Creators — LIBERIA360' };

type SearchParams = { [key: string]: string | string[] | undefined };

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

// Creator directory (Tech Spec §5 Creator / §3.2) — Liberian content
// creators, guides, and operators who've made a public profile. Featured
// creators sort first (see CreatorsService.findAll), then by follower count.
export default async function CreatorsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams;
  const page = Number(first(params.page) ?? '1') || 1;
  const search = first(params.search);
  const category = first(params.category) as CreatorCategory | undefined;
  const countyId = first(params.countyId);

  const [counties, result] = await Promise.all([
    getCounties(),
    getCreators({ page, limit: 20, search, category, countyId }),
  ]);

  function pageHref(targetPage: number) {
    const p = new URLSearchParams();
    if (search) p.set('search', search);
    if (category) p.set('category', category);
    if (countyId) p.set('countyId', countyId);
    p.set('page', String(targetPage));
    return `/creators?${p.toString()}`;
  }

  const hasFilters = Boolean(search || category || countyId);

  return (
    <main className="mx-auto flex max-w-4xl flex-col gap-4 px-4 py-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-slate-50">Creators</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Photographers, guides, and storytellers helping you experience Liberia.
          </p>
        </div>
        <Link
          href="/creators/me"
          className="shrink-0 rounded-full border border-slate-300 dark:border-slate-700 px-3 py-1.5 text-sm font-medium text-slate-700 dark:text-slate-200 hover:border-brand-500 hover:text-brand-700"
        >
          Become a creator
        </Link>
      </div>

      <CreatorFilters counties={counties} />

      {result.data.length === 0 ? (
        <p className="rounded-xl border border-dashed border-slate-300 dark:border-slate-700 px-4 py-8 text-center text-slate-500 dark:text-slate-400">
          {hasFilters ? 'No creators match these filters.' : 'No creator profiles yet — be the first.'}
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-4 pt-4 sm:grid-cols-2 lg:grid-cols-3">
          {result.data.map((creator) => (
            <CreatorCard key={creator.id} creator={creator} />
          ))}
        </div>
      )}

      {result.meta.totalPages > 1 && (
        <div className="flex items-center justify-between pt-2">
          <Link
            href={pageHref(page - 1)}
            aria-disabled={page <= 1}
            className={`text-sm font-medium ${page <= 1 ? 'pointer-events-none text-slate-300 dark:text-slate-700' : 'text-brand-700 hover:underline'}`}
          >
            ← Previous
          </Link>
          <span className="text-sm text-slate-500 dark:text-slate-400">
            Page {result.meta.page} of {result.meta.totalPages}
          </span>
          <Link
            href={pageHref(page + 1)}
            aria-disabled={page >= result.meta.totalPages}
            className={`text-sm font-medium ${
              page >= result.meta.totalPages ? 'pointer-events-none text-slate-300 dark:text-slate-700' : 'text-brand-700 hover:underline'
            }`}
          >
            Next →
          </Link>
        </div>
      )}
    </main>
  );
}
