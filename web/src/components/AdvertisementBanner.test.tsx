import { act, fireEvent, render, screen } from "@testing-library/react";
import { AdvertisementBanner } from "./AdvertisementBanner";
import type { Advertisement } from "@/lib/types";

jest.mock("./AdvertisementCard", () => ({
  AdvertisementCard: ({
    ad,
    onDismiss,
  }: {
    ad: Advertisement & { sponsorLabel: "Sponsored" };
    onDismiss: () => void;
  }) => (
    <article data-testid={`ad-${ad.id}`}>
      <span>{ad.sponsorLabel}</span>
      <h3>{ad.title}</h3>
      <p>{ad.description}</p>
      <button type="button" onClick={onDismiss}>
        Dismiss {ad.title}
      </button>
    </article>
  ),
}));

function makeAd(
  id: string,
  title: string,
  overrides: Partial<Advertisement> = {},
): Advertisement {
  return {
    id,
    owner: null,
    ownerUserId: "owner-1",
    type: "business",
    title,
    description: `${title} description`,
    images: ["photo.jpg"],
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
    ...overrides,
  };
}

const ads = [
  makeAd("a1", "First ad"),
  makeAd("a2", "Second ad"),
  makeAd("a3", "Third ad"),
];

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

describe("AdvertisementBanner horizontal carousel", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    mockMotionPreference(false);
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      value: "visible",
    });
    jest
      .spyOn(HTMLElement.prototype, "getBoundingClientRect")
      .mockImplementation(() => ({
        width: 300,
        height: 240,
        top: 0,
        right: 300,
        bottom: 240,
        left: 0,
        x: 0,
        y: 0,
        toJSON: () => ({}),
      }));
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it("renders structured Sponsored cards with an intentional next-card peek", () => {
    render(<AdvertisementBanner ads={ads} />);

    expect(
      screen.getByRole("heading", { name: "Sponsored" }),
    ).toBeInTheDocument();
    expect(screen.getAllByText("Sponsored")).toHaveLength(4);
    expect(screen.getByText("First ad description")).toBeInTheDocument();
    expect(screen.getByText("Second ad description")).toBeInTheDocument();
    expect(screen.getByTestId("ad-a2").parentElement).toHaveClass(
      "w-[calc(100%-2.5rem)]",
    );
  });

  it("slides horizontally to the next card after five seconds", () => {
    render(<AdvertisementBanner ads={ads} />);
    const track = screen.getByTestId("ad-a1").parentElement?.parentElement;
    expect(track).toBeInTheDocument();

    act(() => {
      jest.advanceTimersByTime(5000);
    });

    expect(track).toHaveStyle({
      transform: "translate3d(-300px, 0, 0)",
      transition: "transform 360ms ease-in-out",
    });
  });

  it("pauses immediately on pointer interaction and resumes five seconds after inactivity", () => {
    render(<AdvertisementBanner ads={ads} />);
    const region = screen.getByRole("region", {
      name: "Sponsored advertisements",
    });
    const track = screen.getByTestId("ad-a1").parentElement?.parentElement;

    fireEvent.pointerDown(region, { clientX: 200, clientY: 100, pointerId: 1 });
    act(() => {
      jest.advanceTimersByTime(5000);
    });
    expect(track).toHaveStyle({ transform: "translate3d(0px, 0, 0)" });

    fireEvent.pointerUp(region, { clientX: 200, clientY: 100, pointerId: 1 });
    act(() => {
      jest.advanceTimersByTime(4999);
    });
    expect(track).toHaveStyle({ transform: "translate3d(0px, 0, 0)" });

    act(() => {
      jest.advanceTimersByTime(1);
    });
    act(() => {
      jest.advanceTimersByTime(5000);
    });
    expect(track).toHaveStyle({ transform: "translate3d(-300px, 0, 0)" });
  });

  it("supports arrow-key navigation when the carousel is focused", () => {
    render(<AdvertisementBanner ads={ads} />);
    const region = screen.getByRole("region", {
      name: "Sponsored advertisements",
    });
    const track = screen.getByTestId("ad-a1").parentElement?.parentElement;

    fireEvent.keyDown(region, { key: "ArrowRight" });
    expect(track).toHaveStyle({ transform: "translate3d(-300px, 0, 0)" });

    fireEvent.keyDown(region, { key: "ArrowLeft" });
    expect(track).toHaveStyle({ transform: "translate3d(0px, 0, 0)" });
  });

  it("disables autoplay and slide motion when reduced motion is requested", () => {
    mockMotionPreference(true);
    render(<AdvertisementBanner ads={ads} />);
    const track = screen.getByTestId("ad-a1").parentElement?.parentElement;

    act(() => {
      jest.advanceTimersByTime(10000);
    });
    expect(track).toHaveStyle({
      transform: "translate3d(0px, 0, 0)",
      transition: "none",
    });
  });

  it("pauses autoplay while the document is hidden", () => {
    render(<AdvertisementBanner ads={ads} />);
    const track = screen.getByTestId("ad-a1").parentElement?.parentElement;

    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      value: "hidden",
    });
    fireEvent(document, new Event("visibilitychange"));
    act(() => {
      jest.advanceTimersByTime(5000);
    });
    expect(track).toHaveStyle({ transform: "translate3d(0px, 0, 0)" });
  });
});
