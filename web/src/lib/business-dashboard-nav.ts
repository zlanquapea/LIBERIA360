import type { ComponentType, SVGProps } from 'react';
import {
  BuildingStorefrontIcon,
  CalendarDaysIcon,
  ChartBarIcon,
  ClipboardDocumentListIcon,
  HomeIcon,
  MegaphoneIcon,
  ShoppingBagIcon,
  Squares2X2Icon,
} from '@heroicons/react/24/outline';
import type { Business } from './types';

export interface BusinessDashboardNavItem {
  key: string;
  label: string;
  segment: string | null; // null = the dashboard's own index route
  icon: ComponentType<SVGProps<SVGSVGElement>>;
  // Omit to show for every business type; some sections (Menu, Orders)
  // only make sense for a restaurant's own menu-driven flows.
  show?: (business: Business) => boolean;
}

// One list drives both the desktop sidebar and the mobile tab strip, so
// the two never drift out of sync — exactly the problem this dashboard
// exists to fix (product feedback, Aug 2026: "the process to manage a
// business is kinda hidden and difficult to find ... instead of clicking
// here and there"). Everything an owner needs for one business lives
// behind one of these tabs instead of being scattered across the public
// place page, a separate bookings inbox, and a separate analytics page.
export const BUSINESS_DASHBOARD_NAV: BusinessDashboardNavItem[] = [
  { key: 'overview', label: 'Overview', segment: null, icon: HomeIcon },
  { key: 'profile', label: 'Profile & Photos', segment: 'profile', icon: BuildingStorefrontIcon },
  {
    key: 'menu',
    label: 'Menu',
    segment: 'menu',
    icon: Squares2X2Icon,
    show: (b) => b.type === 'restaurant',
  },
  {
    key: 'orders',
    label: 'Orders',
    segment: 'orders',
    icon: ShoppingBagIcon,
    show: (b) => b.type === 'restaurant',
  },
  { key: 'bookings', label: 'Bookings', segment: 'bookings', icon: CalendarDaysIcon },
  { key: 'content', label: 'Updates', segment: 'content', icon: MegaphoneIcon },
  { key: 'analytics', label: 'Analytics', segment: 'analytics', icon: ChartBarIcon },
];

export function visibleNavItems(business: Business): BusinessDashboardNavItem[] {
  return BUSINESS_DASHBOARD_NAV.filter((item) => !item.show || item.show(business));
}

export function dashboardHref(businessId: string, segment: string | null): string {
  return segment ? `/account/my-businesses/${businessId}/${segment}` : `/account/my-businesses/${businessId}`;
}

// Re-exported for the "My Businesses" list page's icon.
export const MY_BUSINESSES_ICON = ClipboardDocumentListIcon;
