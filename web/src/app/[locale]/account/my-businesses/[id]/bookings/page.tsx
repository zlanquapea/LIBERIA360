'use client';

import { useBusinessDashboard } from '@/components/BusinessDashboardContext';
import { BusinessBookingsManager } from '@/components/BusinessBookingsManager';

export default function BusinessDashboardBookingsPage() {
  const { business, token } = useBusinessDashboard();
  return <BusinessBookingsManager token={token} businessId={business.id} />;
}
