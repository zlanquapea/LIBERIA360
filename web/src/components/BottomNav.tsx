'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ComponentType, SVGProps } from 'react';
import { HomeIcon, MapIcon, UserGroupIcon, BookmarkIcon } from '@heroicons/react/24/outline';
import {
  HomeIcon as HomeIconSolid,
  MapIcon as MapIconSolid,
  UserGroupIcon as UserGroupIconSolid,
  BookmarkIcon as BookmarkIconSolid,
} from '@heroicons/react/24/solid';

type IconComponent = ComponentType<SVGProps<SVGSVGElement>>;

const TABS: { href: string; label: string; icon: IconComponent; activeIcon: IconComponent }[] = [
  { href: '/', label: 'Home', icon: HomeIcon, activeIcon: HomeIconSolid },
  { href: '/explore', label: 'Explore', icon: MapIcon, activeIcon: MapIconSolid },
  { href: '/creators', label: 'Creators', icon: UserGroupIcon, activeIcon: UserGroupIconSolid },
  { href: '/saved', label: 'Saved', icon: BookmarkIcon, activeIcon: BookmarkIconSolid },
];

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed inset-x-0 bottom-0 z-30 flex border-t border-white/10 bg-brand-900/95 pb-[env(safe-area-inset-bottom)] text-white shadow-[0_-8px_24px_rgba(8,26,80,0.16)] backdrop-blur lg:hidden">
      {TABS.map((tab) => {
        const active = tab.href === '/' ? pathname === '/' : pathname.startsWith(tab.href);
        const Icon = active ? tab.activeIcon : tab.icon;
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={`relative flex min-h-16 flex-1 flex-col items-center gap-0.5 py-2 text-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-gold-400 ${
              active ? 'font-semibold text-white' : 'text-white/65 hover:text-white'
            }`}
            aria-current={active ? 'page' : undefined}
          >
            {active && (
              <span aria-hidden className="absolute top-0 h-1 w-12 rounded-b-full bg-gold-400 animate-fade-in" />
            )}
            <Icon aria-hidden className={`h-5 w-5 transition-transform ${active ? 'scale-110' : ''}`} />
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
