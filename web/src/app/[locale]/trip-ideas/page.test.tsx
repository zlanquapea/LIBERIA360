import { fireEvent, screen, waitFor } from "@testing-library/react";
import { renderWithMessages } from "../../../test/render-with-messages";
import TripIdeasPage from "./page";
import type { PublicTripSummary } from "@/lib/types";

const mockUseAuth = jest.fn();
const mockGetFeaturedItineraries = jest.fn();
const mockCloneFeaturedItinerary = jest.fn();
const mockPush = jest.fn();

jest.mock("../../../hooks/useAuth", () => ({
  useAuth: () => mockUseAuth(),
}));
jest.mock("../../../lib/itinerary-api", () => ({
  getFeaturedItineraries: (...args: unknown[]) => mockGetFeaturedItineraries(...args),
  cloneFeaturedItinerary: (...args: unknown[]) => mockCloneFeaturedItinerary(...args),
}));
jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
}));

function makeTrip(overrides: Partial<PublicTripSummary> = {}): PublicTripSummary {
  return {
    id: "template-1",
    title: "Beach Weekend in Robertsport",
    destination: null,
    description: "A relaxing surf getaway.",
    coverImage: null,
    startDate: null,
    endDate: null,
    status: "upcoming" as never,
    admin: null,
    participantCount: 0,
    maxParticipants: null,
    featuredCategory: "Beach getaway",
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

describe("TripIdeasPage", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("shows the empty state when there are no featured itineraries", async () => {
    mockUseAuth.mockReturnValue({ token: null });
    mockGetFeaturedItineraries.mockResolvedValue([]);
    renderWithMessages(<TripIdeasPage />);
    expect(await screen.findByText(/no trip ideas yet/i)).toBeInTheDocument();
  });

  it("groups featured itineraries by their featuredCategory", async () => {
    mockUseAuth.mockReturnValue({ token: null });
    mockGetFeaturedItineraries.mockResolvedValue([
      makeTrip({ id: "t1", title: "Beach Weekend", featuredCategory: "Beach getaway" }),
      makeTrip({ id: "t2", title: "Heritage Tour", featuredCategory: "Culture & heritage" }),
    ]);
    renderWithMessages(<TripIdeasPage />);
    expect(await screen.findByText("Beach getaway")).toBeInTheDocument();
    expect(screen.getByText("Culture & heritage")).toBeInTheDocument();
    expect(screen.getByText("Beach Weekend")).toBeInTheDocument();
    expect(screen.getByText("Heritage Tour")).toBeInTheDocument();
  });

  it("sends a signed-out visitor to /login instead of cloning", async () => {
    mockUseAuth.mockReturnValue({ token: null });
    mockGetFeaturedItineraries.mockResolvedValue([makeTrip()]);
    renderWithMessages(<TripIdeasPage />);

    fireEvent.click(await screen.findByRole("button", { name: /use this itinerary/i }));

    expect(mockPush).toHaveBeenCalledWith("/login");
    expect(mockCloneFeaturedItinerary).not.toHaveBeenCalled();
  });

  it("clones the template and redirects to the new trip when signed in", async () => {
    mockUseAuth.mockReturnValue({ token: "tok" });
    mockGetFeaturedItineraries.mockResolvedValue([makeTrip()]);
    mockCloneFeaturedItinerary.mockResolvedValue({ id: "new-trip-1" });
    renderWithMessages(<TripIdeasPage />);

    fireEvent.click(await screen.findByRole("button", { name: /use this itinerary/i }));

    await waitFor(() => expect(mockCloneFeaturedItinerary).toHaveBeenCalledWith("tok", "template-1"));
    await waitFor(() => expect(mockPush).toHaveBeenCalledWith("/trips/new-trip-1"));
  });

  it("shows an error and stays on the page if cloning fails", async () => {
    mockUseAuth.mockReturnValue({ token: "tok" });
    mockGetFeaturedItineraries.mockResolvedValue([makeTrip()]);
    mockCloneFeaturedItinerary.mockRejectedValue(new Error("boom"));
    renderWithMessages(<TripIdeasPage />);

    fireEvent.click(await screen.findByRole("button", { name: /use this itinerary/i }));

    expect(await screen.findByRole("alert")).toBeInTheDocument();
    expect(mockPush).not.toHaveBeenCalledWith(expect.stringContaining("/trips/"));
  });
});
