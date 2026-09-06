import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { AddTripStop } from "./AddTripStop";
import type { Place } from "@/lib/types";

const mockUseAuth = jest.fn();
const mockGetPlaces = jest.fn();
const mockAddItineraryStop = jest.fn();

jest.mock("../hooks/useAuth", () => ({
  useAuth: () => mockUseAuth(),
}));
jest.mock("../lib/api", () => ({
  getPlaces: (...args: unknown[]) => mockGetPlaces(...args),
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
    mockUseAuth.mockReturnValue({ token: "tok" });
    mockGetPlaces.mockResolvedValue({ data: [PLACE] });
    mockAddItineraryStop.mockResolvedValue({});
  });

  // Regression: a day beyond the trip's own duration used to be typeable
  // (the day input's max was hardcoded to at least 30 regardless of how
  // short the trip actually was), and the backend would silently stretch
  // the trip's durationDays to match instead of rejecting it — leaving the
  // "X days" summary and the date-range badge disagreeing about how long
  // the trip was. The day picker is now bounded to the trip's real length.
  it("caps the day input at the trip's own duration, not a fixed 30", () => {
    render(<AddTripStop itineraryId="trip-1" durationDays={3} onAdded={jest.fn()} />);
    expect(screen.getByLabelText("Day")).toHaveAttribute("max", "3");
  });

  it("clamps a typed day back down to the trip's duration", () => {
    render(<AddTripStop itineraryId="trip-1" durationDays={3} onAdded={jest.fn()} />);
    const dayInput = screen.getByLabelText("Day");
    fireEvent.change(dayInput, { target: { value: "10" } });
    expect(dayInput).toHaveValue(3);
  });

  it("adds a found place to the currently selected day", async () => {
    render(<AddTripStop itineraryId="trip-1" durationDays={3} onAdded={jest.fn()} />);
    fireEvent.change(screen.getByPlaceholderText("Search places…"), {
      target: { value: "beach" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Search" }));

    await waitFor(() => expect(screen.getByText("Sunset Beach")).toBeInTheDocument());
    fireEvent.click(screen.getByText("Sunset Beach").closest("button")!);

    await waitFor(() =>
      expect(mockAddItineraryStop).toHaveBeenCalledWith("tok", "trip-1", {
        placeId: "place-1",
        day: 1,
      }),
    );
  });
});
