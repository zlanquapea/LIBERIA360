import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import { getRepositoryToken } from "@nestjs/typeorm";
import { IsNull } from "typeorm";
import {
  calculatePharmacyTotals,
  PHARMACY_ORDER_TRANSITIONS,
  PharmaciesService,
} from "./pharmacies.service";
import {
  FulfillmentMethod,
  PharmacyOrderStatus,
  PharmacyStaffRole,
  PharmacyStatus,
  PrescriptionDecision,
} from "./entities/pharmacy.enums";
import {
  Pharmacy,
  PharmacyOpeningHours,
  PharmacyStaff,
  PharmacyVerification,
} from "./entities/pharmacy.entity";
import {
  PharmacyInventory,
  PharmacyProduct,
  PharmacyProductCategory,
} from "./entities/product.entity";
import {
  PharmacyAuditLog,
  PharmacyOrder,
  PharmacyOrderItem,
  Prescription,
  PrescriptionReview,
} from "./entities/order.entity";
import { STORAGE_PROVIDER } from "../uploads/storage/storage-provider.interface";
import { UsersService } from "../users/users.service";

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
  it("only lets a prescription order leave under_review via the pharmacist review flow, not the generic status endpoint", () => {
    // accepted/rejected are deliberately absent here: only review() (which
    // checks the pharmacist role and records a PrescriptionReview) may make
    // that decision. Cancelling is still allowed generically.
    expect(PHARMACY_ORDER_TRANSITIONS.under_review).toEqual([
      PharmacyOrderStatus.CANCELLED,
    ]);
  });
});

