import { render, screen } from "@testing-library/react";
import { ItineraryStops } from "./ItineraryStops";
import type { ItineraryStopDetail } from "@/lib/types";

function stop(overrides: Partial<ItineraryStopDetail>): ItineraryStopDetail {
  return { day: 1, order: 0, notes: null, ...overrides };
}

describe("ItineraryStops thumbnails", () => {
  it("shows a photo thumbnail for a car listing stop that has one", () => {
    const stops: ItineraryStopDetail[] = [
      stop({
        carListing: {
          id: "car-1",
          title: "Toyota RAV4",
          category: "suv",
          pricePerDay: 60,
          images: ["/uploads/rav4.jpg"],
        } as never,
      }),
    ];
    // alt="" makes this a decorative image (role "presentation", not
    // "img") — same convention as PlaceCard/CarListingCard elsewhere —
    // so it's queried directly rather than via getByRole.
    const { container } = render(<ItineraryStops stops={stops} />);
    const img = container.querySelector("img");
    expect(img).toHaveAttribute("src", expect.stringContaining("rav4.jpg"));
  });

  it("falls back to the icon badge when a car listing stop has no images", () => {
    const stops: ItineraryStopDetail[] = [
      stop({
        carListing: {
          id: "car-1",
          title: "Toyota RAV4",
          category: "suv",
          pricePerDay: 60,
          images: [],
        } as never,
      }),
    ];
    const { container } = render(<ItineraryStops stops={stops} />);
    expect(container.querySelector("img")).not.toBeInTheDocument();
    expect(screen.getByText("Toyota RAV4")).toBeInTheDocument();
  });

  it("shows a photo thumbnail for a place stop that has one", () => {
    const stops: ItineraryStopDetail[] = [
      stop({
        place: {
          id: "place-1",
          slug: "ducor-hill",
          name: "Ducor Hill",
          type: "attraction",
          city: "Monrovia",
          images: ["/uploads/ducor.jpg"],
          category: { icon: "MapIcon", slug: "attractions" },
        } as never,
      }),
    ];
    const { container } = render(<ItineraryStops stops={stops} />);
    const img = container.querySelector("img");
    expect(img).toHaveAttribute("src", expect.stringContaining("ducor.jpg"));
  });
});
