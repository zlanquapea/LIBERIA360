import {
  calculatePharmacyTotals,
  PHARMACY_ORDER_TRANSITIONS,
} from "./pharmacies.service";
import {
  FulfillmentMethod,
  PharmacyOrderStatus,
} from "./entities/pharmacy.enums";

describe("pharmacy marketplace policies", () => {
  it("calculates pickup and delivery totals server-side", () => {
    expect(
      calculatePharmacyTotals(
        [
          { unitPrice: 100, quantity: 2 },
          { unitPrice: "50", quantity: 1 },
        ],
        FulfillmentMethod.DELIVERY,
        75,
        25,
      ),
    ).toEqual({ subtotal: 250, delivery: 75, platformFee: 25, total: 350 });
    expect(
      calculatePharmacyTotals(
        [{ unitPrice: 100, quantity: 1 }],
        FulfillmentMethod.PICKUP,
        75,
      ).total,
    ).toBe(100);
  });
  it("allows only safe order status transitions", () => {
    expect(PHARMACY_ORDER_TRANSITIONS.pending).toContain(
      PharmacyOrderStatus.ACCEPTED,
    );
    expect(PHARMACY_ORDER_TRANSITIONS.under_review).not.toContain(
      PharmacyOrderStatus.COMPLETED,
    );
    expect(PHARMACY_ORDER_TRANSITIONS.completed).toEqual([]);
  });
  it("keeps prescription orders under human review", () => {
    expect(PHARMACY_ORDER_TRANSITIONS.under_review).toEqual(
      expect.arrayContaining([
        PharmacyOrderStatus.ACCEPTED,
        PharmacyOrderStatus.REJECTED,
      ]),
    );
    expect(PHARMACY_ORDER_TRANSITIONS.under_review).not.toContain(
      PharmacyOrderStatus.PREPARING,
    );
  });
});
