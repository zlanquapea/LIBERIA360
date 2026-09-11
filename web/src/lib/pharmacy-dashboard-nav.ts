import type { ComponentType, SVGProps } from 'react';
import {
  BeakerIcon,
  BuildingStorefrontIcon,
  HomeIcon,
  ShoppingBagIcon,
  Squares2X2Icon,
  UserGroupIcon,
} from '@heroicons/react/24/outline';

export interface PharmacyDashboardNavItem {
  key: string;
  label: string;
  segment: string | null; // null = the dashboard's own index route
  icon: ComponentType<SVGProps<SVGSVGElement>>;
}

// Same one-list-drives-both-the-sidebar-and-the-mobile-strip pattern as
// BUSINESS_DASHBOARD_NAV (see business-dashboard-nav.ts) — a pharmacy
// dashboard used to be a single ~1200-line page with every section
// stacked top to bottom (profile, hours, staff, products, orders all on
// one scroll), which is exactly the "everything is on a single page"
// report this replaces. Every pharmacy gets every tab — unlike the
// generic business dashboard's Menu/Orders (restaurant-only), a
// pharmacy IS the specialization, so nothing here is conditional.
export const PHARMACY_DASHBOARD_NAV: PharmacyDashboardNavItem[] = [
  { key: 'overview', label: 'Overview', segment: null, icon: HomeIcon },
  { key: 'profile', label: 'Profile & Hours', segment: 'profile', icon: BuildingStorefrontIcon },
  { key: 'products', label: 'Products', segment: 'products', icon: Squares2X2Icon },
  { key: 'orders', label: 'Orders', segment: 'orders', icon: ShoppingBagIcon },
  { key: 'staff', label: 'Staff', segment: 'staff', icon: UserGroupIcon },
];

// Re-exported for the pharmacy list page's icon.
export const MY_PHARMACIES_ICON = BeakerIcon;

export function pharmacyDashboardHref(pharmacyId: string, segment: string | null): string {
  return segment
    ? `/account/pharmacy-dashboard/${pharmacyId}/${segment}`
    : `/account/pharmacy-dashboard/${pharmacyId}`;
}
