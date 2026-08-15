'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const TABS = [
  { href: '/', label: 'Home', icon: '🏠' },
  { href: '/explore', label: 'Explore', icon: '🗺️' },
  { href: '/counties', label: 'Counties', icon: '📍' },
  { href: '/saved', label: 'Saved', icon: '🔖' },
] as const;

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="sticky bottom-0 z-10 flex border-t border-slate-200 bg-white/95 backdrop-blur">
      {TABS.map((tab) => {
        const active = tab.href === '/' ? pathname === '/' : pathname.startsWith(tab.href);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={`flex flex-1 flex-col items-center gap-0.5 py-2 text-xs ${
              active ? 'font-semibold text-brand-700' : 'text-slate-500'
            }`}
            aria-current={active ? 'page' : undefined}
          >
            <span aria-hidden className="text-lg">
              {tab.icon}
            </span>
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
