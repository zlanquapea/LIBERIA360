"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ComponentType, SVGProps } from "react";
import {
  HomeIcon,
  MapPinIcon,
  BookmarkIcon,
  UserGroupIcon,
  CalendarDaysIcon,
} from "@heroicons/react/24/outline";
import {
  HomeIcon as HomeIconSolid,
  MapPinIcon as MapPinIconSolid,
  BookmarkIcon as BookmarkIconSolid,
  UserGroupIcon as UserGroupIconSolid,
  CalendarDaysIcon as CalendarDaysIconSolid,
} from "@heroicons/react/24/solid";

type IconComponent = ComponentType<SVGProps<SVGSVGElement>>;

// UX audit (Sep 5, 2026): "Saved" used to have exactly one link to it
// anywhere in the app — inside /account, which itself sends a signed-out
// visitor straight to /login. Saved places are explicitly device-local
// and need no account (see saved/page.tsx), so a guest who'd tapped
// "Save" on several place cards had no way back to that list at all.
// Added here so it's reachable regardless of sign-in state, same as
// every other tab.
const TABS: {
  href: string;
  label: string;
  icon: IconComponent;
  activeIcon: IconComponent;
}[] = [
  { href: "/", label: "Home", icon: HomeIcon, activeIcon: HomeIconSolid },
  {
    href: "/saved",
    label: "Saved",
    icon: BookmarkIcon,
    activeIcon: BookmarkIconSolid,
  },
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
  const activeIndex = TABS.findIndex((tab) =>
    tab.href === "/" ? pathname === "/" : pathname.startsWith(tab.href),
  );

  return (
    <nav
      aria-label="Primary navigation"
      className="fixed inset-x-0 bottom-0 z-30 border-t border-white/10 bg-brand-900/95 pt-1 text-white shadow-[0_-8px_24px_rgba(8,26,80,0.16)] backdrop-blur supports-[backdrop-filter]:bg-brand-900/85 lg:hidden"
    >
      <div className="relative mx-auto flex w-full max-w-md pb-[env(safe-area-inset-bottom)]">
        {/* One shared indicator that slides between tabs (translateX by
            index) instead of a separate bar fading in fresh under whichever
            tab is active — the same highlight moving over, not a new one
            appearing, reads as "you moved," which is the whole point of
            having an active-tab marker at all. `activeIndex < 0` (an
            unmatched route) just leaves it parked off the first tab,
            invisible via opacity rather than unmounted, so it has
            somewhere to transition *from* if the route then matches. */}
        <span
          aria-hidden
          className="absolute top-0 h-1 w-12 rounded-b-full bg-gold-400 transition-all duration-300 ease-out"
          style={{
            left: `${((Math.max(activeIndex, 0) + 0.5) / TABS.length) * 100}%`,
            transform: "translateX(-50%)",
            opacity: activeIndex < 0 ? 0 : 1,
          }}
        />
        {TABS.map((tab, i) => {
          const active = i === activeIndex;
          const Icon = active ? tab.activeIcon : tab.icon;
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={`relative flex min-h-[4.25rem] min-w-0 flex-1 touch-manipulation flex-col items-center justify-center gap-1 px-1 pb-1 pt-2 text-[11px] leading-none transition-colors active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-gold-400 sm:text-xs ${
                active
                  ? "font-semibold text-white"
                  : "text-white/65 hover:text-white"
              }`}
              aria-current={active ? "page" : undefined}
            >
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
