'use client';

import { useState } from 'react';
import Link from 'next/link';
import { CategoryIcon } from '@/lib/icons';
import { colorForCategory } from '@/lib/category-colors';
import type { Category } from '@/lib/types';

const COLUMNS = 4;
const VISIBLE_ROWS = 2;
const VISIBLE_COUNT = COLUMNS * VISIBLE_ROWS;

// Home's "Browse categories" grid, capped to two rows by default — a
// growing category list (admins can add their own, see admin Content >
// Categories) shouldn't push the rest of the homepage further and further
// down. A "See more" toggle reveals the rest in place rather than a
// separate page, since there's no dedicated "all categories" browse screen
// today; toggling back to "Show less" re-collapses without losing scroll
// position the way navigating away would.
export function CategoryGrid({ categories }: { categories: Category[] }) {
  const [expanded, setExpanded] = useState(false);
  const hasMore = categories.length > VISIBLE_COUNT;
  const visible = expanded ? categories : categories.slice(0, VISIBLE_COUNT);

  return (
    <div className="flex flex-col gap-3">
      <div className="-mx-4 flex gap-4 overflow-x-auto px-4 pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:mx-0 sm:grid sm:grid-cols-4 sm:gap-4 sm:overflow-visible sm:px-0 lg:grid-cols-6">
        {visible.map((category) => (
          <Link
            key={category.id}
            href={`/categories/${category.slug}`}
            className="group flex w-[72px] shrink-0 flex-col items-center gap-2 px-1 py-1 text-center transition-transform hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 sm:w-auto sm:py-3"
          >
            <span aria-hidden className="flex h-14 w-14 items-center justify-center rounded-full text-white shadow-sm transition-transform group-hover:scale-105" style={{ backgroundColor: colorForCategory(category.slug) }}><CategoryIcon iconKey={category.icon} categorySlug={category.slug} className="h-7 w-7 text-white" /></span>
            <span className="text-[11px] font-semibold leading-tight text-slate-700 dark:text-slate-200">{category.name}</span>
          </Link>
        ))}
      </div>
      {hasMore && (
        <button
          type="button"
          onClick={() => setExpanded((e) => !e)}
          className="self-center text-sm font-medium text-brand-700 dark:text-brand-300 hover:underline"
        >
          {expanded ? 'Show less' : `See ${categories.length - VISIBLE_COUNT} more`}
        </button>
      )}
    </div>
  );
}
