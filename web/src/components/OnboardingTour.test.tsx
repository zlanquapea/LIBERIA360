import { act, fireEvent, render, screen } from "@testing-library/react";
import { OnboardingTour } from "./OnboardingTour";

describe("OnboardingTour", () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
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
