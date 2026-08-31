'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ArrowRightIcon } from '@heroicons/react/24/outline';
import { CountyIcon } from '@/lib/icons';
import { colorForCounty } from '@/lib/category-colors';
import type { County } from '@/lib/types';

const MOBILE_VISIBLE_COUNT = 6;

/** Compact on phones, while every county uses the available grid on larger screens. */
export function CountyGrid({ counties }: { counties: County[] }) {
  const [expanded, setExpanded] = useState(false);
  const hasMore = counties.length > MOBILE_VISIBLE_COUNT;

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
        {counties.map((county, index) => (
          <Link
            key={county.id}
            href={`/counties/${county.slug}`}
            className={`${!expanded && index >= MOBILE_VISIBLE_COUNT ? 'hidden sm:flex' : 'flex'} group min-h-14 min-w-0 items-center gap-2.5 rounded-xl border border-slate-200 bg-white px-3 py-2.5 shadow-sm transition hover:-translate-y-0.5 hover:border-brand-300 hover:shadow-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 dark:border-slate-800 dark:bg-slate-900 dark:hover:border-brand-600`}
          >
            <span
              aria-hidden
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-white"
              style={{ backgroundColor: colorForCounty(county.slug) }}
            >
              <CountyIcon county={county} className="h-5 w-5" />
            </span>
            <span className="min-w-0 text-sm font-semibold leading-tight text-slate-800 dark:text-slate-100">
              {county.name}
            </span>
          </Link>
        ))}
      </div>

      {hasMore && (
        <button
          type="button"
          onClick={() => setExpanded((value) => !value)}
          aria-expanded={expanded}
          className="inline-flex min-h-11 items-center justify-center gap-1 self-center rounded-full px-4 text-sm font-semibold text-brand-700 hover:bg-brand-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 sm:hidden dark:text-brand-300 dark:hover:bg-slate-800"
        >
          {expanded ? 'Show less' : 'See more counties'}
          {!expanded && <ArrowRightIcon aria-hidden className="h-4 w-4" />}
        </button>
      )}
    </div>
  );
}
