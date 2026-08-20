import Link from 'next/link';
import { CheckBadgeIcon, StarIcon } from '@heroicons/react/24/solid';
import { getCreators } from '@/lib/api';
import { colorForCreator } from '@/lib/category-colors';

export const metadata = { title: 'Creators — LIBERIA360' };

type SearchParams = { [key: string]: string | string[] | undefined };

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

// Creator directory (Tech Spec §5 Creator / §3.2) — Liberian content
// creators who've made a public profile, sorted by follower count.
export default async function CreatorsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams;
  const page = Number(first(params.page) ?? '1') || 1;

  const result = await getCreators({ page, limit: 20 });

  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-4 px-4 py-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-slate-50">Creators</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">Liberian storytellers, guides, and explorers sharing the country.</p>
        </div>
        <Link
          href="/creators/me"
          className="shrink-0 rounded-full border border-slate-300 dark:border-slate-700 px-3 py-1.5 text-sm font-medium text-slate-700 dark:text-slate-200 hover:border-brand-500 hover:text-brand-700"
        >
          Become a creator
        </Link>
      </div>

      {result.data.length === 0 ? (
        <p className="rounded-xl border border-dashed border-slate-300 dark:border-slate-700 px-4 py-8 text-center text-slate-500 dark:text-slate-400">
          No creator profiles yet — be the first.
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {result.data.map((creator) => (
            <Link
              key={creator.id}
              href={`/creators/${creator.username}`}
              className={`flex items-start gap-3 rounded-xl border p-3 transition-all hover:-translate-y-0.5 hover:border-brand-500 hover:shadow-card ${
                creator.featured ? 'border-gold-400 bg-gold-400/10' : 'border-slate-200 dark:border-slate-800'
              }`}
            >
              <span
                className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-lg font-semibold text-white"
                style={{ backgroundColor: colorForCreator(creator.username) }}
              >
                {creator.name.trim().charAt(0).toUpperCase() || '?'}
              </span>
              <div className="min-w-0">
                <p className="flex items-center gap-1 truncate font-medium text-slate-900 dark:text-slate-50">
                  {creator.name}
                  {creator.verified && <CheckBadgeIcon aria-label="Verified creator" className="h-4 w-4 text-brand-600" />}
                </p>
                {creator.featured && (
                  <p className="flex items-center gap-1 text-xs font-medium text-gold-600">
                    <StarIcon aria-hidden className="h-3.5 w-3.5" />
                    Featured creator
                  </p>
                )}
                <p className="truncate text-xs text-slate-500 dark:text-slate-400">@{creator.username}</p>
                {creator.specialties.length > 0 && (
                  <p className="mt-1 truncate text-xs text-slate-500 dark:text-slate-400">{creator.specialties.join(' · ')}</p>
                )}
              </div>
            </Link>
          ))}
        </div>
      )}

      {result.meta.totalPages > 1 && (
        <div className="flex items-center justify-between pt-2">
          <Link
            href={`/creators?page=${page - 1}`}
            aria-disabled={page <= 1}
            className={`text-sm font-medium ${page <= 1 ? 'pointer-events-none text-slate-300 dark:text-slate-700' : 'text-brand-700 hover:underline'}`}
          >
            ← Previous
          </Link>
          <span className="text-sm text-slate-500 dark:text-slate-400">
            Page {result.meta.page} of {result.meta.totalPages}
          </span>
          <Link
            href={`/creators?page=${page + 1}`}
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
