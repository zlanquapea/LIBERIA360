import { act, render, screen } from "@testing-library/react";
import { StickyBookingBar } from "./StickyBookingBar";
import type { Business, Place } from "@/lib/types";

class MockIntersectionObserver {
  static instance: MockIntersectionObserver;
  callback: IntersectionObserverCallback;
  observe = jest.fn();
  disconnect = jest.fn();

  constructor(callback: IntersectionObserverCallback) {
    this.callback = callback;
    MockIntersectionObserver.instance = this;
  }

  trigger(entry: Partial<IntersectionObserverEntry>) {
    this.callback(
      [
        {
          isIntersecting: false,
          boundingClientRect: { top: 0 } as DOMRectReadOnly,
          ...entry,
        } as IntersectionObserverEntry,
      ],
      this as unknown as IntersectionObserver,
    );
  }
}

const PLACE: Place = {
  id: "p1",
  name: "Sunset Lodge",
  slug: "sunset-lodge",
  description: "A lodge overlooking the coast.",
  type: "hotel",
  category: { id: "c1", name: "Hotels & Lodges", slug: "hotels-lodges", description: null, icon: "HomeIcon" },
  tags: [],
  county: {
    id: "co1",
    name: "Montserrado",
    slug: "montserrado",
    rolloutStage: 1,
    icon: null,
    emergencyNumber: null,
    safetyTips: [],
    localCustoms: null,
  },
  city: "Monrovia",
  latitude: 6.3,
  longitude: -10.8,
  distanceFromMonroviaKm: 5,
  recommendedVisitLength: null,
  estimatedCostEntry: null,
  estimatedCostGuide: null,
  estimatedCostTransport: null,
  images: [],
  videos: [],
  openingHours: null,
  structuredHours: null,
  contactPhone: null,
  whatsapp: null,
  website: null,
  instagram: null,
  facebook: null,
  rating: 4.5,
  reviewCount: 3,
  verificationStatus: "verified",
  featured: false,
  reviewStatus: "approved",
  ownerUserId: null,
  rejectionReason: null,
  submittedAt: null,
  reviewedAt: null,
  reviewedByUserId: null,
};

const BUSINESS: Business = {
  id: "b1",
  name: "Sunset Lodge",
  slug: "sunset-lodge",
  type: "hotel",
  // A defined, distinct owner — not null — so BookingRequestSection's
  // `user?.id === business.owner?.id` isOwner check compares two real
  // values instead of `undefined === undefined` (true) when both the
  // signed-out test viewer and an unclaimed business.owner are absent.
  owner: {
    id: "owner-1",
    name: "Lodge Owner",
    email: "owner@example.com",
    phone: null,
    authProvider: "local",
    homeCounty: null,
    isAdmin: false,
    isSuperAdmin: false,
    travelerType: null,
    interests: [],
    twoFactorEnabled: false,
    emailVerified: true,
    createdAt: "2026-01-01T00:00:00.000Z",
    pendingActivation: false,
  },
  linkedPlaceId: PLACE.id,
  linkedPlace: PLACE,
  phone: null,
  whatsapp: null,
  email: null,
  website: null,
  socialLinks: [],
  description: null,
  images: [],
  logoImage: null,
  videos: [],
  openingHours: null,
  priceRangeMin: null,
  priceRangeMax: null,
  servicesOffered: [],
  reviewStatus: "approved",
  rejectionReason: null,
  submittedAt: null,
  reviewedAt: null,
  reviewedByUserId: null,
  verificationStatus: "verified",
  subscriptionTier: "free",
  createdAt: "2026-01-01T00:00:00.000Z",
};

describe("StickyBookingBar", () => {
  const originalIntersectionObserver = window.IntersectionObserver;

  beforeEach(() => {
    window.IntersectionObserver =
      MockIntersectionObserver as unknown as typeof IntersectionObserver;
  });

  afterEach(() => {
    window.IntersectionObserver = originalIntersectionObserver;
  });

  it("renders the booking CTA hidden (translated off-screen) until its anchor scrolls above the viewport", async () => {
    render(<StickyBookingBar business={BUSINESS} name={PLACE.name} />);

    // { hidden: true } — the bar is aria-hidden while off-screen (by
    // design: it's not reachable while translated below the viewport), so
    // the default accessible query would never find it there.
    const link = await screen.findByRole("link", {
      name: /log in to request a booking/i,
      hidden: true,
    });
    const bar = link.closest('[aria-hidden]') as HTMLElement;
    expect(bar).toHaveClass("translate-y-full");
    expect(bar).toHaveAttribute("aria-hidden", "true");
    expect(bar).toHaveAttribute("inert");

    act(() => {
      MockIntersectionObserver.instance.trigger({
        isIntersecting: false,
        boundingClientRect: { top: -50 } as DOMRectReadOnly,
      });
    });

    expect(bar).toHaveClass("translate-y-0");
    expect(bar).toHaveAttribute("aria-hidden", "false");
    expect(bar).not.toHaveAttribute("inert");
  });

  it("hides again once the anchor scrolls back into view", async () => {
    render(<StickyBookingBar business={BUSINESS} name={PLACE.name} />);
    // { hidden: true } — the bar is aria-hidden while off-screen (by
    // design: it's not reachable while translated below the viewport), so
    // the default accessible query would never find it there.
    const link = await screen.findByRole("link", {
      name: /log in to request a booking/i,
      hidden: true,
    });
    const bar = link.closest('[aria-hidden]') as HTMLElement;

    act(() => {
      MockIntersectionObserver.instance.trigger({
        isIntersecting: false,
        boundingClientRect: { top: -50 } as DOMRectReadOnly,
      });
    });
    expect(bar).toHaveClass("translate-y-0");

    act(() => {
      MockIntersectionObserver.instance.trigger({ isIntersecting: true });
    });
    expect(bar).toHaveClass("translate-y-full");
  });
});
