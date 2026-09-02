'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { PencilSquareIcon } from '@heroicons/react/24/outline';
import { SUPPORT_HELP_NAV } from '@/lib/support-help-nav';

// Shared navigation for the whole Help & Support surface (Help Center,
// FAQ, Blog & Updates, My Tickets) and everything nested under them
// (an article, a post, a ticket thread). Before this, the only way
// between these four sections was back out to the account dashboard.
//
// Mirrors BusinessDashboardNav's split exactly: a sticky left sidebar on
// desktop, a horizontal scroll-tab strip on mobile — same one-list-drives
// -both-layouts approach that dashboard already proved out. Earlier this
// packed the "Submit a ticket" action into the same scrollable row as the
// tabs, which crowded and visually overlapped it against the active tab
// on narrow screens. It's now always its own element, in its own row on
// mobile and its own button on desktop, so it can never compete with a
// tab for space.
export function SupportHelpNav() {
  const pathname = usePathname();
  const items = SUPPORT_HELP_NAV;

  return (
    <>
      {/* Mobile: horizontal scroll-tab strip, with "Submit a ticket" as
          its own full-width row underneath — never inside the same
          scrollable flex row as the tabs. */}
      <div className="flex flex-col gap-2 lg:hidden">
        <nav
          aria-label="Help & Support sections"
          className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1"
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
        <Link
          href="/account/support/new"
          className="flex items-center justify-center gap-1.5 rounded-full bg-gold-400 px-4 py-2.5 text-sm font-bold text-brand-950 shadow-sm transition-colors hover:bg-gold-300"
        >
          <PencilSquareIcon aria-hidden className="h-4 w-4" />
          Submit a ticket
        </Link>
      </div>

      {/* Desktop: sticky vertical sidebar */}
      <nav
        aria-label="Help & Support sections"
        className="hidden w-56 shrink-0 flex-col gap-4 lg:sticky lg:top-20 lg:flex"
      >
        <div className="flex flex-col gap-1">
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
        </div>
        <Link
          href="/account/support/new"
          className="flex items-center justify-center gap-1.5 rounded-full bg-gold-400 px-4 py-2.5 text-sm font-bold text-brand-950 shadow-sm transition-colors hover:bg-gold-300"
        >
          <PencilSquareIcon aria-hidden className="h-4 w-4" />
          Submit a ticket
        </Link>
      </nav>
    </>
  );
}
