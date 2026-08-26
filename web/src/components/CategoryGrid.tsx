'use client';

import { useState } from 'react';
import Link from 'next/link';
import { CategoryIcon } from '@/lib/icons';
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
      <div className="grid grid-cols-4 gap-3">
        {visible.map((category) => (
          <Link
            key={category.id}
            href={`/categories/${category.slug}`}
            className="flex flex-col items-center gap-2 rounded-xl border border-slate-200 dark:border-slate-800 px-2 py-4 text-center transition-all hover:-translate-y-0.5 hover:border-brand-500 hover:shadow-card"
          >
            <CategoryIcon iconKey={category.icon} categorySlug={category.slug} className="h-6 w-6 text-brand-600 dark:text-brand-300" />
            <span className="text-xs font-medium leading-tight text-slate-700 dark:text-slate-200">{category.name}</span>
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
