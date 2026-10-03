import Link from 'next/link';
import { ArrowRightIcon } from '@heroicons/react/24/outline';

// One heading style for every homepage section: a small eyebrow, a strong
// title, optional supporting line and a single "see all" link.
export function SectionHeading({
  id,
  eyebrow,
  title,
  body,
  href,
  linkLabel,
}: {
  id: string;
  eyebrow?: string;
  title: string;
  body?: string;
  href?: string;
  linkLabel?: string;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-2">
      <div className="max-w-2xl">
        {eyebrow && (
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-sunset-700 dark:text-sunset-300">{eyebrow}</p>
        )}
        <h2 id={id} className="mt-1 font-display text-2xl font-extrabold tracking-tight text-slate-950 dark:text-slate-50 sm:text-3xl">
          {title}
        </h2>
        {body && <p className="mt-1.5 text-sm leading-6 text-slate-600 dark:text-slate-300 sm:text-base">{body}</p>}
      </div>
      {href && linkLabel && (
        <Link
          href={href}
          className="group inline-flex min-h-11 items-center gap-1 rounded-full px-1 text-sm font-semibold text-brand-700 hover:text-brand-900 dark:text-brand-300 dark:hover:text-brand-200"
        >
          {linkLabel}
          <ArrowRightIcon aria-hidden className="h-4 w-4 transition-transform group-hover:translate-x-0.5 motion-reduce:transition-none rtl:-scale-x-100" />
        </Link>
      )}
    </div>
  );
}
