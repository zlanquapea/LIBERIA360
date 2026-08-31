'use client';

import { useBusinessDashboard } from '@/components/BusinessDashboardContext';
import { PlaceDetailsManager } from '@/components/PlaceDetailsManager';

export default function BusinessDashboardPlacePage() {
  const { business, token, onBusinessUpdated } = useBusinessDashboard();
  return (
    <PlaceDetailsManager
      token={token}
      place={business.linkedPlace}
      onSaved={(place) => onBusinessUpdated({ ...business, linkedPlace: place })}
    />
  );
}
