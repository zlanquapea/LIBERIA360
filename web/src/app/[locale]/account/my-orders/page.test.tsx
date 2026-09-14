import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { renderWithMessages } from "@/test/render-with-messages";
import MyOrdersPage from "./page";
import type { FoodOrder } from "@/lib/types";
import type { PharmacyOrder } from "@/lib/pharmacy-api";

const mockUseAuth = jest.fn();
const mockGetMyFoodOrders = jest.fn();
const mockCancelFoodOrder = jest.fn();
const mockGetMyPharmacyOrders = jest.fn();
const mockSubmitPharmacyOrderFeedback = jest.fn();

// jest.mock's module specifier is a plain string, not an import
// declaration — the '@/...' alias only gets resolved by SWC's transform on
// real import statements (see PharmacyShop.test.tsx's own note on this),
// so these need relative paths to resolve to the same modules page.tsx
// imports via their '@/...' aliases.
jest.mock("../../../../hooks/useAuth", () => ({
  useAuth: () => mockUseAuth(),
}));
jest.mock("../../../../lib/food-orders-api", () => ({
  getMyFoodOrders: (...args: unknown[]) => mockGetMyFoodOrders(...args),
  cancelFoodOrder: (...args: unknown[]) => mockCancelFoodOrder(...args),
}));
jest.mock("../../../../lib/pharmacy-api", () => {
  const actual = jest.requireActual("../../../../lib/pharmacy-api");
  return {
    ...actual,
    getMyPharmacyOrders: (...args: unknown[]) => mockGetMyPharmacyOrders(...args),
    submitPharmacyOrderFeedback: (...args: unknown[]) =>
      mockSubmitPharmacyOrderFeedback(...args),
  };
});
// Renders its own network calls (message list) — irrelevant to this page's
// own behavior, and would otherwise fail without further mocking.
jest.mock("../../../../components/FoodOrderMessageThread", () => ({
  __esModule: true,
  default: () => <div data-testid="food-order-thread" />,
}));

const foodOrder: FoodOrder = {
  id: "food-1",
  business: { id: "biz-1", name: "Tasty Spot" } as FoodOrder["business"],
  businessId: "biz-1",
  buyer: null,
  buyerUserId: "user-1",
  items: [{ menuItemId: "item-1", name: "Jollof Rice", unitPrice: "10.00", quantity: 2 }],
  totalAmount: 20,
  notes: null,
  status: "confirmed",
  businessResponse: null,
  respondedAt: null,
  createdAt: "2026-01-01T10:00:00Z",
  updatedAt: "2026-01-01T10:00:00Z",
};

function pharmacyOrder(overrides: Partial<PharmacyOrder> = {}): PharmacyOrder {
  return {
    id: "pharmacy-1",
    pharmacyId: "pharm-1",
    status: "pending",
    fulfillmentMethod: "pickup",
    productSubtotal: 10,
    deliveryFee: 0,
    platformFee: 0,
    finalTotal: 10,
    createdAt: "2026-02-01T10:00:00Z",
    items: [],
    ...overrides,
  };
}

describe("My Orders — unified food + pharmacy order history", () => {
  beforeEach(() => {
    mockUseAuth.mockReturnValue({ user: { id: "user-1" }, token: "tok", ready: true });
    mockGetMyFoodOrders.mockReset().mockResolvedValue([foodOrder]);
    mockCancelFoodOrder.mockReset();
    mockGetMyPharmacyOrders.mockReset().mockResolvedValue([]);
    mockSubmitPharmacyOrderFeedback.mockReset();
  });

  it("shows both a food order and a pharmacy order on one page, newest first", async () => {
    mockGetMyPharmacyOrders.mockResolvedValue([
      pharmacyOrder({ id: "pharmacy-1", createdAt: "2026-03-01T10:00:00Z" }),
    ]);

    renderWithMessages(<MyOrdersPage />);

    const foodHeading = await screen.findByText("Tasty Spot");
    const pharmacyHeading = screen.getByText(/order #pharmac/i);
    // The pharmacy order (March) is newer than the food order (January),
    // so it must render first in DOM order.
    expect(
      pharmacyHeading.compareDocumentPosition(foodHeading) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it("shows a receipt link and a feedback prompt only for a completed pharmacy order", async () => {
    mockGetMyPharmacyOrders.mockResolvedValue([
      pharmacyOrder({ id: "pending1-order", status: "pending" }),
      pharmacyOrder({ id: "complete-order", status: "completed" }),
    ]);

    renderWithMessages(<MyOrdersPage />);
    await screen.findByText(/order #complete/i);

    expect(screen.getAllByRole("link", { name: /download receipt/i })).toHaveLength(1);
    expect(screen.getByText(/how was this order/i)).toBeInTheDocument();
  });

  it("submits feedback and swaps the prompt for a thank-you summary", async () => {
    mockGetMyPharmacyOrders.mockResolvedValue([
      pharmacyOrder({ id: "pharmacy-1", status: "completed" }),
    ]);
    mockSubmitPharmacyOrderFeedback.mockResolvedValue({
      rating: 5,
      comment: "Great service",
    });

    renderWithMessages(<MyOrdersPage />);
    await screen.findByText(/how was this order/i);

    fireEvent.click(screen.getByRole("radio", { name: /5 stars/i }));
    fireEvent.click(screen.getByRole("button", { name: /submit feedback/i }));

    await waitFor(() =>
      expect(mockSubmitPharmacyOrderFeedback).toHaveBeenCalledWith("pharmacy-1", {
        rating: 5,
        comment: undefined,
      }),
    );
    expect(await screen.findByText(/thanks for your feedback/i)).toBeInTheDocument();
    expect(screen.queryByText(/how was this order/i)).not.toBeInTheDocument();
  });

  it("never re-prompts for feedback once an order already has some, but still offers the receipt", async () => {
    mockGetMyPharmacyOrders.mockResolvedValue([
      pharmacyOrder({
        id: "pharmacy-1",
        status: "completed",
        feedback: { rating: 4, comment: "Good" },
      }),
    ]);

    renderWithMessages(<MyOrdersPage />);

    expect(await screen.findByText(/thanks for your feedback/i)).toBeInTheDocument();
    expect(screen.queryByText(/how was this order/i)).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: /download receipt/i })).toBeInTheDocument();
  });

  it("still lets a food order be cancelled, unaffected by pharmacy orders sharing the page", async () => {
    mockCancelFoodOrder.mockResolvedValue({ ...foodOrder, status: "cancelled" });

    renderWithMessages(<MyOrdersPage />);
    await screen.findByText("Tasty Spot");

    fireEvent.click(screen.getByRole("button", { name: "Cancel order" }));
    // ConfirmDialog's own confirm button shares the label with the
    // link-style trigger above — it's the one inside the dialog.
    const dialog = await screen.findByRole("alertdialog");
    fireEvent.click(
      within(dialog).getByRole("button", { name: "Cancel order" }),
    );

    await waitFor(() => expect(mockCancelFoodOrder).toHaveBeenCalledWith("tok", "food-1"));
  });
});
