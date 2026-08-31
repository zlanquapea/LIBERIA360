'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { dashboardHref, visibleNavItems } from '@/lib/business-dashboard-nav';
import type { Business } from '@/lib/types';

// Drives both the desktop sidebar (a plain vertical list — this dashboard
// only ever has a handful of tabs, nowhere near admin's 7-group nav, so
// no collapse/drawer mechanism is needed) and the mobile horizontal
// scroll-tab strip from the same item list, so switching sections is
// always one tap away regardless of screen size.
export function BusinessDashboardNav({ business }: { business: Business }) {
  const pathname = usePathname();
  const items = visibleNavItems(business);

  return (
    <>
      {/* Mobile: horizontal scroll-snap tab strip */}
      <nav
        aria-label="Business dashboard sections"
        className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 lg:hidden"
      >
        {items.map((item) => {
          const href = dashboardHref(business.id, item.segment);
          const active = pathname === href;
          const Icon = item.icon;
          return (
            <Link
              key={item.key}
              href={href}
              className={`flex shrink-0 items-center gap-1.5 rounded-full border px-4 py-2 text-sm font-semibold transition-colors ${
                active
                  ? 'border-brand-700 bg-brand-700 text-white'
                  : 'border-slate-200 bg-white text-slate-600 hover:border-brand-300 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300'
              }`}
            >
              <Icon aria-hidden className="h-4 w-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* Desktop: sticky vertical sidebar */}
      <nav
        aria-label="Business dashboard sections"
        className="hidden w-56 shrink-0 flex-col gap-1 lg:sticky lg:top-20 lg:flex"
      >
        {items.map((item) => {
          const href = dashboardHref(business.id, item.segment);
          const active = pathname === href;
          const Icon = item.icon;
          return (
            <Link
              key={item.key}
              href={href}
              className={`flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-semibold transition-colors ${
                active
                  ? 'bg-brand-700 text-white'
                  : 'text-slate-600 hover:bg-brand-50 hover:text-brand-700 dark:text-slate-300 dark:hover:bg-brand-950/30 dark:hover:text-brand-300'
              }`}
            >
              <Icon aria-hidden className="h-5 w-5 shrink-0" />
              {item.label}
            </Link>
          );
        })}
      </nav>
    </>
  );
}
