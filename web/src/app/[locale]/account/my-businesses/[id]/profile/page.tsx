'use client';

import { useBusinessDashboard } from '@/components/BusinessDashboardContext';
import { BusinessEditForm } from '@/components/BusinessEditForm';

export default function BusinessDashboardProfilePage() {
  const { business, token, onBusinessUpdated } = useBusinessDashboard();
  return <BusinessEditForm token={token} business={business} onSaved={onBusinessUpdated} />;
}
