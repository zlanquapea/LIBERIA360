"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ComponentType, SVGProps } from "react";
import {
  HomeIcon,
  MapPinIcon,
  UserGroupIcon,
  CalendarDaysIcon,
} from "@heroicons/react/24/outline";
import {
  HomeIcon as HomeIconSolid,
  MapPinIcon as MapPinIconSolid,
  UserGroupIcon as UserGroupIconSolid,
  CalendarDaysIcon as CalendarDaysIconSolid,
} from "@heroicons/react/24/solid";

type IconComponent = ComponentType<SVGProps<SVGSVGElement>>;

const TABS: {
  href: string;
  label: string;
  icon: IconComponent;
  activeIcon: IconComponent;
}[] = [
  { href: "/", label: "Home", icon: HomeIcon, activeIcon: HomeIconSolid },
  {
    href: "/counties",
    label: "Counties",
    icon: MapPinIcon,
    activeIcon: MapPinIconSolid,
  },
  {
    href: "/creators",
    label: "Creators",
    icon: UserGroupIcon,
    activeIcon: UserGroupIconSolid,
  },
  {
    href: "/events",
    label: "Events",
    icon: CalendarDaysIcon,
    activeIcon: CalendarDaysIconSolid,
  },
];

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Primary navigation"
      className="fixed inset-x-0 bottom-0 z-30 border-t border-white/10 bg-brand-900/95 pt-1 text-white shadow-[0_-8px_24px_rgba(8,26,80,0.16)] backdrop-blur supports-[backdrop-filter]:bg-brand-900/85 lg:hidden"
    >
      <div className="mx-auto flex w-full max-w-md pb-[env(safe-area-inset-bottom)]">
        {TABS.map((tab) => {
          const active =
            tab.href === "/" ? pathname === "/" : pathname.startsWith(tab.href);
          const Icon = active ? tab.activeIcon : tab.icon;
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={`relative flex min-h-[4.25rem] min-w-0 flex-1 touch-manipulation flex-col items-center justify-center gap-1 px-1 pb-1 pt-2 text-[11px] leading-none transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-gold-400 sm:text-xs ${
                active
                  ? "font-semibold text-white"
                  : "text-white/65 hover:text-white"
              }`}
              aria-current={active ? "page" : undefined}
            >
              {active && (
                <span
                  aria-hidden
                  className="absolute top-0 h-1 w-12 rounded-b-full bg-gold-400 animate-fade-in"
                />
              )}
              <Icon
                aria-hidden
                className={`h-5 w-5 shrink-0 transition-transform ${active ? "scale-110" : ""}`}
              />
              <span className="truncate">{tab.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
