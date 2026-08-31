'use client';

import { createContext, useContext } from 'react';
import type { Business } from '@/lib/types';

// Lets every page under /account/my-businesses/[id]/* read the business
// its layout already fetched, and refresh it after an edit (e.g. saving
// the profile form), without each page re-fetching getMyBusinesses and
// re-deriving "which one is this id" itself.
export interface BusinessDashboardContextValue {
  business: Business;
  token: string;
  onBusinessUpdated: (updated: Business) => void;
}

const BusinessDashboardContext = createContext<BusinessDashboardContextValue | null>(null);

export const BusinessDashboardProvider = BusinessDashboardContext.Provider;

export function useBusinessDashboard(): BusinessDashboardContextValue {
  const value = useContext(BusinessDashboardContext);
  if (!value) {
    throw new Error('useBusinessDashboard must be used within the business dashboard layout');
  }
  return value;
}
