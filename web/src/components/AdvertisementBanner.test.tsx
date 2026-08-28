import { act, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AdvertisementBanner } from "./AdvertisementBanner";
import type { Advertisement } from "@/lib/types";

jest.mock("./AdvertisementCard", () => ({
  AdvertisementCard: ({
    ad,
    onDismiss,
    shimmerActive,
  }: {
    ad: Advertisement;
    onDismiss: () => void;
    shimmerActive?: boolean;
  }) => (
    <div data-testid={`ad-${ad.id}`} data-shimmer={shimmerActive ? "true" : "false"}>
      <span>{ad.title}</span>
      <button type="button" onClick={onDismiss}>
        Dismiss {ad.title}
      </button>
    </div>
  ),
}));

function makeAd(id: string, title: string): Advertisement {
  return {
    id,
    owner: null,
    ownerUserId: "owner-1",
    type: "business",
    title,
    description: `${title} description`,
    images: [],
    priceLabel: null,
    contactPhone: null,
    contactWhatsapp: null,
    contactEmail: null,
    externalLink: null,
    reviewStatus: "approved",
    rejectionReason: null,
    submittedAt: null,
    reviewedAt: null,
    reviewedByUserId: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  };
}

function mockMotionPreference(reduced = false) {
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    value: jest.fn().mockImplementation(() => ({
      matches: reduced,
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
    })),
  });
}

const ads = [
  makeAd("a1", "First ad"),
  makeAd("a2", "Second ad"),
  makeAd("a3", "Third ad"),
];

describe("AdvertisementBanner crossfade", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    mockMotionPreference(false);
    jest
      .spyOn(window, "requestAnimationFrame")
      .mockImplementation((callback) => {
        callback(0);
        return 1;
      });
    jest.spyOn(window, "cancelAnimationFrame").mockImplementation(() => {});
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      value: "visible",
    });
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it("keeps one fixed container and crossfades the next ad in the same position", async () => {
    render(<AdvertisementBanner ads={ads} />);

    const container = screen.getByTestId("sponsored-crossfade-container");
    expect(within(container).getByText("First ad")).toBeInTheDocument();
    expect(within(container).queryByText("Second ad")).not.toBeInTheDocument();

    await act(async () => {
      jest.advanceTimersByTime(6000);
    });

    const current = container.querySelector('[data-transition-layer="current"]');
    const incoming = container.querySelector('[data-transition-layer="incoming"]');
    expect(current).toHaveTextContent("First ad");
    expect(incoming).toHaveTextContent("Second ad");
    expect(current).toHaveStyle({ opacity: "0" });
    expect(incoming).toHaveStyle({ opacity: "1", transform: "translateZ(0) scale(1)" });

    await act(async () => {
      jest.advanceTimersByTime(260);
    });
    expect(within(container).queryByText("First ad")).not.toBeInTheDocument();
    expect(within(container).getByText("Second ad")).toBeInTheDocument();
    expect(container.querySelector('[data-transition-layer="incoming"]')).toBeNull();
  });

  it("locks navigation during a transition and resets autoplay after manual navigation", async () => {
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
    render(<AdvertisementBanner ads={ads} />);

    const next = screen.getByRole("button", { name: "Next ad" });
    await user.click(next);
    fireEvent.blur(next, { relatedTarget: null });
    expect(next).toBeDisabled();
    expect(screen.getByText("Second ad")).toBeInTheDocument();

    await user.click(next);
    expect(screen.queryByText("Third ad")).not.toBeInTheDocument();

    await act(async () => {
      jest.advanceTimersByTime(260);
    });
    await act(async () => {
      jest.advanceTimersByTime(5999);
    });
    expect(screen.queryByText("Third ad")).not.toBeInTheDocument();

    await act(async () => {
      jest.advanceTimersByTime(1);
    });
    expect(screen.getByText("Third ad")).toBeInTheDocument();
  });

  it("uses a swipe only to select the next ad and still renders an in-place incoming layer", () => {
    render(<AdvertisementBanner ads={ads} />);
    const container = screen.getByTestId("sponsored-crossfade-container");

    fireEvent.touchStart(container, {
      touches: [{ clientX: 240, clientY: 100 }],
    });
    fireEvent.touchEnd(container, {
      changedTouches: [{ clientX: 120, clientY: 104 }],
    });

    expect(
      container.querySelector('[data-transition-layer="incoming"]'),
    ).toHaveTextContent("Second ad");
  });

  it("pauses and resumes the six-second autoplay timer", async () => {
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
    render(<AdvertisementBanner ads={ads} />);

    await user.click(
      screen.getByRole("button", { name: /pause sponsored advertisements/i }),
    );
    await act(async () => {
      jest.advanceTimersByTime(6000);
    });
    expect(screen.queryByText("Second ad")).not.toBeInTheDocument();

    await user.click(
      screen.getByRole("button", { name: /resume sponsored advertisements/i }),
    );
    await act(async () => {
      jest.advanceTimersByTime(6000);
    });
    expect(screen.getByText("Second ad")).toBeInTheDocument();
  });

  it("removes incoming scale motion when reduced motion is requested", async () => {
    mockMotionPreference(true);
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
    render(<AdvertisementBanner ads={ads} />);

    await user.click(screen.getByRole("button", { name: "Next ad" }));
    const incoming = screen
      .getByTestId("sponsored-crossfade-container")
      .querySelector('[data-transition-layer="incoming"]');
    expect(incoming).toHaveStyle({
      transform: "translateZ(0) scale(1)",
      transitionDuration: "60ms",
    });
  });
});
