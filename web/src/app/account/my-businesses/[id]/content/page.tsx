'use client';

import { useBusinessDashboard } from '@/components/BusinessDashboardContext';
import { BusinessContentManager } from '@/components/BusinessContentManager';

export default function BusinessDashboardContentPage() {
  const { business, token } = useBusinessDashboard();
  return <BusinessContentManager token={token} businessId={business.id} />;
}
