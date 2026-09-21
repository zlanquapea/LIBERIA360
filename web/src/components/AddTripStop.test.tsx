import { fireEvent, screen, waitFor } from "@testing-library/react";
import { renderWithMessages } from "@/test/render-with-messages";
import { AddTripStop } from "./AddTripStop";
import type { Place } from "@/lib/types";

const mockUseAuth = jest.fn();
const mockGetPlaces = jest.fn();
const mockGetEvents = jest.fn();
const mockGetCarListings = jest.fn();
const mockAddItineraryStop = jest.fn();

jest.mock("../hooks/useAuth", () => ({
  useAuth: () => mockUseAuth(),
}));
jest.mock("../lib/api", () => ({
  getPlaces: (...args: unknown[]) => mockGetPlaces(...args),
  getEvents: (...args: unknown[]) => mockGetEvents(...args),
  getCarListings: (...args: unknown[]) => mockGetCarListings(...args),
}));
jest.mock("../lib/itinerary-api", () => ({
  addItineraryStop: (...args: unknown[]) => mockAddItineraryStop(...args),
}));

const PLACE: Place = {
  id: "place-1",
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
  featured: true,
  reviewStatus: "approved",
  ownerUserId: null,
  rejectionReason: null,
  submittedAt: null,
  reviewedAt: null,
  reviewedByUserId: null,
};

describe("AddTripStop", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseAuth.mockReturnValue({ token: "tok" });
    mockGetPlaces.mockResolvedValue({ data: [PLACE] });
    mockGetEvents.mockResolvedValue({ data: [] });
    mockGetCarListings.mockResolvedValue({ data: [] });
    mockAddItineraryStop.mockResolvedValue({});
  });

  // Regression: a day beyond the trip's own duration used to be typeable
  // (the day input's max was hardcoded to at least 30 regardless of how
  // short the trip actually was). Day selection is now a row of chips
  // bounded to exactly the trip's real length — there's no way to pick
  // an out-of-range day at all.
  it("shows day chips bounded to the trip's own duration, not a fixed 30", () => {
    renderWithMessages(<AddTripStop itineraryId="trip-1" durationDays={3} onAdded={jest.fn()} />);
    expect(screen.getByRole("button", { name: "Day 1" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Day 3" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Day 4" })).not.toBeInTheDocument();
  });

  it("hides the day-chip row for a single-day trip", () => {
    renderWithMessages(<AddTripStop itineraryId="trip-1" durationDays={1} onAdded={jest.fn()} />);
    expect(screen.queryByRole("button", { name: "Day 1" })).not.toBeInTheDocument();
  });

  it("adds a found place to the currently selected day", async () => {
    renderWithMessages(<AddTripStop itineraryId="trip-1" durationDays={3} onAdded={jest.fn()} />);
    fireEvent.change(screen.getByPlaceholderText("Search places…"), {
      target: { value: "beach" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Search" }));

    await waitFor(() => expect(screen.getByText("Sunset Beach")).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: "+ Day 1" }));

    await waitFor(() =>
      expect(mockAddItineraryStop).toHaveBeenCalledWith("tok", "trip-1", {
        placeId: "place-1",
        day: 1,
      }),
    );
  });

  it("adds a place to a day picked via chip", async () => {
    renderWithMessages(<AddTripStop itineraryId="trip-1" durationDays={3} onAdded={jest.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Day 3" }));
    fireEvent.change(screen.getByPlaceholderText("Search places…"), {
      target: { value: "beach" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Search" }));

    await waitFor(() => expect(screen.getByText("Sunset Beach")).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: "+ Day 3" }));

    await waitFor(() =>
      expect(mockAddItineraryStop).toHaveBeenCalledWith("tok", "trip-1", {
        placeId: "place-1",
        day: 3,
      }),
    );
  });

  it("switches to the Events tab and searches events instead of places", async () => {
    mockGetEvents.mockResolvedValue({
      data: [{ id: "event-1", name: "Beach Cleanup" }],
    });
    renderWithMessages(<AddTripStop itineraryId="trip-1" durationDays={3} onAdded={jest.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Events" }));
    fireEvent.change(screen.getByPlaceholderText("Search events…"), {
      target: { value: "cleanup" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Search" }));

    await waitFor(() => expect(screen.getByText("Beach Cleanup")).toBeInTheDocument());
    expect(mockGetEvents).toHaveBeenCalledWith({ search: "cleanup", limit: 5 });
    fireEvent.click(screen.getByRole("button", { name: "+ Day 1" }));

    await waitFor(() =>
      expect(mockAddItineraryStop).toHaveBeenCalledWith("tok", "trip-1", {
        eventId: "event-1",
        day: 1,
      }),
    );
  });

  it("switches to the Car Rentals tab and searches car listings instead of places", async () => {
    mockGetCarListings.mockResolvedValue({
      data: [{ id: "listing-1", title: "Toyota RAV4", category: "suv", pricePerDay: 60 }],
    });
    renderWithMessages(<AddTripStop itineraryId="trip-1" durationDays={3} onAdded={jest.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Car Rentals" }));
    fireEvent.change(screen.getByPlaceholderText("Search car rentals…"), {
      target: { value: "rav4" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Search" }));

    await waitFor(() => expect(screen.getByText("Toyota RAV4")).toBeInTheDocument());
    expect(mockGetCarListings).toHaveBeenCalledWith({ search: "rav4", limit: 5 });
    fireEvent.click(screen.getByRole("button", { name: "+ Day 1" }));

    await waitFor(() =>
      expect(mockAddItineraryStop).toHaveBeenCalledWith("tok", "trip-1", {
        carListingId: "listing-1",
        day: 1,
      }),
    );
  });

  it("links each result to its own detail page, opened in a new tab, without adding it", async () => {
    renderWithMessages(<AddTripStop itineraryId="trip-1" durationDays={3} onAdded={jest.fn()} />);
    fireEvent.change(screen.getByPlaceholderText("Search places…"), {
      target: { value: "beach" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Search" }));

    await waitFor(() => expect(screen.getByText("Sunset Beach")).toBeInTheDocument());
    const link = screen.getByRole("link", { name: /Sunset Beach/i });
    expect(link).toHaveAttribute("href", "/places/sunset-beach");
    expect(link).toHaveAttribute("target", "_blank");
    expect(mockAddItineraryStop).not.toHaveBeenCalled();
  });

  it("switches to the Stay tab and searches hotels via getPlaces with type: hotel", async () => {
    mockGetPlaces.mockResolvedValue({ data: [{ id: "hotel-1", name: "Sunset Inn" }] });
    renderWithMessages(<AddTripStop itineraryId="trip-1" durationDays={3} onAdded={jest.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Stay" }));
    fireEvent.change(screen.getByPlaceholderText("Search hotels…"), {
      target: { value: "sunset" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Search" }));

    await waitFor(() => expect(screen.getByText("Sunset Inn")).toBeInTheDocument());
    expect(mockGetPlaces).toHaveBeenCalledWith({ q: "sunset", type: "hotel", limit: 5 });
    fireEvent.click(screen.getByRole("button", { name: "+ Day 1" }));

    await waitFor(() =>
      expect(mockAddItineraryStop).toHaveBeenCalledWith("tok", "trip-1", {
        placeId: "hotel-1",
        day: 1,
      }),
    );
  });
});
