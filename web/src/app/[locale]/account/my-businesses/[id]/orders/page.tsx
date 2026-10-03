'use client';

import { useBusinessDashboard } from '@/components/BusinessDashboardContext';
import { businessHasMenu } from '@/lib/menu';
import { FoodOrdersManager } from '@/components/FoodOrdersManager';

export default function BusinessDashboardOrdersPage() {
  const { business, token } = useBusinessDashboard();
  if (!businessHasMenu(business.type)) {
    return (
      <p className="rounded-2xl border border-dashed border-slate-300 p-6 text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
        Food orders only apply to restaurant and bar listings.
      </p>
    );
  }
  return <FoodOrdersManager token={token} businessId={business.id} />;
}
