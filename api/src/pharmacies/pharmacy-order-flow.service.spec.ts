import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from "@nestjs/common";
import { PharmacyOrderFlowService } from "./pharmacy-order-flow.service";
import { paymentAccountFor, paymentAfterStatus } from "./pharmacies.service";
import {
  PharmacyOrderPaymentStatus as Pay,
  PharmacyOrderStatus as Status,
  PharmacyPaymentMethod as Method,
} from "./entities/pharmacy.enums";

const CUSTOMER = "customer-1";
const STAFF = "staff-1";
const PHARMACY = "pharmacy-1";

function makeOrder(over: Record<string, unknown> = {}) {
  return {
    id: "order-1",
    pharmacyId: PHARMACY,
    customerUserId: CUSTOMER,
    status: Status.PENDING,
    paymentMethod: Method.MTN_MOMO,
    paymentStatus: Pay.AWAITING_PAYMENT,
    paymentReference: null,
    paymentAccount: "0886 000 111",
    finalTotal: "408.00",
    pharmacy: { name: "CarePoint", slug: "carepoint" },
    ...over,
  };
}

function setup(order = makeOrder()) {
  let current = { ...order };
  const orders = {
    findOne: jest.fn(async ({ where }: { where: Record<string, unknown> }) =>
      Object.entries(where).every(
        ([k, v]) => (current as Record<string, unknown>)[k] === v,
      )
        ? current
        : null,
    ),
    findOneByOrFail: jest.fn(async () => current),
    update: jest.fn(
      async (
        criteria: Record<string, unknown>,
        patch: Record<string, unknown>,
      ) => {
        const matches = Object.entries(criteria).every(([k, v]) => {
          if (v && typeof v === "object" && "_value" in (v as object))
            return (v as { _value: unknown[] })._value.includes(
              (current as Record<string, unknown>)[k],
            );
          return (current as Record<string, unknown>)[k] === v;
        });
        if (matches) current = { ...current, ...patch };
        return { affected: matches ? 1 : 0 };
      },
    ),
    manager: undefined,
  };
  const staff = {
    findOne: jest.fn(async ({ where }: { where: { userId: string } }) =>
      where.userId === STAFF ? { userId: STAFF, active: true } : null,
    ),
    find: jest.fn(async () => [{ userId: STAFF }]),
  };
  const items = {
    find: jest.fn(async () => [
      {
        productId: "p1",
        name: "Cough syrup",
        quantity: 3,
        prescriptionRequired: false,
      },
    ]),
  };
  const inventory = {
    find: jest.fn(async () => [{ productId: "p1", quantity: 2 }]),
    increment: jest.fn(),
  };
  const products = {
    find: jest.fn(async () => [
      {
        id: "p1",
        name: "Cough syrup",
        price: "129.00",
        prescriptionRequired: false,
      },
    ]),
  };
  const savedMessages: Record<string, unknown>[] = [];
  const messages = {
    update: jest.fn(async () => ({ affected: 0 })),
    find: jest.fn(async () => savedMessages),
    create: jest.fn((m: Record<string, unknown>) => m),
    save: jest.fn(async (m: Record<string, unknown>) => {
      const row = {
        id: `m${savedMessages.length + 1}`,
        createdAt: new Date(),
        readAt: null,
        sender: { name: "Ama" },
        ...m,
      };
      savedMessages.push(row);
      return row;
    }),
    findOneOrFail: jest.fn(async ({ where }: { where: { id: string } }) =>
      savedMessages.find((m) => m.id === where.id),
    ),
  };
  const audits = {
    create: jest.fn((a) => a),
    save: jest.fn(async (a) => a),
    find: jest.fn(async () => []),
  };
  const prescriptions = { find: jest.fn(async () => []) };
  const notifier = {
    customer: jest.fn(async () => undefined),
    staffOf: jest.fn(async () => undefined),
  };
  const service = new PharmacyOrderFlowService(
    orders as never,
    items as never,
    messages as never,
    staff as never,
    products as never,
    inventory as never,
    prescriptions as never,
    audits as never,
    notifier as never,
  );
  return {
    service,
    orders,
    audits,
    notifier,
    inventory,
    messages,
    get: () => current,
  };
}

