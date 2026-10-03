'use client';

import { useBusinessDashboard } from '@/components/BusinessDashboardContext';
import { businessHasMenu } from '@/lib/menu';
import { MenuItemsManager } from '@/components/MenuItemsManager';

export default function BusinessDashboardMenuPage() {
  const { business, token } = useBusinessDashboard();
  if (!businessHasMenu(business.type)) {
    return (
      <p className="rounded-2xl border border-dashed border-slate-300 p-6 text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
        A menu only applies to restaurant and bar listings.
      </p>
    );
  }
  return <MenuItemsManager token={token} businessId={business.id} businessType={business.type} />;
}
