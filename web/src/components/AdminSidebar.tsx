'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';

const SECTIONS = [
  { href: '/admin', label: 'Dashboard', icon: '📋', exact: true },
  { href: '/admin/content', label: 'Content', icon: '📝' },
  { href: '/admin/sponsored-placements', label: 'Sponsored placements', icon: '⭐' },
  { href: '/admin/analytics', label: 'B2B analytics', icon: '📊' },
] as const;

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
    ? [...SECTIONS, { href: '/admin/team', label: 'Team & Access', icon: '🔑', exact: false }]
    : SECTIONS;

  return (
    <nav className="flex shrink-0 gap-1 overflow-x-auto pb-2 lg:w-56 lg:flex-col lg:overflow-visible lg:pb-0">
      {items.map((item) => {
        const active = 'exact' in item && item.exact ? pathname === item.href : pathname.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? 'page' : undefined}
            className={`flex shrink-0 items-center gap-2 whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium transition ${
              active ? 'bg-brand-700 text-white' : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <span aria-hidden>{item.icon}</span>
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