describe("payment rules", () => {
  it("uses the merchant number for the chosen mobile money method", () => {
    const pharmacy = {
      mtnMomoNumber: " 0886 000 111 ",
      orangeMoneyNumber: null,
    };
    expect(paymentAccountFor(pharmacy, Method.MTN_MOMO)).toBe("0886 000 111");
    expect(paymentAccountFor(pharmacy, Method.ORANGE_MONEY)).toBeNull();
    expect(paymentAccountFor(pharmacy, Method.CASH)).toBeNull();
  });

  it("marks cash paid on completion and owes back mobile money on cancellation", () => {
    expect(
      paymentAfterStatus(
        { paymentStatus: Pay.PAY_ON_COLLECTION },
        Status.COMPLETED,
      ),
    ).toEqual({ paymentStatus: Pay.PAID });
    expect(
      paymentAfterStatus({ paymentStatus: Pay.PAID }, Status.CANCELLED),
    ).toEqual({ paymentStatus: Pay.REFUND_DUE });
    expect(
      paymentAfterStatus(
        { paymentStatus: Pay.AWAITING_VERIFICATION },
        Status.CANCELLED,
      ),
    ).toEqual({ paymentStatus: Pay.REFUND_DUE });
    expect(
      paymentAfterStatus(
        { paymentStatus: Pay.AWAITING_PAYMENT },
        Status.CANCELLED,
      ),
    ).toEqual({});
    expect(
      paymentAfterStatus({ paymentStatus: Pay.PAID }, Status.PREPARING),
    ).toEqual({});
  });
});

