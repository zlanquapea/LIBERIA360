'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ComponentType, SVGProps } from 'react';
import { Squares2X2Icon, DocumentTextIcon, StarIcon, ChartBarIcon, KeyIcon } from '@heroicons/react/24/outline';
import { useAuth } from '@/hooks/useAuth';

type IconComponent = ComponentType<SVGProps<SVGSVGElement>>;

const SECTIONS: { href: string; label: string; icon: IconComponent; exact?: boolean }[] = [
  { href: '/admin', label: 'Dashboard', icon: Squares2X2Icon, exact: true },
  { href: '/admin/content', label: 'Content', icon: DocumentTextIcon },
  { href: '/admin/sponsored-placements', label: 'Sponsored placements', icon: StarIcon },
  { href: '/admin/analytics', label: 'B2B analytics', icon: ChartBarIcon },
];

// Persistent nav across every /admin/* page (rendered by admin/layout.tsx)
// so switching sections doesn't mean navigating back to the dashboard
// home first. "Team & Access" only appears for a super admin — a regular
// admin can't manage who else has access (SuperAdminGuard on the API
// side is the real enforcement; hiding the link here is just not
// dangling a link that would 403).
export function AdminSidebar() {
  const pathname = usePathname();
  const { user } = useAuth();

  const items = user?.isSuperAdmin
    ? [...SECTIONS, { href: '/admin/team', label: 'Team & Access', icon: KeyIcon, exact: false }]
    : SECTIONS;

  return (
    <nav className="flex shrink-0 gap-1 overflow-x-auto pb-2 lg:w-56 lg:flex-col lg:overflow-visible lg:pb-0">
      {items.map((item) => {
        const active = item.exact ? pathname === item.href : pathname.startsWith(item.href);
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? 'page' : undefined}
            className={`flex shrink-0 items-center gap-2 whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
              active ? 'bg-brand-700 text-white' : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <Icon aria-hidden className="h-4 w-4" />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
