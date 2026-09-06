import type { ComponentType, SVGProps } from "react";
import {
  MapIcon,
  MapPinIcon,
  CalendarDaysIcon,
  TruckIcon,
  UserGroupIcon,
  BookmarkIcon,
  LifebuoyIcon,
  BuildingStorefrontIcon,
  ViewfinderCircleIcon,
  StarIcon,
} from "@heroicons/react/24/outline";

export type IconComponent = ComponentType<SVGProps<SVGSVGElement>>;

export interface SiteNavItem {
  href: string;
  label: string;
  icon: IconComponent;
}

// The site's persistent "section" links for the lg+ inline nav row in
// Header.tsx (plain text there, no icons rendered). Kept as its own list
// rather than reused verbatim by MobileMenu (see MOBILE_MENU_NAVIGATION
// below) — desktop has no BottomNav at all, so Counties/Events/Creators
// still need a way in here even though mobile already has them as tabs.
export const SITE_NAVIGATION: SiteNavItem[] = [
  { href: "/explore", label: "Explore", icon: MapIcon },
  { href: "/counties", label: "Counties", icon: MapPinIcon },
  { href: "/events", label: "Events", icon: CalendarDaysIcon },
  { href: "/car-rentals", label: "Car Rentals", icon: TruckIcon },
  { href: "/creators", label: "Creators", icon: UserGroupIcon },
  { href: "/saved", label: "Saved", icon: BookmarkIcon },
  { href: "/help", label: "Help", icon: LifebuoyIcon },
];

// MobileMenu's drawer content (Sep 6, 2026 revision): the first version
// just re-rendered SITE_NAVIGATION verbatim, which put Counties, Events,
// and Creators in the drawer *and* in BottomNav at the same time — the
// same three destinations reachable two different ways on one screen,
// crowding out room for things with no other way in on mobile at all.
// Dropped those three (still one tap away via BottomNav) and used the
// freed slots for real sections that otherwise have zero mobile
// entry point: Businesses and Featured have no nav presence anywhere
// below lg, and Near Me's radius search is exactly the kind of
// "quick access" this drawer exists for.
export const MOBILE_MENU_NAVIGATION: SiteNavItem[] = [
  { href: "/explore", label: "Explore", icon: MapIcon },
  { href: "/businesses", label: "Businesses", icon: BuildingStorefrontIcon },
  { href: "/car-rentals", label: "Car Rentals", icon: TruckIcon },
  { href: "/near-me", label: "Near Me", icon: ViewfinderCircleIcon },
  { href: "/featured", label: "Featured", icon: StarIcon },
  // UX audit (Sep 5, 2026): the only link to /saved anywhere in the app
  // used to live inside /account — unreachable for a signed-out guest,
  // even though saved places are explicitly account-free. Still true
  // here even after that fix moved the /account copy into its
  // quick-access grid (Sep 6, 2026): /account itself redirects a
  // signed-out visitor to /login before that grid ever renders, so this
  // drawer is the only guest-reachable path to Saved on a small screen.
  { href: "/saved", label: "Saved", icon: BookmarkIcon },
  { href: "/help", label: "Help", icon: LifebuoyIcon },
];