describe("PharmacyOrderFlowService", () => {
  describe("submitPayment", () => {
    it("records the transaction ID and tells the pharmacy to check it", async () => {
      const t = setup(makeOrder({ status: Status.ACCEPTED }));
      const saved = await t.service.submitPayment(
        CUSTOMER,
        "order-1",
        " MP123456 ",
      );
      expect(saved.paymentStatus).toBe(Pay.AWAITING_VERIFICATION);
      expect(saved.paymentReference).toBe("MP123456");
      expect(t.audits.save).toHaveBeenCalledWith(
        expect.objectContaining({ action: "payment.submitted" }),
      );
      expect(t.notifier.staffOf).toHaveBeenCalledWith(
        PHARMACY,
        "pharmacy_order.payment",
        expect.any(String),
        expect.stringContaining("MP123456"),
      );
    });

    it("waits for the pharmacist before a prescription order can be paid", async () => {
      const t = setup(makeOrder({ status: Status.UNDER_REVIEW }));
      await expect(
        t.service.submitPayment(CUSTOMER, "order-1", "MP1"),
      ).rejects.toThrow(ConflictException);
    });

    it("refuses cash orders, closed orders and other people's orders", async () => {
      await expect(
        setup(makeOrder({ paymentMethod: Method.CASH })).service.submitPayment(
          CUSTOMER,
          "order-1",
          "MP1",
        ),
      ).rejects.toThrow(BadRequestException);
      await expect(
        setup(makeOrder({ status: Status.CANCELLED })).service.submitPayment(
          CUSTOMER,
          "order-1",
          "MP1",
        ),
      ).rejects.toThrow(ConflictException);
      await expect(
        setup().service.submitPayment("someone-else", "order-1", "MP1"),
      ).rejects.toThrow(NotFoundException);
    });

    it("lets the customer try again after a payment wasn't found", async () => {
      const t = setup(
        makeOrder({ status: Status.ACCEPTED, paymentStatus: Pay.FAILED }),
      );
      const saved = await t.service.submitPayment(CUSTOMER, "order-1", "MP999");
      expect(saved.paymentStatus).toBe(Pay.AWAITING_VERIFICATION);
    });
  });

  describe("verifyPayment", () => {
    it("lets staff confirm or reject a submitted payment", async () => {
      const t = setup(
        makeOrder({
          paymentStatus: Pay.AWAITING_VERIFICATION,
          paymentReference: "MP1",
        }),
      );
      expect(
        (await t.service.verifyPayment(STAFF, PHARMACY, "order-1", true))
          .paymentStatus,
      ).toBe(Pay.PAID);
      expect(t.notifier.customer).toHaveBeenCalledWith(
        expect.anything(),
        "pharmacy_order.payment",
        expect.stringContaining("Payment received"),
        expect.any(String),
      );

      const f = setup(
        makeOrder({
          paymentStatus: Pay.AWAITING_VERIFICATION,
          paymentReference: "MP1",
        }),
      );
      expect(
        (await f.service.verifyPayment(STAFF, PHARMACY, "order-1", false))
          .paymentStatus,
      ).toBe(Pay.FAILED);
    });

    it("is staff only and needs a payment to check", async () => {
      await expect(
        setup(
          makeOrder({ paymentStatus: Pay.AWAITING_VERIFICATION }),
        ).service.verifyPayment(CUSTOMER, PHARMACY, "order-1", true),
      ).rejects.toThrow(ForbiddenException);
      await expect(
        setup().service.verifyPayment(STAFF, PHARMACY, "order-1", true),
      ).rejects.toThrow(ConflictException);
    });
  });

  it("marks a refund sent only when one is owed", async () => {
    const t = setup(
      makeOrder({ status: Status.CANCELLED, paymentStatus: Pay.REFUND_DUE }),
    );
    expect(
      (await t.service.markRefunded(STAFF, PHARMACY, "order-1")).paymentStatus,
    ).toBe(Pay.REFUNDED);
    await expect(
      setup().service.markRefunded(STAFF, PHARMACY, "order-1"),
    ).rejects.toThrow(ConflictException);
  });

  describe("cancelByCustomer", () => {
    it("cancels before preparation, puts stock back and flags a refund for paid mobile money", async () => {
      const t = setup(
        makeOrder({ status: Status.ACCEPTED, paymentStatus: Pay.PAID }),
      );
      const saved = await t.service.cancelByCustomer(CUSTOMER, "order-1");
      expect(saved.status).toBe(Status.CANCELLED);
      expect(saved.paymentStatus).toBe(Pay.REFUND_DUE);
      expect(t.inventory.increment).toHaveBeenCalledWith(
        { productId: "p1" },
        "quantity",
        3,
      );
      expect(t.notifier.staffOf).toHaveBeenCalledWith(
        PHARMACY,
        "pharmacy_order.cancelled",
        expect.any(String),
        expect.stringContaining("Refund"),
      );
    });

    it("refuses once the pharmacy is preparing", async () => {
      await expect(
        setup(makeOrder({ status: Status.PREPARING })).service.cancelByCustomer(
          CUSTOMER,
          "order-1",
        ),
      ).rejects.toThrow(ConflictException);
    });
  });

  it("rebuilds a cart from a past order at today's price, capped by stock", async () => {
    const t = setup();
    const result = await t.service.reorder(CUSTOMER, "order-1");
    expect(result.lines).toEqual([
      expect.objectContaining({
        productId: "p1",
        quantity: 2,
        previousQuantity: 3,
        price: 129,
        available: true,
      }),
    ]);
  });

  describe("chat", () => {
    it("speaks for the pharmacy when staff reply and notifies the other side", async () => {
      const t = setup();
      const fromCustomer = await t.service.sendMessage(
        CUSTOMER,
        "order-1",
        "Is the generic OK?",
      );
      expect(fromCustomer).toEqual(
        expect.objectContaining({ fromPharmacy: false, senderName: "Ama" }),
      );
      expect(t.notifier.staffOf).toHaveBeenCalledWith(
        PHARMACY,
        "pharmacy_order_message.received",
        expect.any(String),
        "Is the generic OK?",
        CUSTOMER,
      );

      const fromStaff = await t.service.sendMessage(
        STAFF,
        "order-1",
        "Yes, same medicine.",
      );
      expect(fromStaff).toEqual(
        expect.objectContaining({
          fromPharmacy: true,
          senderName: "CarePoint",
        }),
      );
      expect(t.notifier.customer).toHaveBeenCalledWith(
        expect.anything(),
        "pharmacy_order_message.received",
        expect.any(String),
        "Yes, same medicine.",
      );
    });

    it("hides the thread from anyone who isn't the customer or staff", async () => {
      await expect(
        setup().service.listMessages("stranger", "order-1"),
      ).rejects.toThrow(NotFoundException);
    });

    it("marks the other side's messages read when the thread is opened", async () => {
      const t = setup();
      await t.service.listMessages(CUSTOMER, "order-1");
      expect(t.messages.update).toHaveBeenCalledWith(
        expect.objectContaining({ fromPharmacy: true }),
        expect.objectContaining({ readAt: expect.any(Date) }),
      );
    });
  });
});
