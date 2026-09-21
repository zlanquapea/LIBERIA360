import { render, screen } from "@testing-library/react";
import { CarListingCard } from "./CarListingCard";
import type { CarListing } from "@/lib/types";

const mockUseAuth = jest.fn();

jest.mock("../hooks/useAuth", () => ({
  useAuth: () => mockUseAuth(),
}));
jest.mock("../lib/itinerary-api", () => ({
  getMyItineraries: jest.fn().mockResolvedValue([]),
  getSharedWithMe: jest.fn().mockResolvedValue([]),
  addItineraryStop: jest.fn(),
}));
jest.mock("../lib/event-api", () => ({
  setEventRsvp: jest.fn(),
}));

const LISTING: CarListing = {
  id: "car-1",
  owner: null,
  ownerUserId: "owner-1",
  business: null,
  businessId: null,
  county: { id: "co1", name: "Montserrado", slug: "montserrado", rolloutStage: 1, icon: null, emergencyNumber: null, safetyTips: [], localCustoms: null },
  countyId: "co1",
  title: "Toyota RAV4",
  make: "Toyota",
  model: "RAV4",
  year: 2022,
  category: "suv",
  transmission: "automatic",
  fuelType: "petrol",
  seats: 5,
  pricePerDay: 60,
  withDriverAvailable: false,
  driverFeePerDay: null,
  minRentalDays: 1,
  pricePerHour: null,
  minRentalHours: null,
  driverFeePerHour: null,
  securityDeposit: null,
  features: [],
  images: [],
  description: null,
  pickupLocation: null,
  contactPhone: null,
  contactWhatsapp: null,
  isActive: true,
  reviewStatus: "approved",
  rejectionReason: null,
  submittedAt: null,
  reviewedAt: null,
  reviewedByUserId: null,
  rating: 0,
  reviewCount: 0,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
} as CarListing;

describe("CarListingCard", () => {
  beforeEach(() => {
    mockUseAuth.mockReturnValue({ token: "tok" });
  });

  it("renders the listing as a link to its detail page", () => {
    render(<CarListingCard listing={LISTING} />);
    expect(screen.getByRole("link", { name: /Toyota RAV4/i })).toHaveAttribute(
      "href",
      "/car-rentals/car-1",
    );
  });

  it("offers a compact Add to trip control that is not nested inside the card's own link", () => {
    render(<CarListingCard listing={LISTING} />);
    const addButton = screen.getByRole("button", { name: /add to trip/i });
    const cardLink = screen.getByRole("link", { name: /Toyota RAV4/i });
    // A button nested inside an anchor is invalid HTML and fights the
    // anchor for clicks — this must be a sibling, not a descendant.
    expect(cardLink).not.toContainElement(addButton);
  });

  it("shows a login link instead of the picker when signed out, still outside the card's own link", () => {
    mockUseAuth.mockReturnValue({ token: null });
    render(<CarListingCard listing={LISTING} />);
    const loginLink = screen.getByRole("link", { name: /add to trip/i });
    expect(loginLink).toHaveAttribute("href", "/login");
  });
});
