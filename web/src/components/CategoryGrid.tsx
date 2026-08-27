'use client';

import { useState } from 'react';
import Link from 'next/link';
import { CategoryIcon } from '@/lib/icons';
import { colorForCategory } from '@/lib/category-colors';
import type { Category } from '@/lib/types';

const INITIAL_VISIBLE_COUNT = 4;

// Home's "Browse categories" rail shows four shortcuts initially. A
// "See more" toggle reveals the rest in the same horizontal scroll row,
// so a growing category list never creates additional vertical rows on the
// homepage. Toggling back to "Show less" restores the compact initial row.
export function CategoryGrid({ categories }: { categories: Category[] }) {
  const [expanded, setExpanded] = useState(false);
  const hasMore = categories.length > INITIAL_VISIBLE_COUNT;
  const visible = expanded ? categories : categories.slice(0, INITIAL_VISIBLE_COUNT);

  return (
    <div className="flex flex-col gap-3">
      <div className="-mx-4 flex flex-nowrap gap-4 overflow-x-auto overscroll-x-contain px-4 pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {visible.map((category) => (
          <Link
            key={category.id}
            href={`/categories/${category.slug}`}
            className="group flex w-[72px] min-w-[72px] shrink-0 flex-col items-center gap-2 px-1 py-1 text-center transition-transform hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 sm:py-3"
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
          {expanded ? 'Show less' : `See ${categories.length - INITIAL_VISIBLE_COUNT} more`}
        </button>
      )}
    </div>
  );
}
