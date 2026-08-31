'use client';

import { useState } from 'react';
import Link from 'next/link';
import { CategoryIcon } from '@/lib/icons';
import { colorForCategory } from '@/lib/category-colors';
import type { Category } from '@/lib/types';

const MOBILE_VISIBLE_COUNT = 8;

// Browse categories shows four items in a compact grid first. Tapping the
// control reveals the remaining categories in the same grid, below the first
// row, instead of making visitors swipe sideways to discover them.
export function CategoryGrid({ categories }: { categories: Category[] }) {
  const [expanded, setExpanded] = useState(false);
  const hasMore = categories.length > MOBILE_VISIBLE_COUNT;

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
        {categories.map((category, index) => (
          <Link
            key={category.id}
            href={`/categories/${category.slug}`}
            className={`${!expanded && index >= MOBILE_VISIBLE_COUNT ? 'hidden sm:flex' : 'flex'} group min-h-24 min-w-0 flex-col items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-2 py-3 text-center shadow-sm transition hover:-translate-y-0.5 hover:border-brand-300 hover:shadow-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 dark:border-slate-800 dark:bg-slate-900 dark:hover:border-brand-600`}
          >
            <span
              aria-hidden
              className="flex h-11 w-11 items-center justify-center rounded-xl text-white shadow-sm transition-transform group-hover:scale-105"
              style={{ backgroundColor: colorForCategory(category.slug) }}
            >
              <CategoryIcon iconKey={category.icon} categorySlug={category.slug} className="h-6 w-6 text-white" />
            </span>
            <span className="max-w-full text-xs font-semibold leading-tight text-slate-700 dark:text-slate-200 sm:text-sm">
              {category.name}
            </span>
          </Link>
        ))}
      </div>
      {hasMore && (
        <button
          type="button"
          onClick={() => setExpanded((value) => !value)}
          className="min-h-11 self-center rounded-full px-4 text-sm font-semibold text-brand-700 hover:bg-brand-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 sm:hidden dark:text-brand-300 dark:hover:bg-slate-800"
          aria-expanded={expanded}
        >
          {expanded ? 'Show less' : 'See more categories'}
        </button>
      )}
    </div>
  );
}
