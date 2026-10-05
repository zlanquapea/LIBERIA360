'use client';

import { useBusinessDashboard } from '@/components/BusinessDashboardContext';
import { RoomsManager } from '@/components/stays/RoomsManager';
import { businessHasRooms } from '@/lib/stays';

export default function BusinessRoomsPage() {
  const { business, token } = useBusinessDashboard();
  if (!businessHasRooms(business.type)) {
    return (
      <p className="rounded-2xl border border-dashed border-slate-300 p-6 text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
        Rooms are for hotels, guesthouses, lodges and resorts.
      </p>
    );
  }
  return <RoomsManager token={token} businessId={business.id} />;
}
