import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { FoodOrdersManager } from "./FoodOrdersManager";
import type { FoodOrder } from "@/lib/types";

const api = {
  getBusinessFoodOrders: jest.fn(),
  respondToFoodOrder: jest.fn(),
  updateFoodOrderStatus: jest.fn(),
  markFoodOrderRefunded: jest.fn(),
};
jest.mock("../lib/food-orders-api", () => ({
  getBusinessFoodOrders: (...a: unknown[]) => api.getBusinessFoodOrders(...a),
  respondToFoodOrder: (...a: unknown[]) => api.respondToFoodOrder(...a),
  updateFoodOrderStatus: (...a: unknown[]) => api.updateFoodOrderStatus(...a),
  markFoodOrderRefunded: (...a: unknown[]) => api.markFoodOrderRefunded(...a),
}));
jest.mock("./FoodOrderMessageThread", () => ({ __esModule: true, default: () => null }));

function order(overrides: Partial<FoodOrder> = {}): FoodOrder {
  return {
    id: "o1",
    business: null,
    businessId: "biz-1",
    buyer: { id: "u1", name: "Alice" } as FoodOrder["buyer"],
    buyerUserId: "u1",
    items: [{ menuItemId: "m1", name: "Pepper Soup", unitPrice: "8.00", quantity: 1 }],
    subtotal: 8,
    deliveryFee: 2,
    totalAmount: 10,
    currency: "USD",
    notes: null,
    status: "pending",
    fulfillment: "delivery",
    deliveryAddress: "12 Tubman Blvd, Sinkor",
    contactPhone: "0886 555 000",
    paymentMethod: "orange_money",
    paymentStatus: "awaiting_verification",
    paymentReference: "OM-48213",
    paymentAccount: "0777 123 456",
    businessResponse: null,
    respondedAt: null,
    createdAt: "2026-10-03T10:00:00Z",
    updatedAt: "2026-10-03T10:00:00Z",
    ...overrides,
  };
}

beforeEach(() => Object.values(api).forEach((fn) => fn.mockReset()));

describe("FoodOrdersManager", () => {
  it("asks the owner to verify a mobile money payment before confirming it", async () => {
    api.getBusinessFoodOrders.mockResolvedValue([order()]);
    api.respondToFoodOrder.mockResolvedValue(order({ status: "confirmed", paymentStatus: "paid" }));
    render(<FoodOrdersManager token="tok" businessId="biz-1" />);

    const callout = await screen.findByText(/Check your payment first/);
    expect(callout.parentElement).toHaveTextContent("Orange Money (0777 123 456) for US$10.00 with transaction ID OM-48213");

    fireEvent.click(screen.getByRole("button", { name: "Respond" }));
    fireEvent.click(screen.getByRole("button", { name: "Payment received — confirm" }));
    await waitFor(() =>
      expect(api.respondToFoodOrder).toHaveBeenCalledWith("tok", "o1", "confirm", undefined, undefined),
    );
    // Confirmed orders offer the next delivery steps.
    expect(await screen.findByRole("button", { name: "Start preparing" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Send out for delivery" })).toBeInTheDocument();
  });

  it("declines with 'payment not found' when the owner ticks it", async () => {
    api.getBusinessFoodOrders.mockResolvedValue([order()]);
    api.respondToFoodOrder.mockResolvedValue(order({ status: "declined", paymentStatus: "failed" }));
    render(<FoodOrdersManager token="tok" businessId="biz-1" />);
    fireEvent.click(await screen.findByRole("button", { name: "Respond" }));
    fireEvent.click(screen.getByRole("checkbox", { name: /couldn.t find this payment/ }));
    fireEvent.click(screen.getByRole("button", { name: "Decline" }));
    await waitFor(() =>
      expect(api.respondToFoodOrder).toHaveBeenCalledWith("tok", "o1", "decline", undefined, true),
    );
  });

  it("moves an order along and records refunds", async () => {
    api.getBusinessFoodOrders.mockResolvedValue([
      order({ id: "o1", status: "preparing", paymentStatus: "paid" }),
      order({ id: "o2", status: "declined", paymentStatus: "refund_due" }),
    ]);
    api.updateFoodOrderStatus.mockResolvedValue(order({ status: "out_for_delivery", paymentStatus: "paid" }));
    api.markFoodOrderRefunded.mockResolvedValue(order({ id: "o2", status: "declined", paymentStatus: "refunded" }));
    render(<FoodOrdersManager token="tok" businessId="biz-1" />);

    fireEvent.click(await screen.findByRole("button", { name: "Send out for delivery" }));
    await waitFor(() => expect(api.updateFoodOrderStatus).toHaveBeenCalledWith("tok", "o1", "out_for_delivery"));

    expect(screen.getByText(/1 declined or cancelled mobile money order needs a refund/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("tab", { name: /Past/ }));
    const refund = screen.getByText(/Send US\$10.00 back by Orange Money to 0886 555 000/).parentElement!;
    fireEvent.click(within(refund).getByRole("button", { name: "Mark refunded" }));
    await waitFor(() => expect(api.markFoodOrderRefunded).toHaveBeenCalledWith("tok", "o2"));
  });
});
