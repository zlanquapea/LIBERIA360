import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import { getRepositoryToken } from "@nestjs/typeorm";
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
    save: jest.Mock;
    createQueryBuilder: jest.Mock;
  };
  let staffRepo: { findOne: jest.Mock };
  let productRepo: { find: jest.Mock };
  let inventoryRepo: { decrement: jest.Mock; increment: jest.Mock };
  let orderRepo: {
    create: jest.Mock;
    save: jest.Mock;
    findOneBy: jest.Mock;
    findOneOrFail: jest.Mock;
    manager: undefined;
  };
  let orderItemRepo: { create: jest.Mock; save: jest.Mock; find: jest.Mock };
  let prescriptionRepo: {
    findOne: jest.Mock;
    save: jest.Mock;
    create: jest.Mock;
    update: jest.Mock;
  };
  let reviewRepo: { save: jest.Mock; create: jest.Mock };
  let auditRepo: { save: jest.Mock; create: jest.Mock };

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
      save: jest.fn((x) => Promise.resolve(x)),
      createQueryBuilder: jest.fn(),
    };
    staffRepo = { findOne: jest.fn() };
    productRepo = { find: jest.fn() };
    inventoryRepo = {
      decrement: jest.fn().mockResolvedValue(undefined),
      increment: jest.fn().mockResolvedValue(undefined),
    };
    orderRepo = {
      create: jest.fn((x) => x),
      save: jest.fn((x) => Promise.resolve({ id: "order-1", ...x })),
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
      save: jest.fn((x) => Promise.resolve({ id: "rx-1", ...x })),
      create: jest.fn((x) => x),
      update: jest.fn().mockResolvedValue(undefined),
    };
    reviewRepo = {
      save: jest.fn((x) => Promise.resolve(x)),
      create: jest.fn((x) => x),
    };
    auditRepo = {
      save: jest.fn().mockResolvedValue(undefined),
      create: jest.fn((x) => x),
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
        { provide: STORAGE_PROVIDER, useValue: { save: jest.fn() } },
      ],
    }).compile();

    service = module.get(PharmaciesService);
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
        { id: "rx-1" },
        { orderId: "order-1" },
      );
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

      expect(orderRepo.save).toHaveBeenCalled();
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

      expect(orderRepo.save).toHaveBeenCalled();
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
});
