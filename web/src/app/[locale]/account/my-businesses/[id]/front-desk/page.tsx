'use client';

import { useBusinessDashboard } from '@/components/BusinessDashboardContext';
import { FrontDeskBoard } from '@/components/stays/FrontDeskBoard';
import { dashboardHref } from '@/lib/business-dashboard-nav';
import { businessHasRooms } from '@/lib/stays';

export default function BusinessFrontDeskPage() {
  const { business } = useBusinessDashboard();
  if (!businessHasRooms(business.type)) {
    return (
      <p className="rounded-2xl border border-dashed border-slate-300 p-6 text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
        The front desk is for hotels, guesthouses, lodges and resorts.
      </p>
    );
  }
  return <FrontDeskBoard businessId={business.id} roomsHref={dashboardHref(business.id, 'rooms')} />;
}
