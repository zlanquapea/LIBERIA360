import Link from 'next/link';
import { CountyIcon } from '@/lib/icons';
import { colorForCounty } from '@/lib/category-colors';
import type { County } from '@/lib/types';

// Fixed preview count, shown unconditionally at every breakpoint — see
// the doc comment below for why there's no expand/collapse toggle here
// (unlike CategoryGrid).
const DEFAULT_LIMIT = 12;

/**
 * Home page "Browse counties" preview. Used to show every county
 * unconditionally past a `sm:` breakpoint (its own "See more" toggle was
 * `sm:hidden`) — but the section wrapping this on the home page is itself
 * `hidden lg:flex`, so in practice that toggle never rendered at all: on
 * every screen size this actually appears on, all 15 counties showed at
 * once, stacked directly above an equally uncapped CategoryGrid. Product
 * feedback (Sep 3, 2026), reacting to a screenshot of exactly that: "why
 * we have see more button and all the categories listed... it looks so
 * off... give bad user experience."
 *
 * Fix here is different from CategoryGrid's: a real "View all" link to
 * the full `/counties` browse page already sits in this section's own
 * header (see page.tsx) — a second, in-place expand/collapse mechanism
 * for the exact same list would just be a redundant escape hatch. So this
 * always shows a fixed preview and leans on that existing link for
 * "see the rest," instead of also growing to show everything inline.
 */
export function CountyGrid({ counties, limit = DEFAULT_LIMIT }: { counties: County[]; limit?: number }) {
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
      {counties.slice(0, limit).map((county) => (
        <Link
          key={county.id}
          href={`/counties/${county.slug}`}
          className="group flex min-h-14 min-w-0 items-center gap-2.5 rounded-xl border border-slate-200 bg-white px-3 py-2.5 shadow-sm transition hover:-translate-y-0.5 hover:border-brand-300 hover:shadow-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 dark:border-slate-800 dark:bg-slate-900 dark:hover:border-brand-600"
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
  );
}
