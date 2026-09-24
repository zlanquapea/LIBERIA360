import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { BookingRequestSection } from "./BookingRequestSection";
import { createBooking } from "@/lib/booking-api";
import { getCarListingAvailability } from "@/lib/car-rentals-api";
import type { CarListing } from "@/lib/types";

const mockUseAuth = jest.fn();

jest.mock("../hooks/useAuth", () => ({
  useAuth: () => mockUseAuth(),
}));
jest.mock("../lib/booking-api", () => ({
  createBooking: jest.fn(),
}));
jest.mock("../lib/car-rentals-api", () => ({
  getCarListingAvailability: jest.fn(),
}));
jest.mock("../lib/analytics-api", () => ({
  recordAnalyticsEvent: jest.fn(),
  recordCreatorAnalyticsEvent: jest.fn(),
}));

const mockCreateBooking = createBooking as jest.Mock;
const mockGetCarListingAvailability = getCarListingAvailability as jest.Mock;

function makeCarListing(overrides: Partial<CarListing> = {}): CarListing {
  return {
    id: "car-1",
    owner: { id: "owner-1" } as CarListing["owner"],
    ownerUserId: "owner-1",
    business: null,
    businessId: null,
    county: null,
    countyId: "co1",
    title: "Toyota RAV4",
    make: "Toyota",
    model: "RAV4",
    year: 2022,
    category: "suv",
    transmission: "automatic",
    fuelType: "petrol",
    seats: 5,
    pricePerDay: 50,
    withDriverAvailable: false,
    driverFeePerDay: null,
    minRentalDays: 1,
    pricePerHour: null,
    minRentalHours: null,
    driverFeePerHour: null,
    securityDeposit: null,
    color: null,
    mileageLimitPerDay: null,
    excessMileageFee: null,
    fuelPolicy: null,
    minDriverAge: null,
    additionalDriverAllowed: false,
    additionalDriverFee: null,
    insuranceIncluded: false,
    insuranceNotes: null,
    cancellationPolicy: null,
    deliveryAvailable: false,
    deliveryFee: null,
    instantBookEnabled: false,
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
    ...overrides,
  } as CarListing;
}

describe("BookingRequestSection (car listing)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseAuth.mockReturnValue({
      user: { id: "guest-1" },
      token: "tok",
      ready: true,
    });
    mockGetCarListingAvailability.mockResolvedValue({ unavailable: [] });
  });

  it("only shows the additional-driver checkbox when the listing allows it", async () => {
    const listing = makeCarListing({ additionalDriverAllowed: false });
    render(
      <BookingRequestSection carListing={listing} startExpanded />,
    );
    await waitFor(() => expect(mockGetCarListingAvailability).toHaveBeenCalled());
    expect(
      screen.queryByRole("checkbox", { name: /additional driver/i }),
    ).not.toBeInTheDocument();
  });

  it("sends wantsAdditionalDriver and adds the flat fee to the estimate when checked", async () => {
    const listing = makeCarListing({
      additionalDriverAllowed: true,
      additionalDriverFee: 15,
      pricePerDay: 50,
    });
    render(
      <BookingRequestSection carListing={listing} startExpanded />,
    );
    await waitFor(() => expect(mockGetCarListingAvailability).toHaveBeenCalled());

    fireEvent.change(screen.getByLabelText(/pickup date/i), {
      target: { value: "2026-01-01" },
    });
    fireEvent.change(screen.getByLabelText(/return date/i), {
      target: { value: "2026-01-03" },
    });

    const checkbox = screen.getByRole("checkbox", {
      name: /additional driver/i,
    });
    fireEvent.click(checkbox);

    // 2 days × $50 + $15 one-time additional-driver fee = $115.
    expect(await screen.findByText(/115\.00/)).toBeInTheDocument();

    mockCreateBooking.mockResolvedValue({ status: "pending" });
    fireEvent.click(screen.getByRole("button", { name: /send request/i }));

    await waitFor(() =>
      expect(mockCreateBooking).toHaveBeenCalledWith(
        "tok",
        expect.objectContaining({ wantsAdditionalDriver: true }),
      ),
    );
  });

  it("shows a non-blocking warning when the chosen dates overlap a reported unavailable range", async () => {
    mockGetCarListingAvailability.mockResolvedValue({
      unavailable: [
        { startDate: "2026-01-02", endDate: "2026-01-04", source: "booking" },
      ],
    });
    const listing = makeCarListing();
    render(
      <BookingRequestSection carListing={listing} startExpanded />,
    );
    await waitFor(() => expect(mockGetCarListingAvailability).toHaveBeenCalled());

    fireEvent.change(screen.getByLabelText(/pickup date/i), {
      target: { value: "2026-01-01" },
    });
    fireEvent.change(screen.getByLabelText(/return date/i), {
      target: { value: "2026-01-03" },
    });

    expect(
      await screen.findByText(/overlap with an existing request/i),
    ).toBeInTheDocument();
    // Non-blocking: the submit button must still be present/enabled.
    expect(
      screen.getByRole("button", { name: /send request/i }),
    ).toBeEnabled();
  });
});
