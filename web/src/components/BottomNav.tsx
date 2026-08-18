'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ComponentType, SVGProps } from 'react';
import { HomeIcon, MapIcon, MapPinIcon, BookmarkIcon } from '@heroicons/react/24/outline';
import {
  HomeIcon as HomeIconSolid,
  MapIcon as MapIconSolid,
  MapPinIcon as MapPinIconSolid,
  BookmarkIcon as BookmarkIconSolid,
} from '@heroicons/react/24/solid';

type IconComponent = ComponentType<SVGProps<SVGSVGElement>>;

const TABS: { href: string; label: string; icon: IconComponent; activeIcon: IconComponent }[] = [
  { href: '/', label: 'Home', icon: HomeIcon, activeIcon: HomeIconSolid },
  { href: '/explore', label: 'Explore', icon: MapIcon, activeIcon: MapIconSolid },
  { href: '/counties', label: 'Counties', icon: MapPinIcon, activeIcon: MapPinIconSolid },
  { href: '/saved', label: 'Saved', icon: BookmarkIcon, activeIcon: BookmarkIconSolid },
];

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="sticky bottom-0 z-10 flex border-t border-slate-200 bg-white/95 backdrop-blur">
      {TABS.map((tab) => {
        const active = tab.href === '/' ? pathname === '/' : pathname.startsWith(tab.href);
        const Icon = active ? tab.activeIcon : tab.icon;
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={`relative flex flex-1 flex-col items-center gap-0.5 py-2 text-xs transition-colors ${
              active ? 'font-semibold text-brand-700' : 'text-slate-500 hover:text-brand-600'
            }`}
            aria-current={active ? 'page' : undefined}
          >
            {active && (
              <span aria-hidden className="absolute top-0 h-0.5 w-8 rounded-full bg-brand-600 animate-fade-in" />
            )}
            <Icon aria-hidden className={`h-5 w-5 transition-transform ${active ? 'scale-110' : ''}`} />
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
