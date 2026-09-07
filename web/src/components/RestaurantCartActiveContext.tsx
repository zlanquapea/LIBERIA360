"use client";

import { createContext, useContext, useState, type ReactNode } from "react";

// Bug fix (Sep 2026): a restaurant's business page mounts two independent
// fixed/sticky footer bars — StickyBookingBar (rendered near the top of
// the page, right after the hero) and MenuSection's own order-summary bar
// (rendered further down, after "About this business"). Both anchor to
// roughly the same strip above BottomNav, and MenuSection's cart bar has
// no z-index of its own (it only ever needed to clear ordinary page
// content) — so once a visitor had items in their food order, scrolling
// to certain positions let StickyBookingBar's higher z-index render
// directly over the cart bar, hiding its price and "Review order" button
// entirely. Confirmed live: at that scroll position the cart bar was
// reduced to a barely visible sliver peeking out from behind "Ready to
// book your visit?".
//
// The two components are siblings several sections apart in the page's
// JSX, not adjacent, so a plain prop callback can't connect them — this
// context is the shared channel: MenuSection reports "an order is in
// progress" here, and StickyBookingBar reads it to skip rendering while
// that's true (reappearing the instant the cart empties or the order is
// placed). A restaurant's generic "come book a visit" nudge isn't worth
// fighting a visitor's own in-progress food order for the same footer
// space.
//
// Optional/no-op by default (`active: false`, `setActive` a no-op) so
// MenuSection keeps working unchanged on pages that never wrap it in
// RestaurantCartActiveProvider — e.g. the Place page, which shows the
// same ordering cart but has no StickyBookingBar to coordinate with.
const RestaurantCartActiveContext = createContext<{
  active: boolean;
  setActive: (active: boolean) => void;
}>({ active: false, setActive: () => {} });

export function RestaurantCartActiveProvider({ children }: { children: ReactNode }) {
  const [active, setActive] = useState(false);
  return (
    <RestaurantCartActiveContext.Provider value={{ active, setActive }}>
      {children}
    </RestaurantCartActiveContext.Provider>
  );
}

export function useRestaurantCartActive() {
  return useContext(RestaurantCartActiveContext);
}
