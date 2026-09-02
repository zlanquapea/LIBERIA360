'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { PencilSquareIcon } from '@heroicons/react/24/outline';
import { SUPPORT_HELP_NAV } from '@/lib/support-help-nav';

// Shared tab strip for the whole Help & Support surface (Help Center,
// FAQ, Blog & Updates, My Tickets) and everything nested under them
// (an article, a post, a ticket thread). Before this, the only way
// between these four sections was back out to the account dashboard —
// this is the same problem the "My Businesses" dashboard nav solved for
// business owners, applied to the customer-facing side: one list of
// tabs so switching sections is always one tap away, plus a CTA that is
// *always* on screen so creating a ticket never has to compete with
// reading a list of past ones.
//
// A plain horizontal strip (not the sidebar/mobile-split business nav
// uses) — this section is content-browsing, not a dense management
// console, and it spans both public pages and the account area, so it
// keeps the same shape everywhere it appears.
export function SupportHelpNav() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Help & Support sections"
      className="-mx-1 flex items-center gap-2 overflow-x-auto px-1 pb-1"
    >
      <div className="flex flex-1 gap-2">
        {SUPPORT_HELP_NAV.map((item) => {
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
      </div>
      <Link
        href="/account/support/new"
        className="flex shrink-0 items-center gap-1.5 rounded-full bg-gold-400 px-4 py-2 text-sm font-bold text-brand-950 shadow-sm transition-colors hover:bg-gold-300"
      >
        <PencilSquareIcon aria-hidden className="h-4 w-4" />
        Submit a ticket
      </Link>
    </nav>
  );
}
