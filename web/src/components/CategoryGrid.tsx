import Link from 'next/link';
import { CategoryIcon } from '@/lib/icons';
import { colorForCategory } from '@/lib/category-colors';
import type { Category } from '@/lib/types';

// Home's "Browse categories" rail — every category in one horizontally
// scrollable row, always. Earlier this capped itself to a handful of
// shortcuts with a "See more" toggle that revealed the rest via a CSS grid
// (multiple vertical rows) or, after a first fix, appended them to the same
// row but off-screen — so pressing "See more" visibly did nothing until a
// visitor scrolled sideways to find them. Dropping the toggle entirely
// removes that dead-end: everything is here from the start, reachable by
// the same swipe/scroll gesture already used for "Sponsored" and the
// county tabs, and a growing admin-managed category list never adds a
// vertical row to the page no matter how many categories exist.
//
// A soft fade on the trailing edge (a gradient-to-transparent overlay,
// matching the page's own background so it reads as a mask rather than a
// visible box) stands in for the old "See N more" text link as the
// "there's more this way" cue — it's just always there rather than
// computed from actual scroll position, which is a fine trade for not
// needing a scroll listener just to hint at something `overflow-x-auto`
// already makes discoverable by touch.
export function CategoryGrid({ categories }: { categories: Category[] }) {
  return (
    <div className="relative -mx-4 sm:mx-0">
      <div className="flex flex-nowrap gap-4 overflow-x-auto overscroll-x-contain px-4 pb-2 [scrollbar-width:none] sm:px-0 [&::-webkit-scrollbar]:hidden">
        {categories.map((category) => (
          <Link
            key={category.id}
            href={`/categories/${category.slug}`}
            className="group flex w-[72px] min-w-[72px] shrink-0 flex-col items-center gap-2 px-1 py-1 text-center transition-transform hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 sm:w-20 sm:py-3"
          >
            <span
              aria-hidden
              className="flex h-14 w-14 items-center justify-center rounded-full text-white shadow-sm transition-transform group-hover:scale-105"
              style={{ backgroundColor: colorForCategory(category.slug) }}
            >
              <CategoryIcon iconKey={category.icon} categorySlug={category.slug} className="h-7 w-7 text-white" />
            </span>
            <span className="text-[11px] font-semibold leading-tight text-slate-700 dark:text-slate-200">{category.name}</span>
          </Link>
        ))}
      </div>
      <div aria-hidden className="pointer-events-none absolute inset-y-0 right-0 w-8 bg-gradient-to-l from-white to-transparent dark:from-slate-950" />
    </div>
  );
}
