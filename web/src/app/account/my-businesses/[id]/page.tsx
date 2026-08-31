'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  BuildingStorefrontIcon,
  CalendarDaysIcon,
  ChartBarIcon,
  MapPinIcon,
  MegaphoneIcon,
  ShoppingBagIcon,
  Squares2X2Icon,
} from '@heroicons/react/24/outline';
import { useBusinessDashboard } from '@/components/BusinessDashboardContext';
import { getBusinessBookings } from '@/lib/booking-api';
import { getBusinessFoodOrders } from '@/lib/food-orders-api';
import { dashboardHref } from '@/lib/business-dashboard-nav';

// The dashboard's landing tab — an at-a-glance summary (what needs a
// response right now) plus one-click links into every other section, so
// an owner never has to guess where something lives.
export default function BusinessDashboardOverview() {
  const { business, token } = useBusinessDashboard();
  const isRestaurant = business.type === 'restaurant';
  const [pendingBookings, setPendingBookings] = useState<number | null>(null);
  const [pendingOrders, setPendingOrders] = useState<number | null>(null);

  useEffect(() => {
    getBusinessBookings(token, business.id).then((bookings) =>
      setPendingBookings(bookings.filter((b) => b.status === 'pending').length),
    );
    if (isRestaurant) {
      getBusinessFoodOrders(token, business.id).then((orders) =>
        setPendingOrders(orders.filter((o) => o.status === 'pending').length),
      );
    }
  }, [token, business.id, isRestaurant]);

  return (
    <div className="flex flex-col gap-5">
      {business.reviewStatus === 'rejected' && business.rejectionReason && (
        <div className="rounded-2xl border border-flag-300 bg-flag-500/10 p-4 text-sm text-flag-700 dark:border-flag-800 dark:text-flag-300">
          <p className="font-semibold">This listing was rejected.</p>
          <p className="mt-1 italic">Reviewer note: {business.rejectionReason}</p>
          <p className="mt-2">
            Editing the{' '}
            <Link href={dashboardHref(business.id, 'profile')} className="font-semibold underline">
              profile
            </Link>{' '}
            resubmits it for review.
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <StatCard
          icon={CalendarDaysIcon}
          label="Pending booking requests"
          value={pendingBookings}
          href={dashboardHref(business.id, 'bookings')}
        />
        {isRestaurant && (
          <StatCard
            icon={ShoppingBagIcon}
            label="Pending food orders"
            value={pendingOrders}
            href={dashboardHref(business.id, 'orders')}
          />
        )}
      </div>

      <div>
        <p className="mb-2 text-xs font-bold uppercase tracking-[0.18em] text-brand-700 dark:text-brand-300">
          Manage
        </p>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <QuickLink
            icon={BuildingStorefrontIcon}
            label="Profile & Photos"
            description="Contact info, hours, amenities, photos"
            href={dashboardHref(business.id, 'profile')}
          />
          <QuickLink
            icon={MapPinIcon}
            label="Place Details"
            description="Name, category, location, tags"
            href={dashboardHref(business.id, 'place')}
          />
          {isRestaurant && (
            <QuickLink
              icon={Squares2X2Icon}
              label="Menu"
              description="Dishes, prices, availability"
              href={dashboardHref(business.id, 'menu')}
            />
          )}
          {isRestaurant && (
            <QuickLink
              icon={ShoppingBagIcon}
              label="Orders"
              description="Incoming food orders"
              href={dashboardHref(business.id, 'orders')}
            />
          )}
          <QuickLink
            icon={CalendarDaysIcon}
            label="Bookings"
            description="Incoming booking requests"
            href={dashboardHref(business.id, 'bookings')}
          />
          <QuickLink
            icon={MegaphoneIcon}
            label="Updates"
            description="Offers, announcements, articles"
            href={dashboardHref(business.id, 'content')}
          />
          <QuickLink
            icon={ChartBarIcon}
            label="Analytics"
            description="Views, saves, contact clicks"
            href={dashboardHref(business.id, 'analytics')}
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
  icon: typeof CalendarDaysIcon;
  label: string;
  value: number | null;
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
  icon: typeof CalendarDaysIcon;
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
