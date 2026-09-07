'use client';

import { useEffect, useState } from 'react';
import { CheckBadgeIcon, StarIcon } from '@heroicons/react/24/solid';
import { getCreators } from '@/lib/api';
import { setCreatorFeatured, setCreatorVerification } from '@/lib/admin-api';
import { colorForCreator } from '@/lib/category-colors';
import { formatCreatorCategory } from '@/lib/format';
import { inputClass, TabListHeader } from './content-shared';
import { LoadingState } from '@/components/admin-ui';
import type { Creator } from '@/lib/types';

const PAGE_SIZE = 20;

// Content > Creators — replaces the old bolted-on "type a username to
// feature them" widget on the Featured Content page (sponsored-placements)
// with a real list: search, and verify/feature toggles per row. No
// create/edit/delete here — creator profiles are self-service
// (POST /creators, PATCH /creators/me), so this is a moderation surface,
// not a CRUD one, same posture as the review/report queues.
export function CreatorsTab({ token }: { token: string }) {
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [page, setPage] = useState(1);
  const [result, setResult] = useState<{ data: Creator[]; meta: { total: number; totalPages: number } } | null>(null);

  useEffect(() => {
    const id = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(id);
  }, [search]);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch]);

  function reload() {
    getCreators({ page, limit: PAGE_SIZE, search: debouncedSearch || undefined }).then(setResult);
  }

  useEffect(reload, [page, debouncedSearch]);

  function updateInList(updated: Creator) {
    setResult((prev) => (prev ? { ...prev, data: prev.data.map((c) => (c.id === updated.id ? updated : c)) } : prev));
  }

  async function toggleVerification(creator: Creator) {
    const next = creator.verificationStatus === 'verified' ? 'unverified' : 'verified';
    updateInList(await setCreatorVerification(token, creator.id, next));
  }

  async function toggleFeatured(creator: Creator) {
    updateInList(await setCreatorFeatured(token, creator.id, !creator.featured));
  }

  return (
    <div className="flex flex-col gap-4">
      <TabListHeader title="Creators" count={result?.meta.total ?? 0} />

      <input
        placeholder="Search by name or username…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className={`max-w-sm ${inputClass}`}
      />

      {!result ? (
        <LoadingState />
      ) : result.data.length === 0 ? (
        <p className="rounded-xl border border-dashed border-slate-300 dark:border-slate-700 px-4 py-8 text-center text-sm text-slate-500 dark:text-slate-400">
          No creators match this search.
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {result.data.map((creator) => (
            <li
              key={creator.id}
              className={`flex flex-wrap items-center justify-between gap-3 rounded-xl border p-3 ${
                creator.featured ? 'border-gold-400 bg-gold-400/10' : 'border-slate-200 dark:border-slate-800'
              }`}
            >
              <div className="flex min-w-0 items-center gap-3">
                <span
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-semibold text-white"
                  style={{ backgroundColor: colorForCreator(creator.username) }}
                >
                  {creator.name.trim().charAt(0).toUpperCase() || '?'}
                </span>
                <div className="min-w-0">
                  <p className="flex items-center gap-1 truncate font-medium text-slate-900 dark:text-slate-50">
                    {creator.name}
                    {creator.verificationStatus === 'verified' && (
                      <CheckBadgeIcon aria-label="Verified" className="h-4 w-4 shrink-0 text-brand-600 dark:text-brand-300" />
                    )}
                  </p>
                  <p className="truncate text-xs text-slate-500 dark:text-slate-400">
                    @{creator.username} · {formatCreatorCategory(creator.category)}
                    {creator.county && ` · ${creator.county.name}`}
                  </p>
                </div>
              </div>

              <div className="flex shrink-0 items-center gap-2">
                <button
                  type="button"
                  onClick={() => toggleVerification(creator)}
                  className="rounded-full border border-slate-300 dark:border-slate-700 px-3 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-200 hover:border-brand-500"
                >
                  {creator.verificationStatus === 'verified' ? 'Unverify' : 'Verify'}
                </button>
                <button
                  type="button"
                  onClick={() => toggleFeatured(creator)}
                  className={`inline-flex items-center gap-1 rounded-full border px-3 py-1.5 text-xs font-medium ${
                    creator.featured
                      ? 'border-gold-400 text-gold-600 hover:bg-gold-400/10'
                      : 'border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:border-gold-400'
                  }`}
                >
                  <StarIcon aria-hidden className="h-3.5 w-3.5" />
                  {creator.featured ? 'Unfeature' : 'Feature'}
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {result && result.meta.totalPages > 1 && (
        <div className="flex items-center justify-between pt-2">
          <button
            type="button"
            disabled={page <= 1}
            onClick={() => setPage((p) => p - 1)}
            className="text-sm font-medium text-brand-700 dark:text-brand-300 hover:underline disabled:pointer-events-none disabled:text-slate-300 dark:disabled:text-slate-700"
          >
            ← Previous
          </button>
          <span className="text-sm text-slate-500 dark:text-slate-400">
            Page {page} of {result.meta.totalPages}
          </span>
          <button
            type="button"
            disabled={page >= result.meta.totalPages}
            onClick={() => setPage((p) => p + 1)}
            className="text-sm font-medium text-brand-700 dark:text-brand-300 hover:underline disabled:pointer-events-none disabled:text-slate-300 dark:disabled:text-slate-700"
          >
            Next →
          </button>
        </div>
      )}
    </div>
  );
}
