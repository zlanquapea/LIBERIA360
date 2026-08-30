import type { ComponentType, SVGProps } from 'react';
import {
  ChartBarIcon,
  Cog6ToothIcon,
  DocumentTextIcon,
  ServerStackIcon,
  ShieldCheckIcon,
  Squares2X2Icon,
  UsersIcon,
  LifebuoyIcon,
} from '@heroicons/react/24/outline';
import { hasCapability, type Capability, type CapabilityUser } from './capabilities';

type IconComponent = ComponentType<SVGProps<SVGSVGElement>>;

export interface AdminNavItem {
  label: string;
  href: string;
  // Omitted = visible to any admin (AdminGate already guarantees that
  // much just to reach this layout). Set = gated to whichever role tier
  // capabilities.ts says that capability requires.
  capability?: Capability;
}

export interface AdminNavGroup {
  id: string;
  label: string;
  icon: IconComponent;
  // A group with no href is a pure accordion header — Dashboard is the
  // one exception, a single page with no submenu, so it skips the
  // expand/collapse chrome entirely (see AdminSidebar).
  href?: string;
  capability?: Capability;
  items?: AdminNavItem[];
}

// The 7-group information architecture. Every href here resolves to a
// real route in this PR — some (Settings, System/Operations, a dynamic
// Roles editor) render an honest "not built yet" placeholder rather than
// fake data; see each page for which.
export const ADMIN_NAV: AdminNavGroup[] = [
  {
    id: 'support',
    label: 'Customer Support',
    icon: LifebuoyIcon,
    href: '/admin/support',
  },
  {
    id: 'dashboard',
    label: 'Dashboard',
    icon: Squares2X2Icon,
    href: '/admin',
  },
  {
    id: 'analytics',
    label: 'Analytics',
    icon: ChartBarIcon,
    capability: 'analytics.view',
    items: [
      { label: 'Overview', href: '/admin/analytics' },
      { label: 'User Analytics', href: '/admin/analytics/users' },
      { label: 'Content Performance', href: '/admin/analytics/content' },
      { label: 'Engagement', href: '/admin/analytics/engagement' },
      { label: 'Growth & Retention', href: '/admin/analytics/growth' },
      { label: 'Reports', href: '/admin/analytics/reports' },
      { label: 'Assistant Reviews', href: '/admin/assistant-review' },
    ],
  },
  {
    id: 'content',
    label: 'Content',
    icon: DocumentTextIcon,
    capability: 'content.view',
    items: [
      { label: 'All Content', href: '/admin/content' },
      { label: 'Categories', href: '/admin/content?tab=categories' },
      { label: 'Creators', href: '/admin/content?tab=creators' },
      { label: 'Businesses', href: '/admin/content?tab=businesses' },
      { label: 'Featured Content', href: '/admin/sponsored-placements' },
      { label: 'Moderation', href: '/admin/content/moderation', capability: 'content.moderate' },
      { label: 'Content Reports', href: '/admin/content/reports', capability: 'content.moderate' },
    ],
  },
  {
    id: 'users',
    label: 'Users & Roles',
    icon: UsersIcon,
    capability: 'users.view',
    items: [
      { label: 'Users', href: '/admin/users', capability: 'users.view' },
      { label: 'Administrators', href: '/admin/team', capability: 'users.manage' },
      { label: 'Roles & Permissions', href: '/admin/roles', capability: 'users.view' },
      { label: 'Activity', href: '/admin/audit-log', capability: 'audit.view' },
    ],
  },
  {
    id: 'settings',
    label: 'Settings',
    icon: Cog6ToothIcon,
    capability: 'settings.manage',
    items: [
      { label: 'General Settings', href: '/admin/settings/general' },
      { label: 'Application Settings', href: '/admin/settings/application' },
      { label: 'Notifications', href: '/admin/settings/notifications' },
      { label: 'Integrations', href: '/admin/settings/integrations' },
      { label: 'Localization', href: '/admin/settings/localization' },
    ],
  },
  {
    id: 'security',
    label: 'Security',
    icon: ShieldCheckIcon,
    capability: 'security.view',
    items: [
      { label: 'Security Overview', href: '/admin/security' },
      { label: 'Login & Authentication', href: '/admin/security/login' },
      { label: 'Sessions & Devices', href: '/admin/security/sessions' },
      { label: 'Audit Logs', href: '/admin/audit-log', capability: 'audit.view' },
      { label: 'Access Control', href: '/admin/roles' },
      { label: 'Security Alerts', href: '/admin/security/alerts' },
    ],
  },
  {
    id: 'system',
    label: 'System / Operations',
    icon: ServerStackIcon,
    capability: 'system.view',
    items: [{ label: 'System Status', href: '/admin/system' }],
  },
];

// Drives the sidebar: a group disappears entirely once every one of its
// items (or the group itself, for Dashboard) is gated above what this
// user can do — no dangling group header with nothing useful inside it.
export function visibleAdminNav(user: CapabilityUser | null | undefined): AdminNavGroup[] {
  return ADMIN_NAV.map((group) => {
    if (!group.items) {
      // Dashboard's shape today: no capability set, no submenu — visible
      // to any admin, same as every other group's default when a specific
      // item doesn't override it.
      if (!group.capability) return group;
      return hasCapability(user, group.capability) ? group : null;
    }
    const items = group.items.filter((item) => {
      const capability = item.capability ?? group.capability;
      return !capability || hasCapability(user, capability);
    });
    return items.length > 0 ? { ...group, items } : null;
  }).filter((group): group is AdminNavGroup => group !== null);
}
