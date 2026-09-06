import type { ComponentType, SVGProps } from "react";
import {
  MapIcon,
  MapPinIcon,
  CalendarDaysIcon,
  TruckIcon,
  UserGroupIcon,
  BookmarkIcon,
  LifebuoyIcon,
} from "@heroicons/react/24/outline";

export type IconComponent = ComponentType<SVGProps<SVGSVGElement>>;

export interface SiteNavItem {
  href: string;
  label: string;
  icon: IconComponent;
}

// The site's persistent "section" links — previously defined inline in
// Header.tsx and rendered only in its lg+ inline nav row. Pulled out here
// (Sep 6, 2026) so MobileMenu's hamburger drawer can render the exact same
// list below lg, rather than a mobile visitor having no way to reach
// Car Rentals/Saved/Help at all short of already knowing the URL —
// BottomNav's five slots cover what's worth a permanent tab (see its own
// doc comment), everything else here just needs *a* way in on mobile.
export const SITE_NAVIGATION: SiteNavItem[] = [
  { href: "/explore", label: "Explore", icon: MapIcon },
  { href: "/counties", label: "Counties", icon: MapPinIcon },
  { href: "/events", label: "Events", icon: CalendarDaysIcon },
  { href: "/car-rentals", label: "Car Rentals", icon: TruckIcon },
  { href: "/creators", label: "Creators", icon: UserGroupIcon },
  // UX audit (Sep 5, 2026): the only link to /saved anywhere in the app
  // used to live inside /account — unreachable for a signed-out guest,
  // even though saved places are explicitly account-free. Still true here
  // on mobile even after that fix moved the /account copy into its
  // quick-access grid (Sep 6, 2026): /account itself redirects a
  // signed-out visitor to /login before that grid ever renders, so this
  // entry is the only guest-reachable path to Saved on a small screen.
  { href: "/saved", label: "Saved", icon: BookmarkIcon },
  { href: "/help", label: "Help", icon: LifebuoyIcon },
];
