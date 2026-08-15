import Link from 'next/link';
import { getCreators } from '@/lib/api';

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
          <h1 className="text-xl font-bold text-slate-900">Creators</h1>
          <p className="text-sm text-slate-500">Liberian storytellers, guides, and explorers sharing the country.</p>
        </div>
        <Link
          href="/creators/me"
          className="shrink-0 rounded-full border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:border-brand-500 hover:text-brand-700"
        >
          Become a creator
        </Link>
      </div>

      {result.data.length === 0 ? (
        <p className="rounded-xl border border-dashed border-slate-300 px-4 py-8 text-center text-slate-500">
          No creator profiles yet — be the first.
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {result.data.map((creator) => (
            <Link
              key={creator.id}
              href={`/creators/${creator.username}`}
              className={`flex items-start gap-3 rounded-xl border p-3 hover:border-brand-500 ${
                creator.featured ? 'border-gold-400 bg-gold-400/10' : 'border-slate-200'
              }`}
            >
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-accent-600 text-lg font-semibold text-white">
                {creator.name.trim().charAt(0).toUpperCase() || '?'}
              </span>
              <div className="min-w-0">
                <p className="flex items-center gap-1 truncate font-medium text-slate-900">
                  {creator.name}
                  {creator.verified && <span aria-label="Verified creator">✓</span>}
                </p>
                {creator.featured && <p className="text-xs font-medium text-gold-600">⭐ Featured creator</p>}
                <p className="truncate text-xs text-slate-500">@{creator.username}</p>
                {creator.specialties.length > 0 && (
                  <p className="mt-1 truncate text-xs text-slate-500">{creator.specialties.join(' · ')}</p>
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
            className={`text-sm font-medium ${page <= 1 ? 'pointer-events-none text-slate-300' : 'text-brand-700 hover:underline'}`}
          >
            ← Previous
          </Link>
          <span className="text-sm text-slate-500">
            Page {result.meta.page} of {result.meta.totalPages}
          </span>
          <Link
            href={`/creators?page=${page + 1}`}
            aria-disabled={page >= result.meta.totalPages}
            className={`text-sm font-medium ${
              page >= result.meta.totalPages ? 'pointer-events-none text-slate-300' : 'text-brand-700 hover:underline'
            }`}
          >
            Next →
          </Link>
        </div>
      )}
    </main>
  );
}
