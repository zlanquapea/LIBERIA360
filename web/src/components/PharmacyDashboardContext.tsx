'use client';

import { createContext, useContext } from 'react';
import type { Pharmacy, PharmacyStats } from '@/lib/pharmacy-api';

// Lets every page under /account/pharmacy-dashboard/[id]/* read the
// pharmacy (and its staff-role-bearing stats) its layout already
// fetched, and refresh either after an edit, without each page
// re-deriving "which one is this id" itself — same pattern as
// BusinessDashboardContext for /account/my-businesses/[id]/*.
export interface PharmacyDashboardContextValue {
  pharmacy: Pharmacy;
  stats: PharmacyStats | null;
  onPharmacyUpdated: (updated: Pharmacy) => void;
  reloadStats: () => void;
}

const PharmacyDashboardContext = createContext<PharmacyDashboardContextValue | null>(null);

export const PharmacyDashboardProvider = PharmacyDashboardContext.Provider;

export function usePharmacyDashboard(): PharmacyDashboardContextValue {
  const value = useContext(PharmacyDashboardContext);
  if (!value) {
    throw new Error('usePharmacyDashboard must be used within the pharmacy dashboard layout');
  }
  return value;
}
