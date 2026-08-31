'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { CategoryIcon } from '@/lib/icons';
import { colorForCategory } from '@/lib/category-colors';
import type { Category } from '@/lib/types';

function mobileVisibleCount() {
  if (typeof window === 'undefined') return 4;
  if (window.matchMedia('(min-width: 1024px)').matches) return Infinity;
  if (window.matchMedia('(min-width: 768px)').matches) return 8;
  if (window.matchMedia('(min-width: 640px)').matches) return 6;
  return 4;
}

// Browse categories shows four items in a compact grid first. Tapping the
// control reveals the remaining categories in the same grid, below the first
// row, instead of making visitors swipe sideways to discover them.
export function CategoryGrid({ categories }: { categories: Category[] }) {
  const [expanded, setExpanded] = useState(false);
  const [visibleCount, setVisibleCount] = useState(mobileVisibleCount);
  const gridRef = useRef<HTMLDivElement>(null);
  const hasMore = categories.length > visibleCount;

  useEffect(() => {
    const update = () => setVisibleCount(mobileVisibleCount());
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);

  return (
    <div className="flex flex-col gap-4">
      <div
        ref={gridRef}
        data-testid="category-grid"
        className="grid grid-cols-2 gap-2 overflow-hidden transition-[height] duration-300 ease-out motion-reduce:transition-none sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 lg:overflow-visible xl:grid-cols-6"
        style={visibleCount === Infinity ? undefined : { height: expanded ? gridRef.current?.scrollHeight : 200 }}
      >
        {categories.map((category, index) => (
          <Link
            key={category.id}
            href={`/categories/${category.slug}`}
            className={`${!expanded && index >= visibleCount ? 'pointer-events-none opacity-0' : 'opacity-100'} group flex h-24 min-w-0 flex-col items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-2 py-3 text-center shadow-sm transition-opacity duration-300 hover:-translate-y-0.5 hover:border-brand-300 hover:shadow-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 motion-reduce:transition-none dark:border-slate-800 dark:bg-slate-900 dark:hover:border-brand-600`}
            tabIndex={!expanded && index >= visibleCount ? -1 : undefined}
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
          className="min-h-11 self-center rounded-full px-4 text-sm font-semibold text-brand-700 hover:bg-brand-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 lg:hidden dark:text-brand-300 dark:hover:bg-slate-800"
          aria-expanded={expanded}
        >
          {expanded ? 'Show Fewer' : 'See More Categories'}
        </button>
      )}
    </div>
  );
}
