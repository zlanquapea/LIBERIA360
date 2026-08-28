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

  // Regression test for "the home page keeps scrolling down by itself" —
  // a previous version auto-advanced slides on a timer via scrollIntoView,
  // which could also nudge the page's own vertical scroll (see this
  // component's doc comment). Navigation must only ever happen from an
  // explicit click/drag, never on its own after time passes.
  it("never advances slides on its own — no timer-driven scrollIntoView calls", async () => {
    render(
      <AdvertisementBanner
        ads={[makeAd("a1", "First ad"), makeAd("a2", "Second ad")]}
      />,
    );

    await act(async () => {
      jest.advanceTimersByTime(60_000);
    });

    expect(Element.prototype.scrollIntoView).not.toHaveBeenCalled();
  });

  it("only scrolls in response to an explicit arrow click", async () => {
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
    render(
      <AdvertisementBanner
        ads={[makeAd("a1", "First ad"), makeAd("a2", "Second ad")]}
      />,
    );

    expect(Element.prototype.scrollIntoView).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: /next ad/i }));

    expect(Element.prototype.scrollIntoView).toHaveBeenCalledTimes(1);
  });
});
