import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { AddToTripButton } from "./AddToTripButton";
import type { Itinerary } from "@/lib/types";

const mockUseAuth = jest.fn();
const mockGetMyItineraries = jest.fn();
const mockGetSharedWithMe = jest.fn();
const mockAddItineraryStop = jest.fn();
const mockSetEventRsvp = jest.fn();

jest.mock("../hooks/useAuth", () => ({
  useAuth: () => mockUseAuth(),
}));
jest.mock("../lib/itinerary-api", () => ({
  addItineraryStop: (...args: unknown[]) => mockAddItineraryStop(...args),
  getMyItineraries: (...args: unknown[]) => mockGetMyItineraries(...args),
  getSharedWithMe: (...args: unknown[]) => mockGetSharedWithMe(...args),
}));
jest.mock("../lib/event-api", () => ({
  setEventRsvp: (...args: unknown[]) => mockSetEventRsvp(...args),
}));

function makeTrip(overrides: Partial<Itinerary> = {}): Itinerary {
  return {
    id: "trip-1",
    userId: "owner-1",
    title: "Weekend in Robertsport",
    kind: "trip" as never,
    durationDays: 3,
    budgetBand: "moderate" as never,
    interests: [],
    stops: [],
    destination: null,
    destinationPlaceId: null,
    visibility: "private" as never,
    description: null,
    coverImage: null,
    startDate: null,
    endDate: null,
    partySize: null,
    maxParticipants: null,
    cancelledAt: null,
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

describe("AddToTripButton", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetMyItineraries.mockResolvedValue([makeTrip()]);
    mockGetSharedWithMe.mockResolvedValue([]);
    mockAddItineraryStop.mockResolvedValue({});
    mockSetEventRsvp.mockResolvedValue({});
  });

  it("shows a login link instead of a trip picker when signed out", () => {
    mockUseAuth.mockReturnValue({ token: null });
    render(<AddToTripButton contentType="event" itemId="event-1" itemName="Beach Cleanup" />);
    expect(screen.getByRole("link", { name: /add to trip/i })).toHaveAttribute("href", "/login");
  });

  it("lists the signed-in user's own and shared trips on open", async () => {
    mockUseAuth.mockReturnValue({ token: "tok" });
    render(<AddToTripButton contentType="event" itemId="event-1" itemName="Beach Cleanup" />);
    fireEvent.click(screen.getByRole("button", { name: /add to trip/i }));
    await waitFor(() =>
      expect(screen.getByText("Weekend in Robertsport")).toBeInTheDocument(),
    );
  });

  it("excludes cancelled trips from the picker", async () => {
    mockUseAuth.mockReturnValue({ token: "tok" });
    mockGetMyItineraries.mockResolvedValue([
      makeTrip({ id: "cancelled-1", title: "Cancelled Trip", cancelledAt: new Date().toISOString() }),
    ]);
    render(<AddToTripButton contentType="event" itemId="event-1" itemName="Beach Cleanup" />);
    fireEvent.click(screen.getByRole("button", { name: /add to trip/i }));
    await waitFor(() => expect(mockGetMyItineraries).toHaveBeenCalled());
    expect(screen.queryByText("Cancelled Trip")).not.toBeInTheDocument();
  });

  it("adds an event to the picked trip/day and auto-RSVPs interested", async () => {
    mockUseAuth.mockReturnValue({ token: "tok" });
    render(<AddToTripButton contentType="event" itemId="event-1" itemName="Beach Cleanup" />);
    fireEvent.click(screen.getByRole("button", { name: /add to trip/i }));
    await waitFor(() => expect(screen.getByText("Weekend in Robertsport")).toBeInTheDocument());
    fireEvent.click(screen.getByText("Weekend in Robertsport"));

    fireEvent.click(screen.getByRole("button", { name: /add beach cleanup to day 1/i }));

    await waitFor(() =>
      expect(mockAddItineraryStop).toHaveBeenCalledWith("tok", "trip-1", {
        eventId: "event-1",
        day: 1,
      }),
    );
    expect(mockSetEventRsvp).toHaveBeenCalledWith("tok", "event-1", "interested");
    await waitFor(() =>
      expect(screen.getByText(/added to day 1 of/i)).toBeInTheDocument(),
    );
  });

  it("adds a car listing to the picked trip without an RSVP call", async () => {
    mockUseAuth.mockReturnValue({ token: "tok" });
    render(<AddToTripButton contentType="carListing" itemId="car-1" itemName="Toyota RAV4" />);
    fireEvent.click(screen.getByRole("button", { name: /add to trip/i }));
    await waitFor(() => expect(screen.getByText("Weekend in Robertsport")).toBeInTheDocument());
    fireEvent.click(screen.getByText("Weekend in Robertsport"));

    fireEvent.click(screen.getByRole("button", { name: /add toyota rav4 to day 1/i }));

    await waitFor(() =>
      expect(mockAddItineraryStop).toHaveBeenCalledWith("tok", "trip-1", {
        carListingId: "car-1",
        day: 1,
      }),
    );
    expect(mockSetEventRsvp).not.toHaveBeenCalled();
  });

  it("adds a place (e.g. a hotel from its own page) to the picked trip without an RSVP call", async () => {
    mockUseAuth.mockReturnValue({ token: "tok" });
    render(<AddToTripButton contentType="place" itemId="hotel-1" itemName="Sunset Inn" />);
    fireEvent.click(screen.getByRole("button", { name: /add to trip/i }));
    await waitFor(() => expect(screen.getByText("Weekend in Robertsport")).toBeInTheDocument());
    fireEvent.click(screen.getByText("Weekend in Robertsport"));

    fireEvent.click(screen.getByRole("button", { name: /add sunset inn to day 1/i }));

    await waitFor(() =>
      expect(mockAddItineraryStop).toHaveBeenCalledWith("tok", "trip-1", {
        placeId: "hotel-1",
        day: 1,
      }),
    );
    expect(mockSetEventRsvp).not.toHaveBeenCalled();
  });
});
