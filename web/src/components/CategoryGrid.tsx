'use client';

import { useState } from 'react';
import Link from 'next/link';
import { CategoryIcon } from '@/lib/icons';
import { colorForCategory } from '@/lib/category-colors';
import type { Category } from '@/lib/types';

const INITIAL_VISIBLE_COUNT = 4;

// Browse categories shows four items in a compact grid first. Tapping the
// control reveals the remaining categories in the same grid, below the first
// row, instead of making visitors swipe sideways to discover them.
export function CategoryGrid({ categories }: { categories: Category[] }) {
  const [expanded, setExpanded] = useState(false);
  const hasMore = categories.length > INITIAL_VISIBLE_COUNT;
  const visible = expanded ? categories : categories.slice(0, INITIAL_VISIBLE_COUNT);

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-4 gap-x-2 gap-y-6 px-0 pb-1 sm:gap-x-4 sm:gap-y-8">
        {visible.map((category) => (
          <Link
            key={category.id}
            href={`/categories/${category.slug}`}
            className="group flex min-w-0 flex-col items-center gap-2 px-0.5 py-1 text-center transition-transform hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 sm:py-3"
          >
            <span
              aria-hidden
              className="flex h-12 w-12 items-center justify-center rounded-full text-white shadow-sm transition-transform group-hover:scale-105 sm:h-14 sm:w-14"
              style={{ backgroundColor: colorForCategory(category.slug) }}
            >
              <CategoryIcon iconKey={category.icon} categorySlug={category.slug} className="h-7 w-7 text-white" />
            </span>
            <span className="max-w-full text-[10px] font-semibold leading-tight text-slate-700 dark:text-slate-200 sm:text-[11px]">
              {category.name}
            </span>
          </Link>
        ))}
      </div>
      {hasMore && (
        <button
          type="button"
          onClick={() => setExpanded((value) => !value)}
          className="self-center text-sm font-medium text-brand-700 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 dark:text-brand-300"
          aria-expanded={expanded}
        >
          {expanded ? 'Show less' : 'See all categories'}
        </button>
      )}
    </div>
  );
}
