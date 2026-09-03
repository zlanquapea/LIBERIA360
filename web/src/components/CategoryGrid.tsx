'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { CategoryIcon } from '@/lib/icons';
import { colorForCategory } from '@/lib/category-colors';
import type { Category } from '@/lib/types';

// Two rows' worth of tiles at each breakpoint's own column count (2/3/4/5/6
// cols respectively) — see the doc comment below for why this now applies
// all the way up through `xl`, not just on phones. Only ever called
// client-side (from the effect below, never as the useState initializer —
// see that doc comment for why), so no `typeof window` guard needed here.
function mobileVisibleCount() {
  if (window.matchMedia('(min-width: 1280px)').matches) return 12;
  if (window.matchMedia('(min-width: 1024px)').matches) return 10;
  if (window.matchMedia('(min-width: 768px)').matches) return 8;
  if (window.matchMedia('(min-width: 640px)').matches) return 6;
  return 4;
}

// Browse categories shows a couple of rows in a compact grid first.
// Tapping the control reveals the remaining categories in the same grid,
// below the first rows, instead of making visitors swipe sideways to
// discover them.
//
// Product feedback (Sep 3, 2026), reacting to a screenshot: "why we have
// see more button and all the categories listed... it looks so off... bad
// user experience." Root cause: `mobileVisibleCount` used to return
// `Infinity` past `lg:` (1024px) — the exact opposite of "compact
// first" above 1024px wide, so every desktop visitor saw the full
// category list (20+ tiles) stacked directly under an equally uncapped
// county grid. Unlike CountyGrid, there's no dedicated `/categories`
// browse-all page to link out to instead, so the fix here is to keep this
// same expand/collapse mechanism working at every breakpoint rather than
// switch to a link-out pattern.
export function CategoryGrid({ categories }: { categories: Category[] }) {
  const [expanded, setExpanded] = useState(false);
  // Bug found verifying the fix above: this used to be
  // `useState(mobileVisibleCount)`, a *lazy* initializer — which runs
  // `mobileVisibleCount()` once immediately, including during server
  // rendering, where `typeof window === 'undefined'` forced it to guess 4.
  // The client's first render then computed the *real* viewport-based
  // count (e.g. 8), which never matches the server's guess whenever the
  // real breakpoint isn't the smallest one — a textbook hydration
  // mismatch. React's mismatch recovery for a few of these specific
  // sibling tiles left them permanently stuck at the server's stale
  // opacity-0/tabIndex=-1, un-revealable even after clicking "See More"
  // (verified via the exact React hydration warning this produced, and by
  // inspecting the rendered class/tabIndex per tile before and after).
  // Fixed the same way this codebase already handles this exact class of
  // problem elsewhere (see useAuth's "starts signed-out so server-rendered
  // and first-client-render HTML match" doc comment): always start at a
  // fixed value identical on server and the client's first render, and
  // only let the effect below — client-only, post-hydration — correct it
  // to the real viewport-based count.
  const [visibleCount, setVisibleCount] = useState(4);
  const gridRef = useRef<HTMLDivElement>(null);
  const hasMore = categories.length > visibleCount;

  useEffect(() => {
    const update = () => setVisibleCount(mobileVisibleCount());
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);

  return (
    <div className="flex flex-col gap-4">
      <div
        ref={gridRef}
        data-testid="category-grid"
        className="grid grid-cols-2 gap-2 overflow-hidden transition-[height] duration-300 ease-out motion-reduce:transition-none sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6"
        style={{ height: expanded ? gridRef.current?.scrollHeight : 200 }}
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
          className="min-h-11 self-center rounded-full px-4 text-sm font-semibold text-brand-700 hover:bg-brand-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 dark:text-brand-300 dark:hover:bg-slate-800"
          aria-expanded={expanded}
        >
          {expanded ? 'Show Fewer' : 'See More Categories'}
        </button>
      )}
    </div>
  );
}
