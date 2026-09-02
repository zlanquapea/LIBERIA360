import Link from 'next/link';
import { LifebuoyIcon } from '@heroicons/react/24/outline';

// Shared "Still need help? Contact Support" card for the Help Center home
// and article pages — always links to the *existing* ticket-creation flow
// (/account/support/new), never a second support surface. Points straight
// at the ticket form rather than the ticket list: someone clicking
// "Contact Support" from an article wants to ask something, not review
// their history first.
export function StillNeedHelp() {
  return (
    <section className="surface-card flex flex-col items-start gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-center gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-700/10 text-brand-700 dark:text-brand-300">
          <LifebuoyIcon aria-hidden className="h-5 w-5" />
        </span>
        <div>
          <p className="font-semibold text-slate-900 dark:text-slate-50">Still need help?</p>
          <p className="text-sm text-slate-500 dark:text-slate-400">Our support team can take it from here.</p>
        </div>
      </div>
      <Link href="/account/support/new" className="button-primary shrink-0">
        Contact Support
      </Link>
    </section>
  );
}
