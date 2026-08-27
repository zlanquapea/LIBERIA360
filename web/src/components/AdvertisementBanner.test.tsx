import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AdvertisementBanner } from "./AdvertisementBanner";
import type { Advertisement } from "@/lib/types";

jest.mock("./AdvertisementCard", () => ({
  AdvertisementCard: ({
    ad,
    cardRef,
  }: {
    ad: Advertisement;
    cardRef?: (element: HTMLDivElement | null) => void;
  }) => (
    <div ref={cardRef}>
      <span>{ad.title}</span>
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

describe("AdvertisementBanner", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    Element.prototype.scrollIntoView = jest.fn();
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it("renders a pause control and automatically advances real ad slides", async () => {
    render(
      <AdvertisementBanner
        ads={[makeAd("a1", "First ad"), makeAd("a2", "Second ad")]}
      />,
    );

    const pauseButton = screen.getByRole("button", {
      name: /pause sponsored advertisements/i,
    });
    expect(pauseButton).toHaveAttribute("aria-pressed", "false");

    await act(async () => {
      jest.advanceTimersByTime(6500);
    });

    expect(Element.prototype.scrollIntoView).toHaveBeenCalled();
  });

  it("pauses and resumes autoplay from the visible control", async () => {
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
    render(
      <AdvertisementBanner
        ads={[makeAd("a1", "First ad"), makeAd("a2", "Second ad")]}
      />,
    );

    const toggle = screen.getByRole("button", {
      name: /pause sponsored advertisements/i,
    });
    await user.click(toggle);
    expect(
      screen.getByRole("button", { name: /resume sponsored advertisements/i }),
    ).toHaveAttribute("aria-pressed", "true");

    await act(async () => {
      jest.advanceTimersByTime(6500);
    });
    expect(Element.prototype.scrollIntoView).not.toHaveBeenCalled();

    await user.click(
      screen.getByRole("button", { name: /resume sponsored advertisements/i }),
    );
    await act(async () => {
      jest.advanceTimersByTime(6500);
    });
    expect(Element.prototype.scrollIntoView).toHaveBeenCalled();
  });
});
