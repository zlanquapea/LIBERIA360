import type { ReactNode } from 'react';
import Link from 'next/link';
import {
  ArrowLongDownIcon,
  ArrowLongUpIcon,
  MinusIcon,
  WrenchScrewdriverIcon,
} from '@heroicons/react/24/outline';

// Shared admin design-system primitives — every new admin page in this
// redesign is built from these instead of one-off markup, so "clean
// visual hierarchy... consistent typography... clear cards" (Tech Spec
// §5) is a property of the components, not something re-achieved by eye
// on every page.

const PERIOD_OPTIONS = [
  { days: 7, label: '7 days' },
  { days: 30, label: '30 days' },
];

/** Every Analytics sub-page takes the same `days` prop and passes it
 * straight to useAnalyticsOverview — one control, shared everywhere,
 * instead of a bespoke picker per page. */
export function PeriodToggle({ days, onChange }: { days: number; onChange: (days: number) => void }) {
  return (
    <div className="inline-flex rounded-lg border border-slate-300 p-0.5 dark:border-slate-700">
      {PERIOD_OPTIONS.map((opt) => (
        <button
          key={opt.days}
          type="button"
          onClick={() => onChange(opt.days)}
          className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
            days === opt.days
              ? 'bg-brand-700 text-white'
              : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

export function AdminPageHeader({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <h1 className="text-xl font-bold text-slate-900 dark:text-slate-50">{title}</h1>
        {description && <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">{description}</p>}
      </div>
      {action}
    </div>
  );
}

export function Panel({
  title,
  action,
  children,
  className = '',
}: {
  title?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={`flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-card dark:border-slate-800 dark:bg-slate-900 ${className}`}
    >
      {(title || action) && (
        <div className="flex items-center justify-between gap-2">
          {title && <h2 className="font-semibold text-slate-800 dark:text-slate-100">{title}</h2>}
          {action}
        </div>
      )}
      {children}
    </section>
  );
}

// Plain Tailwind red/emerald here, deliberately not the brand's `flag`
// palette (which only defines 500/600/700 — used for validation/error
// states elsewhere, not this) — up/down trend coloring is a distinct
// semantic use with its own full light/dark shade range available.
const DIRECTION_STYLES = {
  up: 'text-emerald-700 bg-emerald-50 dark:text-emerald-300 dark:bg-emerald-900/30',
  down: 'text-red-700 bg-red-50 dark:text-red-300 dark:bg-red-900/30',
  flat: 'text-slate-500 bg-slate-100 dark:text-slate-400 dark:bg-slate-800',
} as const;

const DIRECTION_ICON = {
  up: ArrowLongUpIcon,
  down: ArrowLongDownIcon,
  flat: MinusIcon,
} as const;

/** The exact "instead of displaying: X, show: X, delta, insight" pattern
 * from the spec — a bare number is never enough context on its own to
 * decide anything. */
export function KpiCard({
  label,
  value,
  deltaPct,
  direction,
  insight,
  href,
}: {
  label: string;
  value: string | number;
  deltaPct?: number | null;
  direction?: 'up' | 'down' | 'flat';
  insight?: string;
  href?: string;
}) {
  const DirectionIcon = direction ? DIRECTION_ICON[direction] : null;
  const content = (
    <>
      <p className="text-sm font-medium text-slate-500 dark:text-slate-400">{label}</p>
      <p className="mt-1 text-2xl font-bold text-slate-900 dark:text-slate-50">{value}</p>
      {direction && DirectionIcon && (
        <span
          className={`mt-2 inline-flex w-fit items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ${DIRECTION_STYLES[direction]}`}
        >
          <DirectionIcon aria-hidden className="h-3.5 w-3.5" />
          {deltaPct !== null && deltaPct !== undefined
            ? `${Math.abs(deltaPct).toFixed(0)}%`
            : direction === 'flat'
              ? 'Flat'
              : 'New'}
        </span>
      )}
      {insight && <p className="mt-2 text-xs leading-snug text-slate-500 dark:text-slate-400">{insight}</p>}
    </>
  );

  const className =
    'flex flex-col rounded-xl border border-slate-200 bg-white p-4 shadow-card dark:border-slate-800 dark:bg-slate-900';

  if (href) {
    return (
      <Link href={href} className={`${className} transition-shadow hover:shadow-card-hover`}>
        {content}
      </Link>
    );
  }
  return <div className={className}>{content}</div>;
}

export function EmptyState({ title, description }: { title: string; description?: string }) {
  return (
    <div className="rounded-xl border border-dashed border-slate-300 px-4 py-8 text-center dark:border-slate-700">
      <p className="text-sm font-medium text-slate-600 dark:text-slate-300">{title}</p>
      {description && <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{description}</p>}
    </div>
  );
}

export function LoadingState({ label = 'Loading…' }: { label?: string }) {
  return <p className="text-sm text-slate-500 dark:text-slate-400">{label}</p>;
}

export function ErrorState({ message }: { message: string }) {
  return (
    <p role="alert" className="rounded-lg bg-flag-500/10 px-3 py-2 text-sm text-flag-700 dark:text-flag-300">
      {message}
    </p>
  );
}

/** Honest "not built yet" body for a nav item that exists in the
 * information architecture but has no real feature behind it (Settings,
 * System's finer-grained pages, a dynamic Roles editor) — the
 * alternative was either faking data or leaving the nav item out
 * entirely, and the spec's own rule about clear empty states says this
 * is the right one. */
export function PlaceholderPage({
  title,
  description,
  reason,
}: {
  title: string;
  description: string;
  reason: string;
}) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-slate-300 px-6 py-12 text-center dark:border-slate-700">
      <WrenchScrewdriverIcon aria-hidden className="h-8 w-8 text-slate-400 dark:text-slate-400" />
      <h2 className="text-base font-semibold text-slate-800 dark:text-slate-100">{title}</h2>
      <p className="max-w-md text-sm text-slate-500 dark:text-slate-400">{description}</p>
      <p className="max-w-md text-xs text-slate-400 dark:text-slate-400">{reason}</p>
    </div>
  );
}
