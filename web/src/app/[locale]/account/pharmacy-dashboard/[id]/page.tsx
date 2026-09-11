'use client';

import Link from 'next/link';
import {
  BanknotesIcon,
  CheckCircleIcon,
  ClockIcon,
  ShoppingBagIcon,
  Squares2X2Icon,
  UserGroupIcon,
} from '@heroicons/react/24/outline';
import { usePharmacyDashboard } from '@/components/PharmacyDashboardContext';
import { pharmacyDashboardHref } from '@/lib/pharmacy-dashboard-nav';

// The dashboard's landing tab — an at-a-glance summary plus one-click
// links into every other section, so an owner never has to guess where
// something lives (see PharmacyDashboardLayout's doc comment for what
// this replaces).
export default function PharmacyDashboardOverview() {
  const { pharmacy, stats } = usePharmacyDashboard();

  return (
    <div className="flex flex-col gap-5">
      {pharmacy.status === 'pending' && (
        <div className="rounded-2xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-300">
          <p className="font-semibold">Waiting on admin approval.</p>
          <p className="mt-1">
            This pharmacy goes live automatically the moment the place it&apos;s linked to is
            approved — no extra step needed here. In the meantime, get its{' '}
            <Link href={pharmacyDashboardHref(pharmacy.id, 'profile')} className="font-semibold underline">
              profile
            </Link>
            ,{' '}
            <Link href={pharmacyDashboardHref(pharmacy.id, 'products')} className="font-semibold underline">
              products
            </Link>
            , and{' '}
            <Link href={pharmacyDashboardHref(pharmacy.id, 'staff')} className="font-semibold underline">
              staff
            </Link>{' '}
            ready so it&apos;s fully stocked the day it opens.
          </p>
        </div>
      )}
      {pharmacy.status === 'rejected' && (
        <div className="rounded-2xl border border-flag-300 bg-flag-500/10 p-4 text-sm text-flag-700 dark:border-flag-800 dark:text-flag-300">
          <p className="font-semibold">This pharmacy was rejected.</p>
        </div>
      )}
      {pharmacy.status === 'suspended' && (
        <div className="rounded-2xl border border-flag-300 bg-flag-500/10 p-4 text-sm text-flag-700 dark:border-flag-800 dark:text-flag-300">
          <p className="font-semibold">This pharmacy is suspended.</p>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard
          icon={ShoppingBagIcon}
          label="Total orders"
          value={stats?.totalOrders ?? null}
          href={pharmacyDashboardHref(pharmacy.id, 'orders')}
        />
        <StatCard
          icon={CheckCircleIcon}
          label="Completed"
          value={stats?.completedOrders ?? null}
          href={pharmacyDashboardHref(pharmacy.id, 'orders')}
        />
        <StatCard
          icon={ClockIcon}
          label="Pending / in review"
          value={stats?.pendingOrders ?? null}
          href={pharmacyDashboardHref(pharmacy.id, 'orders')}
        />
        <StatCard
          icon={BanknotesIcon}
          label="Revenue"
          value={stats ? `L$${stats.revenue.toFixed(2)}` : null}
          href={pharmacyDashboardHref(pharmacy.id, 'orders')}
        />
      </div>

      <div>
        <p className="mb-2 text-xs font-bold uppercase tracking-[0.18em] text-brand-700 dark:text-brand-300">
          Manage
        </p>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <QuickLink
            icon={Squares2X2Icon}
            label="Products"
            description="See your catalog, add or edit products"
            href={pharmacyDashboardHref(pharmacy.id, 'products')}
          />
          <QuickLink
            icon={ShoppingBagIcon}
            label="Orders"
            description="Incoming orders & prescription review"
            href={pharmacyDashboardHref(pharmacy.id, 'orders')}
          />
          <QuickLink
            icon={UserGroupIcon}
            label="Staff"
            description="Managers, pharmacists, employees"
            href={pharmacyDashboardHref(pharmacy.id, 'staff')}
          />
        </div>
      </div>
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  href,
}: {
  icon: typeof ShoppingBagIcon;
  label: string;
  value: number | string | null;
  href: string;
}) {
  return (
    <Link
      href={href}
      className="flex items-center gap-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition-colors hover:border-brand-300 dark:border-slate-800 dark:bg-slate-900"
    >
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand-100 text-brand-700 dark:bg-brand-950/60 dark:text-brand-300">
        <Icon aria-hidden className="h-5 w-5" />
      </span>
      <span>
        <span className="block text-2xl font-bold text-slate-950 dark:text-slate-50">{value ?? '—'}</span>
        <span className="block text-sm text-slate-500 dark:text-slate-400">{label}</span>
      </span>
    </Link>
  );
}

function QuickLink({
  icon: Icon,
  label,
  description,
  href,
}: {
  icon: typeof ShoppingBagIcon;
  label: string;
  description: string;
  href: string;
}) {
  return (
    <Link
      href={href}
      className="flex flex-col gap-2 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition-colors hover:border-brand-300 hover:bg-brand-50/60 dark:border-slate-800 dark:bg-slate-900 dark:hover:bg-brand-950/20"
    >
      <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-100 text-brand-700 dark:bg-brand-950/60 dark:text-brand-300">
        <Icon aria-hidden className="h-4 w-4" />
      </span>
      <span className="text-sm font-semibold text-slate-900 dark:text-slate-50">{label}</span>
      <span className="text-xs text-slate-500 dark:text-slate-400">{description}</span>
    </Link>
  );
}
