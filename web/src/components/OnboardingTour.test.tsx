import { act, fireEvent, render, screen } from "@testing-library/react";
import { OnboardingTour } from "./OnboardingTour";
import type { Place } from "@/lib/types";

function fetchResponse(body: unknown) {
  return { ok: true, json: async () => body } as Response;
}

const PLACE_WITH_PHOTO: Place = {
  id: "p1",
  name: "Sunset Beach",
  slug: "sunset-beach",
  description: "A beach.",
  type: "nature_site",
  category: { id: "c1", name: "Nature", slug: "nature", description: null, icon: "MapIcon" },
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
  images: ["/uploads/beach.jpg"],
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
  featured: true,
  reviewStatus: "approved",
  ownerUserId: null,
  rejectionReason: null,
  submittedAt: null,
  reviewedAt: null,
  reviewedByUserId: null,
};

describe("OnboardingTour", () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    jest.useFakeTimers();
    // Empty catalog by default — every step falls back to its icon badge,
    // matching the pre-photo test expectations below.
    global.fetch = jest.fn().mockResolvedValue(fetchResponse({ data: [] }));
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
    global.fetch = originalFetch;
  });

  it("shows nothing until the splash screen's own display window has passed on a first-ever visit", () => {
    render(<OnboardingTour />);
    expect(
      screen.queryByRole("dialog", { name: "Welcome to LIBERIA360" }),
    ).not.toBeInTheDocument();

    act(() => jest.advanceTimersByTime(2650));
    expect(
      screen.getByRole("dialog", { name: "Welcome to LIBERIA360" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Discover all of Liberia")).toBeInTheDocument();
  });

  it("shows immediately when splash already ran earlier this session", () => {
    sessionStorage.setItem("liberia360:splash-seen", "1");
    render(<OnboardingTour />);

    act(() => jest.advanceTimersByTime(0));
    expect(
      screen.getByRole("dialog", { name: "Welcome to LIBERIA360" }),
    ).toBeInTheDocument();
  });

  it("never shows again once dismissed via Skip", () => {
    const { unmount } = render(<OnboardingTour />);
    act(() => jest.advanceTimersByTime(2650));
    fireEvent.click(screen.getByRole("button", { name: "Skip" }));
    expect(
      screen.queryByRole("dialog", { name: "Welcome to LIBERIA360" }),
    ).not.toBeInTheDocument();
    expect(localStorage.getItem("liberia360:onboarding-seen")).toBe("1");

    unmount();
    render(<OnboardingTour />);
    act(() => jest.advanceTimersByTime(5000));
    expect(
      screen.queryByRole("dialog", { name: "Welcome to LIBERIA360" }),
    ).not.toBeInTheDocument();
  });

  it("advances through steps via Next and dismisses on the last step's Get started", () => {
    render(<OnboardingTour />);
    act(() => jest.advanceTimersByTime(2650));

    const nextButton = screen.getByRole("button", { name: "Next" });
    expect(screen.getByText("Discover all of Liberia")).toBeInTheDocument();

    // The Next button navigates via scrollIntoView, which jsdom doesn't
    // implement — stub it so the click handler runs without throwing;
    // the real scroll-position → active-index sync is exercised by the
    // IntersectionObserver-style scroll listener, not asserted here.
    Element.prototype.scrollIntoView = jest.fn();

    fireEvent.click(nextButton);
    fireEvent.click(nextButton);
    expect(screen.getByRole("button", { name: "Get started" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Get started" }));
    expect(
      screen.queryByRole("dialog", { name: "Welcome to LIBERIA360" }),
    ).not.toBeInTheDocument();
    expect(localStorage.getItem("liberia360:onboarding-seen")).toBe("1");
  });

  // Visual pass (Sep 6, 2026): "show the beauty of Liberia, not just
  // text" — steps now show a real catalog photo behind their title when
  // the platform has one, instead of always falling back to a plain icon
  // badge.
  it("shows a real catalog photo behind a step when the platform has one", async () => {
    global.fetch = jest.fn().mockResolvedValue(fetchResponse({ data: [PLACE_WITH_PHOTO] }));

    render(<OnboardingTour />);
    // Flush the fetch → res.json() → setState promise chain's several
    // microtask hops under fake timers (real Promise microtasks aren't
    // affected by jest's fake timers, only setTimeout/setInterval are).
    await act(async () => {
      for (let i = 0; i < 10; i += 1) {
        await Promise.resolve();
      }
    });
    act(() => jest.advanceTimersByTime(2650));

    expect(screen.getByText("Discover all of Liberia")).toBeInTheDocument();
    // The dialog renders via a portal to document.body, so it's a sibling
    // of RTL's own `container` div, not a descendant of it — query the
    // document directly. `alt=""` marks the photo decorative (the title/
    // description already carry the meaning), so it has no accessible
    // "img" role to query by — check the rendered <img> element itself.
    const img = document.querySelector("img");
    expect(img).toHaveAttribute("src", expect.stringContaining("beach.jpg"));
  });

  it("falls back to the icon badge when the catalog has no photographed places", () => {
    render(<OnboardingTour />);
    act(() => jest.advanceTimersByTime(2650));

    expect(screen.getByText("Discover all of Liberia")).toBeInTheDocument();
    expect(document.querySelector("img")).not.toBeInTheDocument();
  });

  // Regression (Sep 6, 2026): this modal is a real, clickable overlay —
  // unlike SplashScreen it can't set itself `pointer-events: none` (Skip/
  // Next/swipe need genuine pointer events) — so a fresh Playwright
  // browser context with no localStorage entry for it popped up mid-test
  // and ate every subsequent click across six unrelated e2e specs.
  it("never shows under an automated browser (navigator.webdriver)", () => {
    const originalWebdriver = Object.getOwnPropertyDescriptor(window.navigator, "webdriver");
    Object.defineProperty(window.navigator, "webdriver", { value: true, configurable: true });

    render(<OnboardingTour />);
    act(() => jest.advanceTimersByTime(5000));
    expect(
      screen.queryByRole("dialog", { name: "Welcome to LIBERIA360" }),
    ).not.toBeInTheDocument();

    if (originalWebdriver) {
      Object.defineProperty(window.navigator, "webdriver", originalWebdriver);
    } else {
      delete (window.navigator as { webdriver?: boolean }).webdriver;
    }
  });
});