describe("PharmaciesService", () => {
  let service: PharmaciesService;
  let pharmacyRepo: {
    findOneBy: jest.Mock;
    findOneByOrFail: jest.Mock;
    save: jest.Mock;
    createQueryBuilder: jest.Mock;
  };
  let staffRepo: {
    findOne: jest.Mock;
    save: jest.Mock;
    create: jest.Mock;
    count: jest.Mock;
  };
  let usersService: { findByEmail: jest.Mock };
  let productRepo: { find: jest.Mock };
  let inventoryRepo: { decrement: jest.Mock; increment: jest.Mock };
  let orderRepo: {
    create: jest.Mock;
    save: jest.Mock;
    update: jest.Mock;
    find: jest.Mock;
    findOneBy: jest.Mock;
    findOneOrFail: jest.Mock;
    manager: undefined;
  };
  let orderItemRepo: { create: jest.Mock; save: jest.Mock; find: jest.Mock };
  let prescriptionRepo: {
    findOne: jest.Mock;
    find: jest.Mock;
    save: jest.Mock;
    create: jest.Mock;
    update: jest.Mock;
    createQueryBuilder: jest.Mock;
  };
  let reviewRepo: { save: jest.Mock; create: jest.Mock };
  let auditRepo: { save: jest.Mock; create: jest.Mock };
  let storageProvider: {
    save: jest.Mock;
    savePrivate: jest.Mock;
    readPrivate: jest.Mock;
  };

  function approvedPharmacy(overrides: Partial<Pharmacy> = {}): Pharmacy {
    return {
      id: "pharmacy-1",
      status: PharmacyStatus.APPROVED,
      pickupEnabled: true,
      deliveryEnabled: true,
      deliveryFee: 5,
      ...overrides,
    } as Pharmacy;
  }
  // verification() opts back into the `select: false` licenceNumber column
  // via createQueryBuilder rather than a plain findOneBy — mock that chain.
  function mockPharmacyQueryBuilder(pharmacy: Partial<Pharmacy> | null) {
    pharmacyRepo.createQueryBuilder.mockReturnValue({
      addSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      getOne: jest.fn().mockResolvedValue(pharmacy),
      getOneOrFail: pharmacy
        ? jest.fn().mockResolvedValue(pharmacy)
        : jest.fn().mockRejectedValue(new Error("not found")),
    });
  }
  function product(overrides: Partial<PharmacyProduct> = {}): PharmacyProduct {
    return {
      id: "product-1",
      pharmacyId: "pharmacy-1",
      name: "Paracetamol",
      price: 10,
      prescriptionRequired: false,
      isVisible: true,
      inventory: { quantity: 5 },
      ...overrides,
    } as PharmacyProduct;
  }

  beforeEach(async () => {
    pharmacyRepo = {
      findOneBy: jest.fn(),
      findOneByOrFail: jest.fn(),
      save: jest.fn((x) => Promise.resolve(x)),
      createQueryBuilder: jest.fn(),
    };
    staffRepo = {
      findOne: jest.fn(),
      save: jest.fn((x) => Promise.resolve({ id: "staff-1", ...x })),
      create: jest.fn((x) => x),
      count: jest.fn(),
    };
    usersService = { findByEmail: jest.fn() };
    productRepo = { find: jest.fn() };
    inventoryRepo = {
      decrement: jest.fn().mockResolvedValue(undefined),
      increment: jest.fn().mockResolvedValue(undefined),
    };
    orderRepo = {
      create: jest.fn((x) => x),
      save: jest.fn((x) => Promise.resolve({ id: "order-1", ...x })),
      // Real UpdateResult always has `affected` — default to "1 row
      // updated" so transition()/review()'s conditional updates succeed
      // unless a test deliberately simulates a lost race with affected: 0.
      update: jest.fn().mockResolvedValue({ affected: 1 }),
      find: jest.fn().mockResolvedValue([]),
      findOneBy: jest.fn(),
      findOneOrFail: jest.fn().mockResolvedValue({ id: "order-1" }),
      manager: undefined,
    };
    orderItemRepo = {
      create: jest.fn((x) => x),
      save: jest.fn().mockResolvedValue(undefined),
      find: jest.fn().mockResolvedValue([]),
    };
    prescriptionRepo = {
      findOne: jest.fn(),
      find: jest.fn().mockResolvedValue([]),
      save: jest.fn((x) => Promise.resolve({ id: "rx-1", ...x })),
      create: jest.fn((x) => x),
      // Same reasoning as orderRepo.update above — default to "claimed
      // successfully" unless a test simulates a concurrent claim.
      update: jest.fn().mockResolvedValue({ affected: 1 }),
      createQueryBuilder: jest.fn(),
    };
    reviewRepo = {
      save: jest.fn((x) => Promise.resolve(x)),
      create: jest.fn((x) => x),
    };
    auditRepo = {
      save: jest.fn().mockResolvedValue(undefined),
      create: jest.fn((x) => x),
    };
    storageProvider = {
      save: jest.fn(),
      savePrivate: jest
        .fn()
        .mockResolvedValue({ key: "prescriptions/rx-1.jpg" }),
      readPrivate: jest.fn().mockResolvedValue({ buffer: Buffer.from("x") }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PharmaciesService,
        { provide: getRepositoryToken(Pharmacy), useValue: pharmacyRepo },
        { provide: getRepositoryToken(PharmacyStaff), useValue: staffRepo },
        { provide: getRepositoryToken(PharmacyOpeningHours), useValue: {} },
        {
          provide: getRepositoryToken(PharmacyProduct),
          useValue: productRepo,
        },
        {
          provide: getRepositoryToken(PharmacyInventory),
          useValue: inventoryRepo,
        },
        { provide: getRepositoryToken(PharmacyProductCategory), useValue: {} },
        { provide: getRepositoryToken(PharmacyOrder), useValue: orderRepo },
        {
          provide: getRepositoryToken(PharmacyOrderItem),
          useValue: orderItemRepo,
        },
        {
          provide: getRepositoryToken(Prescription),
          useValue: prescriptionRepo,
        },
        {
          provide: getRepositoryToken(PrescriptionReview),
          useValue: reviewRepo,
        },
        {
          provide: getRepositoryToken(PharmacyVerification),
          useValue: {
            save: jest.fn().mockResolvedValue(undefined),
            create: jest.fn((x) => x),
          },
        },
        { provide: getRepositoryToken(PharmacyAuditLog), useValue: auditRepo },
        { provide: STORAGE_PROVIDER, useValue: storageProvider },
        { provide: UsersService, useValue: usersService },
      ],
    }).compile();

    service = module.get(PharmaciesService);
  });

  describe("assignStaff", () => {
    it("lets a manager add a new pharmacist by email", async () => {
      staffRepo.findOne
        .mockResolvedValueOnce({ role: PharmacyStaffRole.MANAGER }) // assertStaff(managerId, ...)
        .mockResolvedValueOnce(null); // no existing membership for the invitee
      usersService.findByEmail.mockResolvedValue({ id: "user-2" });

      await service.assignStaff("manager-1", "pharmacy-1", {
        email: "pharmacist@example.com",
        role: PharmacyStaffRole.PHARMACIST,
      } as any);

      expect(staffRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          pharmacyId: "pharmacy-1",
          userId: "user-2",
          role: PharmacyStaffRole.PHARMACIST,
          active: true,
        }),
      );
    });

    it("refuses when the caller isn't a manager", async () => {
      staffRepo.findOne.mockResolvedValueOnce({
        role: PharmacyStaffRole.PHARMACIST,
      });

      await expect(
        service.assignStaff("user-1", "pharmacy-1", {
          email: "x@example.com",
          role: PharmacyStaffRole.EMPLOYEE,
        } as any),
      ).rejects.toThrow(ForbiddenException);
      expect(staffRepo.save).not.toHaveBeenCalled();
    });

    it("404s when no account exists for that email", async () => {
      staffRepo.findOne.mockResolvedValueOnce({
        role: PharmacyStaffRole.MANAGER,
      });
      usersService.findByEmail.mockResolvedValue(null);

      await expect(
        service.assignStaff("manager-1", "pharmacy-1", {
          email: "nobody@example.com",
          role: PharmacyStaffRole.PHARMACIST,
        } as any),
      ).rejects.toThrow(NotFoundException);
      expect(staffRepo.save).not.toHaveBeenCalled();
    });

    it("refuses to demote the pharmacy's only active manager", async () => {
      staffRepo.findOne
        .mockResolvedValueOnce({ role: PharmacyStaffRole.MANAGER }) // assertStaff(managerId, ...)
        .mockResolvedValueOnce({
          role: PharmacyStaffRole.MANAGER,
          active: true,
        }); // the manager demoting themselves
      usersService.findByEmail.mockResolvedValue({ id: "manager-user-1" });
      staffRepo.count.mockResolvedValue(1);

      await expect(
        service.assignStaff("manager-1", "pharmacy-1", {
          email: "manager-1@example.com",
          role: PharmacyStaffRole.PHARMACIST,
        } as any),
      ).rejects.toThrow(ConflictException);
      expect(staffRepo.save).not.toHaveBeenCalled();
    });

    it("allows demoting a manager when another active manager remains", async () => {
      staffRepo.findOne
        .mockResolvedValueOnce({ role: PharmacyStaffRole.MANAGER }) // assertStaff(managerId, ...)
        .mockResolvedValueOnce({
          role: PharmacyStaffRole.MANAGER,
          active: true,
        });
      usersService.findByEmail.mockResolvedValue({ id: "other-manager-user" });
      staffRepo.count.mockResolvedValue(2);

      await service.assignStaff("manager-1", "pharmacy-1", {
        email: "other-manager@example.com",
        role: PharmacyStaffRole.EMPLOYEE,
      } as any);

      expect(staffRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ role: PharmacyStaffRole.EMPLOYEE }),
      );
    });
  });

  describe("createOrder", () => {
    it("aggregates duplicate product lines into a single stock check and decrement", async () => {
      pharmacyRepo.findOneBy.mockResolvedValue(approvedPharmacy());
      productRepo.find.mockResolvedValue([
        product({ inventory: { quantity: 5 } as any }),
      ]);

      await service.createOrder("user-1", {
        pharmacyId: "pharmacy-1",
        fulfillmentMethod: FulfillmentMethod.PICKUP,
        items: [
          { productId: "product-1", quantity: 2 },
          { productId: "product-1", quantity: 3 },
        ],
      } as any);

      expect(inventoryRepo.decrement).toHaveBeenCalledTimes(1);
      expect(inventoryRepo.decrement).toHaveBeenCalledWith(
        { productId: "product-1" },
        "quantity",
        5,
      );
    });

    it("rejects duplicate lines that together exceed stock, even though no single line does", async () => {
      pharmacyRepo.findOneBy.mockResolvedValue(approvedPharmacy());
      productRepo.find.mockResolvedValue([
        product({ inventory: { quantity: 4 } as any }),
      ]);

      await expect(
        service.createOrder("user-1", {
          pharmacyId: "pharmacy-1",
          fulfillmentMethod: FulfillmentMethod.PICKUP,
          items: [
            { productId: "product-1", quantity: 3 },
            { productId: "product-1", quantity: 3 },
          ],
        } as any),
      ).rejects.toThrow(ConflictException);
      expect(orderRepo.save).not.toHaveBeenCalled();
      expect(inventoryRepo.decrement).not.toHaveBeenCalled();
    });

    it("validates prescription ownership before writing anything", async () => {
      pharmacyRepo.findOneBy.mockResolvedValue(approvedPharmacy());
      productRepo.find.mockResolvedValue([
        product({ prescriptionRequired: true }),
      ]);
      // Not found — could be nonexistent, someone else's, a different
      // pharmacy's, or already attached to another order.
      prescriptionRepo.findOne.mockResolvedValue(null);

      await expect(
        service.createOrder("user-1", {
          pharmacyId: "pharmacy-1",
          fulfillmentMethod: FulfillmentMethod.PICKUP,
          items: [{ productId: "product-1", quantity: 1 }],
          prescriptionId: "rx-1",
          consentToPrescriptionProcessing: true,
        } as any),
      ).rejects.toThrow(BadRequestException);
      expect(orderRepo.save).not.toHaveBeenCalled();
      expect(orderItemRepo.save).not.toHaveBeenCalled();
      expect(inventoryRepo.decrement).not.toHaveBeenCalled();
    });

    it("links a valid prescription to the order once it exists", async () => {
      pharmacyRepo.findOneBy.mockResolvedValue(approvedPharmacy());
      productRepo.find.mockResolvedValue([
        product({ prescriptionRequired: true }),
      ]);
      prescriptionRepo.findOne.mockResolvedValue({ id: "rx-1", orderId: null });

      await service.createOrder("user-1", {
        pharmacyId: "pharmacy-1",
        fulfillmentMethod: FulfillmentMethod.PICKUP,
        items: [{ productId: "product-1", quantity: 1 }],
        prescriptionId: "rx-1",
        consentToPrescriptionProcessing: true,
      } as any);

      expect(prescriptionRepo.update).toHaveBeenCalledWith(
        { id: "rx-1", orderId: IsNull() },
        { orderId: "order-1" },
      );
    });

    it("rejects the order when a concurrent checkout already claimed the same prescription", async () => {
      pharmacyRepo.findOneBy.mockResolvedValue(approvedPharmacy());
      productRepo.find.mockResolvedValue([
        product({ prescriptionRequired: true }),
      ]);
      prescriptionRepo.findOne.mockResolvedValue({ id: "rx-1", orderId: null });
      // Simulates the row lock losing a race: another transaction's update
      // committed between this request's findOne above and its own update,
      // so `orderId IS NULL` no longer matches and zero rows are affected.
      prescriptionRepo.update.mockResolvedValue({ affected: 0 });

      await expect(
        service.createOrder("user-1", {
          pharmacyId: "pharmacy-1",
          fulfillmentMethod: FulfillmentMethod.PICKUP,
          items: [{ productId: "product-1", quantity: 1 }],
          prescriptionId: "rx-1",
          consentToPrescriptionProcessing: true,
        } as any),
      ).rejects.toThrow(ConflictException);
    });

    it("rejects a whitespace-only delivery address instead of silently trimming it away", async () => {
      pharmacyRepo.findOneBy.mockResolvedValue(approvedPharmacy());
      productRepo.find.mockResolvedValue([product()]);

      await expect(
        service.createOrder("user-1", {
          pharmacyId: "pharmacy-1",
          fulfillmentMethod: FulfillmentMethod.DELIVERY,
          deliveryAddress: "     ",
          items: [{ productId: "product-1", quantity: 1 }],
        } as any),
      ).rejects.toThrow(BadRequestException);
      expect(orderRepo.save).not.toHaveBeenCalled();
    });
  });

  describe("review", () => {
    it("refuses a decision once the order has already left review", async () => {
      staffRepo.findOne.mockResolvedValue({
        role: PharmacyStaffRole.PHARMACIST,
      });
      prescriptionRepo.findOne.mockResolvedValue({
        id: "rx-1",
        orderId: "order-1",
      });
      // An earlier decision (or a cancellation) already moved this order
      // out of under_review by the time this call started.
      orderRepo.findOneBy.mockResolvedValue({
        id: "order-1",
        status: PharmacyOrderStatus.ACCEPTED,
      });

      await expect(
        service.review("user-1", "pharmacy-1", "rx-1", {
          decision: PrescriptionDecision.REJECTED,
        } as any),
      ).rejects.toThrow(ConflictException);
      expect(reviewRepo.save).not.toHaveBeenCalled();
    });

    it("refuses a decision from staff who isn't a pharmacist", async () => {
      staffRepo.findOne.mockResolvedValue({ role: PharmacyStaffRole.EMPLOYEE });

      await expect(
        service.review("user-1", "pharmacy-1", "rx-1", {
          decision: PrescriptionDecision.ACCEPTED,
        } as any),
      ).rejects.toThrow(ForbiddenException);
    });

    it("refuses a decision from a manager too — pharmacist-only", async () => {
      staffRepo.findOne.mockResolvedValue({ role: PharmacyStaffRole.MANAGER });

      await expect(
        service.review("user-1", "pharmacy-1", "rx-1", {
          decision: PrescriptionDecision.ACCEPTED,
        } as any),
      ).rejects.toThrow(ForbiddenException);
    });

    it("restores reserved inventory when a pharmacist rejects a prescription", async () => {
      staffRepo.findOne.mockResolvedValue({
        role: PharmacyStaffRole.PHARMACIST,
      });
      prescriptionRepo.findOne.mockResolvedValue({
        id: "rx-1",
        orderId: "order-1",
      });
      orderRepo.findOneBy.mockResolvedValue({
        id: "order-1",
        status: PharmacyOrderStatus.UNDER_REVIEW,
      });
      orderItemRepo.find.mockResolvedValue([
        { productId: "product-1", quantity: 2 },
      ]);

      await service.review("user-1", "pharmacy-1", "rx-1", {
        decision: PrescriptionDecision.REJECTED,
      } as any);

      expect(inventoryRepo.increment).toHaveBeenCalledWith(
        { productId: "product-1" },
        "quantity",
        2,
      );
    });

    it("does not restore inventory when a pharmacist accepts a prescription", async () => {
      staffRepo.findOne.mockResolvedValue({
        role: PharmacyStaffRole.PHARMACIST,
      });
      prescriptionRepo.findOne.mockResolvedValue({
        id: "rx-1",
        orderId: "order-1",
      });
      orderRepo.findOneBy.mockResolvedValue({
        id: "order-1",
        status: PharmacyOrderStatus.UNDER_REVIEW,
      });

      await service.review("user-1", "pharmacy-1", "rx-1", {
        decision: PrescriptionDecision.ACCEPTED,
      } as any);

      expect(inventoryRepo.increment).not.toHaveBeenCalled();
    });

    it("does not double-restore inventory when the order already left under_review", async () => {
      staffRepo.findOne.mockResolvedValue({
        role: PharmacyStaffRole.PHARMACIST,
      });
      prescriptionRepo.findOne.mockResolvedValue({
        id: "rx-1",
        orderId: "order-1",
      });
      // The preliminary check (still under_review at the time review()
      // was called) passes...
      orderRepo.findOneBy.mockResolvedValue({
        id: "order-1",
        status: PharmacyOrderStatus.UNDER_REVIEW,
      });
      // ...but the conditional update's row lock finds the order no
      // longer under_review by the time it runs (a genuinely concurrent
      // second decision landed first) — the whole decision (including the
      // review row just written) is rolled back rather than silently
      // recording a contradictory review beside the winning one.
      orderRepo.update.mockResolvedValue({ affected: 0 });

      await expect(
        service.review("user-1", "pharmacy-1", "rx-1", {
          decision: PrescriptionDecision.REJECTED,
        } as any),
      ).rejects.toThrow(ConflictException);

      expect(inventoryRepo.increment).not.toHaveBeenCalled();
    });
  });

  describe("pharmacyOrders", () => {
    it("attaches each order's prescriptionId and line items so staff can prepare/review orders", async () => {
      staffRepo.findOne.mockResolvedValue({ role: PharmacyStaffRole.MANAGER });
      orderRepo.find.mockResolvedValue([
        { id: "order-1", status: PharmacyOrderStatus.UNDER_REVIEW },
        { id: "order-2", status: PharmacyOrderStatus.PENDING },
      ]);
      prescriptionRepo.find.mockResolvedValue([
        { id: "rx-1", orderId: "order-1" },
      ]);
      orderItemRepo.find.mockResolvedValue([
        { id: "item-1", orderId: "order-1", name: "Paracetamol", quantity: 2 },
        { id: "item-2", orderId: "order-2", name: "Vitamin C", quantity: 1 },
      ]);

      const orders = await service.pharmacyOrders("user-1", "pharmacy-1");

      expect(orders).toEqual([
        expect.objectContaining({
          id: "order-1",
          prescriptionId: "rx-1",
          items: [
            {
              id: "item-1",
              orderId: "order-1",
              name: "Paracetamol",
              quantity: 2,
            },
          ],
        }),
        expect.objectContaining({
          id: "order-2",
          prescriptionId: null,
          items: [
            {
              id: "item-2",
              orderId: "order-2",
              name: "Vitamin C",
              quantity: 1,
            },
          ],
        }),
      ]);
    });
  });

  describe("customerOrders", () => {
    it("attaches each order's line items so a customer's order history is distinguishable", async () => {
      orderRepo.find.mockResolvedValue([
        { id: "order-1", finalTotal: "10.00" },
        { id: "order-2", finalTotal: "10.00" },
      ]);
      orderItemRepo.find.mockResolvedValue([
        { id: "item-1", orderId: "order-1", name: "Paracetamol", quantity: 2 },
        { id: "item-2", orderId: "order-2", name: "Vitamin C", quantity: 1 },
      ]);

      const orders = await service.customerOrders("customer-1");

      expect(orders).toEqual([
        expect.objectContaining({
          id: "order-1",
          items: [
            {
              id: "item-1",
              orderId: "order-1",
              name: "Paracetamol",
              quantity: 2,
            },
          ],
        }),
        expect.objectContaining({
          id: "order-2",
          items: [
            {
              id: "item-2",
              orderId: "order-2",
              name: "Vitamin C",
              quantity: 1,
            },
          ],
        }),
      ]);
    });
  });

  describe("transition", () => {
    it("restores reserved inventory when an order is cancelled", async () => {
      staffRepo.findOne.mockResolvedValue({ role: PharmacyStaffRole.MANAGER });
      orderRepo.findOneBy.mockResolvedValue({
        id: "order-1",
        status: PharmacyOrderStatus.PENDING,
      });
      orderItemRepo.find.mockResolvedValue([
        { productId: "product-1", quantity: 4 },
      ]);

      await service.transition(
        "user-1",
        "pharmacy-1",
        "order-1",
        PharmacyOrderStatus.CANCELLED,
      );

      expect(inventoryRepo.increment).toHaveBeenCalledWith(
        { productId: "product-1" },
        "quantity",
        4,
      );
    });

    it("refuses to double-restore inventory when a concurrent request already moved the order out of its expected status", async () => {
      staffRepo.findOne.mockResolvedValue({ role: PharmacyStaffRole.MANAGER });
      orderRepo.findOneBy.mockResolvedValue({
        id: "order-1",
        status: PharmacyOrderStatus.PENDING,
      });
      // Conditional update's row lock loses the race: another request's
      // update already committed, so `status = pending` no longer matches.
      orderRepo.update.mockResolvedValue({ affected: 0 });

      await expect(
        service.transition(
          "user-1",
          "pharmacy-1",
          "order-1",
          PharmacyOrderStatus.CANCELLED,
        ),
      ).rejects.toThrow(ConflictException);
      expect(inventoryRepo.increment).not.toHaveBeenCalled();
    });

    it("does not restore inventory for a non-cancelling transition", async () => {
      staffRepo.findOne.mockResolvedValue({ role: PharmacyStaffRole.MANAGER });
      orderRepo.findOneBy.mockResolvedValue({
        id: "order-1",
        status: PharmacyOrderStatus.PENDING,
      });

      await service.transition(
        "user-1",
        "pharmacy-1",
        "order-1",
        PharmacyOrderStatus.ACCEPTED,
      );

      expect(inventoryRepo.increment).not.toHaveBeenCalled();
    });

    it("blocks approving/rejecting a prescription order through the generic status endpoint", async () => {
      staffRepo.findOne.mockResolvedValue({ role: PharmacyStaffRole.MANAGER });
      orderRepo.findOneBy.mockResolvedValue({
        id: "order-1",
        status: PharmacyOrderStatus.UNDER_REVIEW,
        fulfillmentMethod: FulfillmentMethod.PICKUP,
      });

      await expect(
        service.transition(
          "user-1",
          "pharmacy-1",
          "order-1",
          PharmacyOrderStatus.ACCEPTED,
        ),
      ).rejects.toThrow(ConflictException);
      expect(orderRepo.save).not.toHaveBeenCalled();
    });

    it("still allows cancelling a prescription order under review", async () => {
      staffRepo.findOne.mockResolvedValue({ role: PharmacyStaffRole.MANAGER });
      orderRepo.findOneBy.mockResolvedValue({
        id: "order-1",
        status: PharmacyOrderStatus.UNDER_REVIEW,
        fulfillmentMethod: FulfillmentMethod.PICKUP,
      });
      orderItemRepo.find.mockResolvedValue([]);

      await service.transition(
        "user-1",
        "pharmacy-1",
        "order-1",
        PharmacyOrderStatus.CANCELLED,
      );

      expect(orderRepo.update).toHaveBeenCalledWith(
        {
          id: "order-1",
          pharmacyId: "pharmacy-1",
          status: PharmacyOrderStatus.UNDER_REVIEW,
        },
        { status: PharmacyOrderStatus.CANCELLED },
      );
    });

    it("refuses to mark a delivery order ready for pickup", async () => {
      staffRepo.findOne.mockResolvedValue({ role: PharmacyStaffRole.MANAGER });
      orderRepo.findOneBy.mockResolvedValue({
        id: "order-1",
        status: PharmacyOrderStatus.PREPARING,
        fulfillmentMethod: FulfillmentMethod.DELIVERY,
      });

      await expect(
        service.transition(
          "user-1",
          "pharmacy-1",
          "order-1",
          PharmacyOrderStatus.READY_FOR_PICKUP,
        ),
      ).rejects.toThrow(ConflictException);
      expect(orderRepo.save).not.toHaveBeenCalled();
    });

    it("refuses to mark a pickup order out for delivery", async () => {
      staffRepo.findOne.mockResolvedValue({ role: PharmacyStaffRole.MANAGER });
      orderRepo.findOneBy.mockResolvedValue({
        id: "order-1",
        status: PharmacyOrderStatus.PREPARING,
        fulfillmentMethod: FulfillmentMethod.PICKUP,
      });

      await expect(
        service.transition(
          "user-1",
          "pharmacy-1",
          "order-1",
          PharmacyOrderStatus.OUT_FOR_DELIVERY,
        ),
      ).rejects.toThrow(ConflictException);
      expect(orderRepo.save).not.toHaveBeenCalled();
    });

    it("allows the dispatch state that actually matches the order's fulfillment method", async () => {
      staffRepo.findOne.mockResolvedValue({ role: PharmacyStaffRole.MANAGER });
      orderRepo.findOneBy.mockResolvedValue({
        id: "order-1",
        status: PharmacyOrderStatus.PREPARING,
        fulfillmentMethod: FulfillmentMethod.DELIVERY,
      });

      await service.transition(
        "user-1",
        "pharmacy-1",
        "order-1",
        PharmacyOrderStatus.OUT_FOR_DELIVERY,
      );

      expect(orderRepo.update).toHaveBeenCalledWith(
        {
          id: "order-1",
          pharmacyId: "pharmacy-1",
          status: PharmacyOrderStatus.PREPARING,
        },
        { status: PharmacyOrderStatus.OUT_FOR_DELIVERY },
      );
    });
  });

  describe("catalog", () => {
    it("hides a suspended or otherwise non-approved pharmacy's products", async () => {
      pharmacyRepo.findOneBy.mockResolvedValue(
        approvedPharmacy({ status: PharmacyStatus.SUSPENDED }),
      );

      await expect(service.catalog("pharmacy-1", {} as any)).rejects.toThrow(
        NotFoundException,
      );
      expect(productRepo.find).not.toHaveBeenCalled();
    });

    it("returns the catalog for an approved pharmacy", async () => {
      pharmacyRepo.findOneBy.mockResolvedValue(approvedPharmacy());
      productRepo.find.mockResolvedValue([product()]);

      const items = await service.catalog("pharmacy-1", {} as any);

      expect(items).toHaveLength(1);
    });
  });

  describe("uploadPrescription / prescriptionFile", () => {
    it("stores the file via the storage provider's private path and keeps only the returned key, never a URL", async () => {
      pharmacyRepo.findOneBy.mockResolvedValue(approvedPharmacy());
      storageProvider.savePrivate.mockResolvedValue({
        key: "prescriptions/abc123.jpg",
      });

      await service.uploadPrescription("user-1", "pharmacy-1", {
        buffer: Buffer.from("fake-bytes"),
        originalName: "script.jpg",
        mimeType: "image/jpeg",
      });

      expect(storageProvider.save).not.toHaveBeenCalled();
      expect(storageProvider.savePrivate).toHaveBeenCalledWith(
        expect.objectContaining({ contentType: "image/jpeg" }),
      );
      expect(prescriptionRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          privateStorageKey: "prescriptions/abc123.jpg",
        }),
      );
    });

    it("reads the file back via the storage provider for the owning customer", async () => {
      prescriptionRepo.createQueryBuilder.mockReturnValue({
        addSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue({
          id: "rx-1",
          customerUserId: "user-1",
          pharmacyId: "pharmacy-1",
          privateStorageKey: "prescriptions/abc123.jpg",
          mimeType: "image/jpeg",
          originalFilename: "script.jpg",
        }),
      });
      storageProvider.readPrivate.mockResolvedValue({
        buffer: Buffer.from("fake-bytes"),
      });

      const result = await service.prescriptionFile("user-1", false, "rx-1");

      expect(storageProvider.readPrivate).toHaveBeenCalledWith(
        "prescriptions/abc123.jpg",
      );
      expect(result.buffer).toEqual(Buffer.from("fake-bytes"));
    });

    it("refuses to read the file back for a caller who is neither owner, staff, nor admin", async () => {
      prescriptionRepo.createQueryBuilder.mockReturnValue({
        addSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue({
          id: "rx-1",
          customerUserId: "someone-else",
          pharmacyId: "pharmacy-1",
          privateStorageKey: "prescriptions/abc123.jpg",
          mimeType: "image/jpeg",
          originalFilename: "script.jpg",
        }),
      });
      staffRepo.findOne.mockResolvedValue(null);

      await expect(
        service.prescriptionFile("user-1", false, "rx-1"),
      ).rejects.toThrow(ForbiddenException);
      expect(storageProvider.readPrivate).not.toHaveBeenCalled();
    });
  });

  describe("verification", () => {
    it("refuses to approve a pharmacy with no licence number on file", async () => {
      mockPharmacyQueryBuilder({ id: "pharmacy-1", licenceNumber: null });

      await expect(
        service.verification("admin-1", "pharmacy-1", {
          decision: PharmacyStatus.APPROVED,
        } as any),
      ).rejects.toThrow(BadRequestException);
      expect(pharmacyRepo.save).not.toHaveBeenCalled();
    });

    it("approves a pharmacy once a licence number is on file", async () => {
      mockPharmacyQueryBuilder({
        id: "pharmacy-1",
        licenceNumber: "LR-PHM-0042",
      });

      await service.verification("admin-1", "pharmacy-1", {
        decision: PharmacyStatus.APPROVED,
      } as any);

      expect(pharmacyRepo.save).toHaveBeenCalled();
    });

    it("does not require a licence number to reject or suspend", async () => {
      mockPharmacyQueryBuilder({ id: "pharmacy-1", licenceNumber: null });

      await service.verification("admin-1", "pharmacy-1", {
        decision: PharmacyStatus.REJECTED,
      } as any);

      expect(pharmacyRepo.save).toHaveBeenCalled();
    });
  });

  describe("saveProfile", () => {
    it("sends an approved pharmacy back to pending when its licence number changes", async () => {
      staffRepo.findOne.mockResolvedValue({ role: PharmacyStaffRole.MANAGER });
      mockPharmacyQueryBuilder({
        id: "pharmacy-1",
        status: PharmacyStatus.APPROVED,
        licenceNumber: "LR-PHM-0042",
        slug: "existing-slug",
      });

      const saved = await service.saveProfile("user-1", "pharmacy-1", {
        name: "Test Pharmacy",
        address: "123 Main St",
        location: "Monrovia",
        telephone: "+231770000000",
        pickupEnabled: true,
        deliveryEnabled: true,
        deliveryFee: 5,
        licenceNumber: "LR-PHM-9999",
      } as any);

      // An admin verified LR-PHM-0042 specifically — a different licence
      // number is unreviewed evidence and must not keep the "approved"
      // (publicly visible, verified-badge) status.
      expect(saved.status).toBe(PharmacyStatus.PENDING);
    });

    it("leaves an approved pharmacy's status untouched when the licence number is unchanged", async () => {
      staffRepo.findOne.mockResolvedValue({ role: PharmacyStaffRole.MANAGER });
      mockPharmacyQueryBuilder({
        id: "pharmacy-1",
        status: PharmacyStatus.APPROVED,
        licenceNumber: "LR-PHM-0042",
        slug: "existing-slug",
      });

      const saved = await service.saveProfile("user-1", "pharmacy-1", {
        name: "Test Pharmacy Renamed",
        address: "123 Main St",
        location: "Monrovia",
        telephone: "+231770000000",
        pickupEnabled: true,
        deliveryEnabled: true,
        deliveryFee: 5,
        licenceNumber: "LR-PHM-0042",
      } as any);

      expect(saved.status).toBe(PharmacyStatus.APPROVED);
    });
  });
});
