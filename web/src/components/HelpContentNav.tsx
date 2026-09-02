'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { HELP_CONTENT_NAV } from '@/lib/help-content-nav';

// Navigation for the self-serve content family only — Help Center, FAQ,
// and Blog & Updates. Customer Support is a deliberately separate
// system (a private, authenticated ticket conversation, not admin-
// authored reading content) and does not belong in this nav — it used
// to be a fourth tab here, plus an always-on "Submit a ticket" button,
// which made a ticket conversation look like just another view of the
// same feature as these three read-only pages. The one link between the
// two stays one-directional, on StillNeedHelp's "Contact Support" card:
// from content out to a ticket, never a ticket screen back in here.
//
// Same sidebar/mobile-strip split as BusinessDashboardNav — a sticky
// left sidebar on desktop, a horizontal scroll-tab strip on mobile.
export function HelpContentNav() {
  const pathname = usePathname();
  const items = HELP_CONTENT_NAV;

  return (
    <>
      {/* Mobile: horizontal scroll-tab strip */}
      <nav
        aria-label="Help content sections"
        className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 lg:hidden"
      >
        {items.map((item) => {
          const active = item.match(pathname);
          const Icon = item.icon;
          return (
            <Link
              key={item.key}
              href={item.href}
              aria-current={active ? 'page' : undefined}
              className={`flex shrink-0 items-center gap-1.5 rounded-full border px-4 py-2 text-sm font-semibold transition-colors ${
                active
                  ? 'border-brand-700 bg-brand-700 text-white'
                  : 'border-slate-200 bg-white text-slate-600 hover:border-brand-300 hover:text-brand-800 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300 dark:hover:border-brand-700'
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
        aria-label="Help content sections"
        className="hidden w-56 shrink-0 flex-col gap-1 lg:sticky lg:top-20 lg:flex"
      >
        {items.map((item) => {
          const active = item.match(pathname);
          const Icon = item.icon;
          return (
            <Link
              key={item.key}
              href={item.href}
              aria-current={active ? 'page' : undefined}
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
