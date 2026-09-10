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
    create: jest.Mock;
    update: jest.Mock;
    createQueryBuilder: jest.Mock;
  };
  let staffRepo: {
    findOne: jest.Mock;
    find: jest.Mock;
    save: jest.Mock;
    create: jest.Mock;
    count: jest.Mock;
  };
  let hoursRepo: { find: jest.Mock; upsert: jest.Mock };
  let usersService: { findByEmail: jest.Mock };
  let productRepo: {
    find: jest.Mock;
    findOneBy: jest.Mock;
    findOneOrFail: jest.Mock;
    save: jest.Mock;
    create: jest.Mock;
    delete: jest.Mock;
    createQueryBuilder: jest.Mock;
  };
  let inventoryRepo: {
    find: jest.Mock;
    decrement: jest.Mock;
    increment: jest.Mock;
    upsert: jest.Mock;
    createQueryBuilder: jest.Mock;
  };
  let categoryRepo: { findOneBy: jest.Mock };
  let orderRepo: {
    create: jest.Mock;
    save: jest.Mock;
    update: jest.Mock;
    find: jest.Mock;
    findBy: jest.Mock;
    findOneBy: jest.Mock;
    findOneOrFail: jest.Mock;
    createQueryBuilder: jest.Mock;
    manager: undefined;
  };
  let orderItemRepo: { create: jest.Mock; save: jest.Mock; find: jest.Mock };
  let prescriptionRepo: {
    findOne: jest.Mock;
    find: jest.Mock;
    save: jest.Mock;
    create: jest.Mock;
    update: jest.Mock;
    delete: jest.Mock;
    createQueryBuilder: jest.Mock;
  };
  let reviewRepo: {
    save: jest.Mock;
    create: jest.Mock;
    find: jest.Mock;
    findOne: jest.Mock;
    createQueryBuilder: jest.Mock;
  };
  let auditRepo: { save: jest.Mock; create: jest.Mock };
  let storageProvider: {
    save: jest.Mock;
    savePrivate: jest.Mock;
    readPrivate: jest.Mock;
    deletePrivate: jest.Mock;
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
    const builder = {
      setLock: jest.fn().mockReturnThis(),
      addSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      getOne: jest.fn().mockResolvedValue(pharmacy),
      getOneOrFail: pharmacy
        ? jest.fn().mockResolvedValue(pharmacy)
        : jest.fn().mockRejectedValue(new Error("not found")),
    };
    pharmacyRepo.createQueryBuilder.mockReturnValue(builder);
    return builder;
  }
  // review()'s clarification-request branch locks/rechecks the order via
  // createQueryBuilder(...).setLock(...) rather than findOneBy — mock that
  // chain the same way mockPharmacyQueryBuilder does above.
  function mockOrderQueryBuilder(
    order: { status: PharmacyOrderStatus } | null,
  ) {
    const builder = {
      setLock: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getOne: jest.fn().mockResolvedValue(order),
    };
    orderRepo.createQueryBuilder.mockReturnValue(builder);
    return builder;
  }
  // resubmitPrescription() locks and rechecks the latest review the same
  // way review()'s clarification-request branch locks the order — mock
  // that chain the same way mockOrderQueryBuilder does above.
  function mockReviewQueryBuilder(
    review: { decision: PrescriptionDecision } | null,
  ) {
    reviewRepo.createQueryBuilder.mockReturnValue({
      setLock: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      getOne: jest.fn().mockResolvedValue(review),
    });
  }
  // resubmitPrescription() also locks and re-reads the prescription's
  // *current* privateStorageKey inside the same transaction, right before
  // overwriting it — capturing it any earlier would be stale by the time a
  // concurrent resubmission (serialized behind the order lock above) gets
  // here. Mock that chain the same way.
  function mockPrescriptionQueryBuilder(privateStorageKey: string) {
    prescriptionRepo.createQueryBuilder.mockReturnValue({
      setLock: jest.fn().mockReturnThis(),
      addSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      getOneOrFail: jest.fn().mockResolvedValue({ privateStorageKey }),
    });
  }
  // review() locks and rereads the prescription's *current* version right
  // after locking the order — mock that chain the same way
  // mockPrescriptionQueryBuilder does above for resubmitPrescription()'s
  // own (distinct) prescription lock.
  function mockPrescriptionVersionLock(version: number) {
    prescriptionRepo.createQueryBuilder.mockReturnValue({
      setLock: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      getOneOrFail: jest.fn().mockResolvedValue({ version }),
    });
  }
  // createOrder() locks and re-reads both the pharmacy and the cart's
  // product rows inside its transaction — mock the product side of that
  // chain the same way mockPharmacyQueryBuilder does above.
  function mockProductQueryBuilder(products: PharmacyProduct[]) {
    productRepo.createQueryBuilder.mockReturnValue({
      setLock: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue(products),
    });
  }
  // saveProduct() locks and re-reads the *current* inventory row before
  // applying a stock delta — mock that chain the same way
  // mockPharmacyQueryBuilder does above.
  function mockInventoryQueryBuilder(inventory: { quantity: number } | null) {
    inventoryRepo.createQueryBuilder.mockReturnValue({
      setLock: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      getOne: jest.fn().mockResolvedValue(inventory),
    });
  }
  // Convenience wrapper for createOrder() tests: wires up the locked
  // pharmacy read, locked product read, and the separate inventory lookup
  // it now does instead of relying on PharmacyProduct.inventory.
  function mockCreateOrderFixtures(
    pharmacy: Pharmacy,
    products: PharmacyProduct[],
    inventories: Array<{ productId: string; quantity: number }>,
  ) {
    mockPharmacyQueryBuilder(pharmacy);
    mockProductQueryBuilder(products);
    inventoryRepo.find.mockResolvedValue(inventories);
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
      create: jest.fn((x) => x),
      // Same reasoning as orderRepo.update below — default to "1 row
      // updated" so saveProfile()'s targeted updates succeed unless a test
      // deliberately simulates a lost race with affected: 0.
      update: jest.fn().mockResolvedValue({ affected: 1 }),
      createQueryBuilder: jest.fn(),
    };
    staffRepo = {
      findOne: jest.fn(),
      find: jest.fn().mockResolvedValue([]),
      save: jest.fn((x) => Promise.resolve({ id: "staff-1", ...x })),
      create: jest.fn((x) => x),
      count: jest.fn(),
    };
    hoursRepo = {
      find: jest.fn().mockResolvedValue([]),
      upsert: jest.fn().mockResolvedValue(undefined),
    };
    usersService = { findByEmail: jest.fn() };
    productRepo = {
      find: jest.fn(),
      findOneBy: jest.fn(),
      findOneOrFail: jest.fn((x) => Promise.resolve({ id: "product-1", ...x })),
      save: jest.fn((x) => Promise.resolve({ id: "product-1", ...x })),
      create: jest.fn((x) => x),
      delete: jest.fn(),
      createQueryBuilder: jest.fn(),
    };
    inventoryRepo = {
      find: jest.fn().mockResolvedValue([]),
      decrement: jest.fn().mockResolvedValue(undefined),
      increment: jest.fn().mockResolvedValue(undefined),
      upsert: jest.fn().mockResolvedValue(undefined),
      createQueryBuilder: jest.fn(),
    };
    categoryRepo = {
      findOneBy: jest.fn().mockResolvedValue({ id: "category-1" }),
    };
    orderRepo = {
      create: jest.fn((x) => x),
      save: jest.fn((x) => Promise.resolve({ id: "order-1", ...x })),
      // Real UpdateResult always has `affected` — default to "1 row
      // updated" so transition()/review()'s conditional updates succeed
      // unless a test deliberately simulates a lost race with affected: 0.
      update: jest.fn().mockResolvedValue({ affected: 1 }),
      find: jest.fn().mockResolvedValue([]),
      findBy: jest.fn().mockResolvedValue([]),
      findOneBy: jest.fn(),
      findOneOrFail: jest.fn().mockResolvedValue({ id: "order-1" }),
      createQueryBuilder: jest.fn(),
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
      delete: jest.fn().mockResolvedValue({ affected: 1 }),
      createQueryBuilder: jest.fn(),
    };
    reviewRepo = {
      save: jest.fn((x) => Promise.resolve(x)),
      create: jest.fn((x) => x),
      find: jest.fn().mockResolvedValue([]),
      findOne: jest.fn(),
      createQueryBuilder: jest.fn(),
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
      deletePrivate: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PharmaciesService,
        { provide: getRepositoryToken(Pharmacy), useValue: pharmacyRepo },
        { provide: getRepositoryToken(PharmacyStaff), useValue: staffRepo },
        {
          provide: getRepositoryToken(PharmacyOpeningHours),
          useValue: hoursRepo,
        },
        {
          provide: getRepositoryToken(PharmacyProduct),
          useValue: productRepo,
        },
        {
          provide: getRepositoryToken(PharmacyInventory),
          useValue: inventoryRepo,
        },
        {
          provide: getRepositoryToken(PharmacyProductCategory),
          useValue: categoryRepo,
        },
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
      mockCreateOrderFixtures(
        approvedPharmacy(),
        [product()],
        [{ productId: "product-1", quantity: 5 }],
      );

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
      mockCreateOrderFixtures(
        approvedPharmacy(),
        [product()],
        [{ productId: "product-1", quantity: 4 }],
      );

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

    it("rejects duplicate lines that together exceed the 100-unit cap, even though each line is within CartItemDto's own limit", async () => {
      // CartItemDto's @Max(100) validates each line independently — two
      // lines of 60 each both pass DTO validation, but aggregate to 120 for
      // the same product, which must still be rejected here. This check
      // runs before any repo reads, so no fixtures are needed.
      await expect(
        service.createOrder("user-1", {
          pharmacyId: "pharmacy-1",
          fulfillmentMethod: FulfillmentMethod.PICKUP,
          items: [
            { productId: "product-1", quantity: 60 },
            { productId: "product-1", quantity: 60 },
          ],
        } as any),
      ).rejects.toThrow(BadRequestException);
      expect(orderRepo.save).not.toHaveBeenCalled();
      expect(inventoryRepo.decrement).not.toHaveBeenCalled();
    });

    it("refuses to check out against a pharmacy that is no longer approved", async () => {
      // Locked and re-read inside the transaction — this is the TOCTOU fix
      // itself: an admin suspension landing between dispatch and the
      // transaction's own lock must still be honored.
      mockCreateOrderFixtures(
        approvedPharmacy({ status: PharmacyStatus.SUSPENDED }),
        [product()],
        [{ productId: "product-1", quantity: 5 }],
      );

      await expect(
        service.createOrder("user-1", {
          pharmacyId: "pharmacy-1",
          fulfillmentMethod: FulfillmentMethod.PICKUP,
          items: [{ productId: "product-1", quantity: 1 }],
        } as any),
      ).rejects.toThrow(BadRequestException);
      expect(orderRepo.save).not.toHaveBeenCalled();
    });

    it("requires a prescription when the locked product row says it's required, even if the cart didn't know that", async () => {
      // The locked re-read is what actually decides `requires` — this
      // simulates staff having flipped prescriptionRequired on between the
      // cart being built and checkout running.
      mockCreateOrderFixtures(
        approvedPharmacy(),
        [product({ prescriptionRequired: true })],
        [{ productId: "product-1", quantity: 1 }],
      );

      await expect(
        service.createOrder("user-1", {
          pharmacyId: "pharmacy-1",
          fulfillmentMethod: FulfillmentMethod.PICKUP,
          items: [{ productId: "product-1", quantity: 1 }],
        } as any),
      ).rejects.toThrow(BadRequestException);
      expect(orderRepo.save).not.toHaveBeenCalled();
    });

    it("rejects a cart referencing a product that's no longer visible", async () => {
      // The locked product query filters on isVisible = true, so a product
      // hidden after the cart was built simply isn't returned — length
      // mismatch against the requested ids is what's actually asserted.
      mockCreateOrderFixtures(approvedPharmacy(), [], []);

      await expect(
        service.createOrder("user-1", {
          pharmacyId: "pharmacy-1",
          fulfillmentMethod: FulfillmentMethod.PICKUP,
          items: [{ productId: "product-1", quantity: 1 }],
        } as any),
      ).rejects.toThrow(BadRequestException);
      expect(orderRepo.save).not.toHaveBeenCalled();
    });

    it("validates prescription ownership before writing anything", async () => {
      mockCreateOrderFixtures(
        approvedPharmacy(),
        [product({ prescriptionRequired: true })],
        [{ productId: "product-1", quantity: 1 }],
      );
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
      mockCreateOrderFixtures(
        approvedPharmacy(),
        [product({ prescriptionRequired: true })],
        [{ productId: "product-1", quantity: 1 }],
      );
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
      mockCreateOrderFixtures(
        approvedPharmacy(),
        [product({ prescriptionRequired: true })],
        [{ productId: "product-1", quantity: 1 }],
      );
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
      mockCreateOrderFixtures(
        approvedPharmacy(),
        [product()],
        [{ productId: "product-1", quantity: 5 }],
      );

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

    it("refuses a decision made against a prescription version that's since changed", async () => {
      // The pharmacist opened the file, the customer resubmitted (bumping
      // the version), and only then did the pharmacist click Accept —
      // still holding the stale version their dashboard last loaded.
      staffRepo.findOne.mockResolvedValue({
        role: PharmacyStaffRole.PHARMACIST,
      });
      prescriptionRepo.findOne.mockResolvedValue({
        id: "rx-1",
        orderId: "order-1",
        version: 2,
      });

      await expect(
        service.review("user-1", "pharmacy-1", "rx-1", {
          decision: PrescriptionDecision.ACCEPTED,
          prescriptionVersion: 1,
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
        version: 1,
      });
      orderRepo.findOneBy.mockResolvedValue({
        id: "order-1",
        status: PharmacyOrderStatus.UNDER_REVIEW,
      });
      // The order row is now locked and rechecked *before* the review row
      // is saved, ahead of either branch — see the dedicated lock-ordering
      // test below for the race this closes.
      mockOrderQueryBuilder({ status: PharmacyOrderStatus.UNDER_REVIEW });
      mockPrescriptionVersionLock(1);
      orderItemRepo.find.mockResolvedValue([
        { productId: "product-1", quantity: 2 },
      ]);

      await service.review("user-1", "pharmacy-1", "rx-1", {
        decision: PrescriptionDecision.REJECTED,
        prescriptionVersion: 1,
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
        version: 1,
      });
      orderRepo.findOneBy.mockResolvedValue({
        id: "order-1",
        status: PharmacyOrderStatus.UNDER_REVIEW,
      });
      mockOrderQueryBuilder({ status: PharmacyOrderStatus.UNDER_REVIEW });
      mockPrescriptionVersionLock(1);

      await service.review("user-1", "pharmacy-1", "rx-1", {
        decision: PrescriptionDecision.ACCEPTED,
        prescriptionVersion: 1,
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
      // ...but the row lock taken *before* the review is even saved finds
      // the order no longer under_review (a genuinely concurrent second
      // decision landed first) — the whole decision (including the review
      // row, since it's never even reached) is refused rather than
      // silently recording a contradictory review beside the winning one.
      mockOrderQueryBuilder({ status: PharmacyOrderStatus.ACCEPTED });

      await expect(
        service.review("user-1", "pharmacy-1", "rx-1", {
          decision: PrescriptionDecision.REJECTED,
        } as any),
      ).rejects.toThrow(ConflictException);

      expect(reviewRepo.save).not.toHaveBeenCalled();
      expect(inventoryRepo.increment).not.toHaveBeenCalled();
    });

    it("locks the order before saving the review — not after — so a resubmission can't win the race in between", async () => {
      // Regression test for the inverse-lock-ordering bug: review() used to
      // save the review row *before* locking the order (the terminal
      // branch's conditional UPDATE, or the clarification branch's own
      // lock, both ran afterward). resubmitPrescription() locks the order
      // first. If review() didn't also lock first, a resubmission could
      // win the order lock, see review()'s insert as still uncommitted (so
      // the prescription still reads as clarification_requested), replace
      // the file, and commit — all before review()'s own order UPDATE
      // ever ran. Asserting the call order here pins down that the lock
      // now happens first, regardless of decision type.
      staffRepo.findOne.mockResolvedValue({
        role: PharmacyStaffRole.PHARMACIST,
      });
      prescriptionRepo.findOne.mockResolvedValue({
        id: "rx-1",
        orderId: "order-1",
        version: 1,
      });
      orderRepo.findOneBy.mockResolvedValue({
        id: "order-1",
        status: PharmacyOrderStatus.UNDER_REVIEW,
      });
      const calls: string[] = [];
      const builder = mockOrderQueryBuilder({
        status: PharmacyOrderStatus.UNDER_REVIEW,
      });
      builder.getOne.mockImplementation(() => {
        calls.push("lock");
        return Promise.resolve({ status: PharmacyOrderStatus.UNDER_REVIEW });
      });
      mockPrescriptionVersionLock(1);
      reviewRepo.save.mockImplementation((x: any) => {
        calls.push("save");
        return Promise.resolve(x);
      });

      await service.review("user-1", "pharmacy-1", "rx-1", {
        decision: PrescriptionDecision.ACCEPTED,
        prescriptionVersion: 1,
      } as any);

      expect(calls).toEqual(["lock", "save"]);
    });

    it("records a clarification request without moving the order", async () => {
      staffRepo.findOne.mockResolvedValue({
        role: PharmacyStaffRole.PHARMACIST,
      });
      prescriptionRepo.findOne.mockResolvedValue({
        id: "rx-1",
        orderId: "order-1",
        version: 1,
      });
      orderRepo.findOneBy.mockResolvedValue({
        id: "order-1",
        status: PharmacyOrderStatus.UNDER_REVIEW,
      });
      // The order is still under_review by the time the clarification
      // branch's row-locked recheck runs.
      mockOrderQueryBuilder({ status: PharmacyOrderStatus.UNDER_REVIEW });
      mockPrescriptionVersionLock(1);

      await service.review("user-1", "pharmacy-1", "rx-1", {
        decision: PrescriptionDecision.CLARIFICATION_REQUESTED,
        prescriptionVersion: 1,
      } as any);

      expect(reviewRepo.save).toHaveBeenCalled();
      expect(orderRepo.update).not.toHaveBeenCalled();
    });

    it("refuses a clarification request when a concurrent terminal decision already moved the order", async () => {
      staffRepo.findOne.mockResolvedValue({
        role: PharmacyStaffRole.PHARMACIST,
      });
      prescriptionRepo.findOne.mockResolvedValue({
        id: "rx-1",
        orderId: "order-1",
      });
      // The preliminary check (sequential case) still passes...
      orderRepo.findOneBy.mockResolvedValue({
        id: "order-1",
        status: PharmacyOrderStatus.UNDER_REVIEW,
      });
      // ...but a genuinely concurrent accept/reject committed first, so the
      // clarification branch's row-locked recheck finds the order has
      // already left under_review.
      mockOrderQueryBuilder({ status: PharmacyOrderStatus.ACCEPTED });

      await expect(
        service.review("user-1", "pharmacy-1", "rx-1", {
          decision: PrescriptionDecision.CLARIFICATION_REQUESTED,
        } as any),
      ).rejects.toThrow(ConflictException);
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
        { id: "rx-1", orderId: "order-1", version: 3 },
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
          // ReviewForm resubmits this with its decision; review() rejects
          // a stale one — see the dedicated version-mismatch test above.
          prescriptionVersion: 3,
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

    it("surfaces the latest review decision/notes for an order with a clarification request", async () => {
      orderRepo.find.mockResolvedValue([
        { id: "order-1", status: PharmacyOrderStatus.UNDER_REVIEW },
      ]);
      prescriptionRepo.find.mockResolvedValue([
        { id: "rx-1", orderId: "order-1" },
      ]);
      // Newest first — matches the service's own `order: { createdAt: "DESC" }`.
      reviewRepo.find.mockResolvedValue([
        {
          id: "review-2",
          prescriptionId: "rx-1",
          decision: PrescriptionDecision.CLARIFICATION_REQUESTED,
          notes: "Please confirm the dosage",
          createdAt: new Date("2026-01-02"),
        },
        {
          id: "review-1",
          prescriptionId: "rx-1",
          decision: PrescriptionDecision.CLARIFICATION_REQUESTED,
          notes: "older note",
          createdAt: new Date("2026-01-01"),
        },
      ]);

      const orders = await service.customerOrders("customer-1");

      expect(orders).toEqual([
        expect.objectContaining({
          id: "order-1",
          prescriptionId: "rx-1",
          latestReviewDecision: PrescriptionDecision.CLARIFICATION_REQUESTED,
          latestReviewNotes: "Please confirm the dosage",
        }),
      ]);
    });

    it("withholds notes from a terminal (accepted/rejected) decision", async () => {
      // Only a clarification_requested decision is ever meant to be shown
      // to the customer — a pharmacist's accept/reject notes may carry
      // internal clinical/operational rationale never meant for them.
      orderRepo.find.mockResolvedValue([
        { id: "order-1", status: PharmacyOrderStatus.ACCEPTED },
      ]);
      prescriptionRepo.find.mockResolvedValue([
        { id: "rx-1", orderId: "order-1" },
      ]);
      reviewRepo.find.mockResolvedValue([
        {
          id: "review-1",
          prescriptionId: "rx-1",
          decision: PrescriptionDecision.ACCEPTED,
          notes: "internal-only rationale",
          createdAt: new Date("2026-01-01"),
        },
      ]);

      const orders = await service.customerOrders("customer-1");

      expect(orders).toEqual([
        expect.objectContaining({
          id: "order-1",
          latestReviewDecision: PrescriptionDecision.ACCEPTED,
          latestReviewNotes: null,
        }),
      ]);
    });
  });

  describe("resubmitPrescription", () => {
    it("lets a customer replace their prescription after a clarification request", async () => {
      orderRepo.findOneBy.mockResolvedValue({
        id: "order-1",
        pharmacyId: "pharmacy-1",
        status: PharmacyOrderStatus.UNDER_REVIEW,
      });
      prescriptionRepo.findOne.mockResolvedValue({
        id: "rx-1",
        orderId: "order-1",
        privateStorageKey: "prescriptions/old-key.jpg",
      });
      reviewRepo.findOne.mockResolvedValue({
        decision: PrescriptionDecision.CLARIFICATION_REQUESTED,
      });
      mockOrderQueryBuilder({ status: PharmacyOrderStatus.UNDER_REVIEW });
      mockReviewQueryBuilder({
        decision: PrescriptionDecision.CLARIFICATION_REQUESTED,
      });
      mockPrescriptionQueryBuilder("prescriptions/old-key.jpg");
      storageProvider.savePrivate.mockResolvedValue({
        key: "prescriptions/new-key.jpg",
      });

      await service.resubmitPrescription("user-1", "order-1", {
        buffer: Buffer.from("fake-bytes"),
        originalName: "script2.jpg",
        mimeType: "image/jpeg",
      });

      expect(prescriptionRepo.update).toHaveBeenCalledWith(
        { id: "rx-1" },
        expect.objectContaining({
          privateStorageKey: "prescriptions/new-key.jpg",
        }),
      );
      // The file the pharmacist's clarification request was about is now
      // orphaned — nothing references it anymore — so it must be cleaned
      // up once the replacement is safely committed.
      expect(storageProvider.deletePrivate).toHaveBeenCalledWith(
        "prescriptions/old-key.jpg",
      );
    });

    it("deletes the key actually superseded under the lock, not a stale pre-transaction read", async () => {
      // Regression test: two resubmissions racing each other both
      // serialize on the order lock, but a *pre-transaction* read of the
      // old key is stale by the time the second one gets here — the first
      // resubmission already overwrote it with its own new key. The key
      // to delete must come from the locked, in-transaction read.
      orderRepo.findOneBy.mockResolvedValue({
        id: "order-1",
        pharmacyId: "pharmacy-1",
        status: PharmacyOrderStatus.UNDER_REVIEW,
      });
      prescriptionRepo.findOne.mockResolvedValue({
        id: "rx-1",
        orderId: "order-1",
        // Stale — a concurrent resubmission (already committed by the
        // time this one reaches the lock) has since replaced this key.
        privateStorageKey: "prescriptions/original-key.jpg",
      });
      reviewRepo.findOne.mockResolvedValue({
        decision: PrescriptionDecision.CLARIFICATION_REQUESTED,
      });
      mockOrderQueryBuilder({ status: PharmacyOrderStatus.UNDER_REVIEW });
      mockReviewQueryBuilder({
        decision: PrescriptionDecision.CLARIFICATION_REQUESTED,
      });
      // What's actually stored right now, read fresh under the lock.
      mockPrescriptionQueryBuilder("prescriptions/first-resubmission-key.jpg");
      storageProvider.savePrivate.mockResolvedValue({
        key: "prescriptions/second-resubmission-key.jpg",
      });

      await service.resubmitPrescription("user-1", "order-1", {
        buffer: Buffer.from("fake-bytes"),
        originalName: "script3.jpg",
        mimeType: "image/jpeg",
      });

      expect(storageProvider.deletePrivate).toHaveBeenCalledWith(
        "prescriptions/first-resubmission-key.jpg",
      );
      expect(storageProvider.deletePrivate).not.toHaveBeenCalledWith(
        "prescriptions/original-key.jpg",
      );
    });

    it("refuses the replacement — and cleans up the newly uploaded file — when a pharmacist decided between the initial check and the locked recheck", async () => {
      orderRepo.findOneBy.mockResolvedValue({
        id: "order-1",
        pharmacyId: "pharmacy-1",
        status: PharmacyOrderStatus.UNDER_REVIEW,
      });
      prescriptionRepo.findOne.mockResolvedValue({
        id: "rx-1",
        orderId: "order-1",
        privateStorageKey: "prescriptions/old-key.jpg",
      });
      reviewRepo.findOne.mockResolvedValue({
        decision: PrescriptionDecision.CLARIFICATION_REQUESTED,
      });
      // The locked recheck sees what the initial (unlocked) read couldn't:
      // a pharmacist accepted this order in between.
      mockOrderQueryBuilder({ status: PharmacyOrderStatus.ACCEPTED });
      mockReviewQueryBuilder({
        decision: PrescriptionDecision.CLARIFICATION_REQUESTED,
      });
      storageProvider.savePrivate.mockResolvedValue({
        key: "prescriptions/new-key.jpg",
      });

      await expect(
        service.resubmitPrescription("user-1", "order-1", {
          buffer: Buffer.from("fake-bytes"),
          originalName: "script2.jpg",
          mimeType: "image/jpeg",
        }),
      ).rejects.toThrow(ConflictException);

      expect(prescriptionRepo.update).not.toHaveBeenCalled();
      // The already-uploaded replacement must not be left dangling once
      // the write it was for is refused.
      expect(storageProvider.deletePrivate).toHaveBeenCalledWith(
        "prescriptions/new-key.jpg",
      );
      // ...and the file the (still-current) clarification request was
      // about must be left alone — it was never replaced.
      expect(storageProvider.deletePrivate).not.toHaveBeenCalledWith(
        "prescriptions/old-key.jpg",
      );
    });

    it("refuses to resubmit when no clarification was ever requested", async () => {
      orderRepo.findOneBy.mockResolvedValue({
        id: "order-1",
        pharmacyId: "pharmacy-1",
        status: PharmacyOrderStatus.UNDER_REVIEW,
      });
      prescriptionRepo.findOne.mockResolvedValue({
        id: "rx-1",
        orderId: "order-1",
      });
      reviewRepo.findOne.mockResolvedValue(null);

      await expect(
        service.resubmitPrescription("user-1", "order-1", {
          buffer: Buffer.from("fake-bytes"),
          originalName: "script2.jpg",
          mimeType: "image/jpeg",
        }),
      ).rejects.toThrow(ConflictException);
      expect(prescriptionRepo.update).not.toHaveBeenCalled();
    });

    it("refuses to resubmit once the order has left under_review", async () => {
      orderRepo.findOneBy.mockResolvedValue({
        id: "order-1",
        pharmacyId: "pharmacy-1",
        status: PharmacyOrderStatus.ACCEPTED,
      });

      await expect(
        service.resubmitPrescription("user-1", "order-1", {
          buffer: Buffer.from("fake-bytes"),
          originalName: "script2.jpg",
          mimeType: "image/jpeg",
        }),
      ).rejects.toThrow(ConflictException);
      expect(prescriptionRepo.update).not.toHaveBeenCalled();
    });
  });

  describe("removeProduct", () => {
    it("commits the delete and its audit entry together", async () => {
      staffRepo.findOne.mockResolvedValue({ role: PharmacyStaffRole.MANAGER });
      productRepo.delete.mockResolvedValue({ affected: 1 });

      await service.removeProduct("user-1", "pharmacy-1", "product-1");

      expect(productRepo.delete).toHaveBeenCalledWith({
        id: "product-1",
        pharmacyId: "pharmacy-1",
      });
      expect(auditRepo.save).toHaveBeenCalled();
    });

    it("404s without auditing when the product doesn't belong to this pharmacy", async () => {
      staffRepo.findOne.mockResolvedValue({ role: PharmacyStaffRole.MANAGER });
      productRepo.delete.mockResolvedValue({ affected: 0 });

      await expect(
        service.removeProduct("user-1", "pharmacy-1", "product-1"),
      ).rejects.toThrow(NotFoundException);
      expect(auditRepo.save).not.toHaveBeenCalled();
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

  describe("myProducts", () => {
    it("includes hidden products, unlike the public catalog", async () => {
      staffRepo.findOne.mockResolvedValue({ role: PharmacyStaffRole.MANAGER });
      productRepo.find.mockResolvedValue([
        product({ isVisible: true }),
        product({ id: "product-2", isVisible: false }),
      ]);

      const items = await service.myProducts("user-1", "pharmacy-1");

      expect(items).toHaveLength(2);
      expect(productRepo.find).toHaveBeenCalledWith(
        expect.objectContaining({ where: { pharmacyId: "pharmacy-1" } }),
      );
    });

    it("refuses a caller who isn't staff at this pharmacy", async () => {
      staffRepo.findOne.mockResolvedValue(null);

      await expect(service.myProducts("user-1", "pharmacy-1")).rejects.toThrow(
        ForbiddenException,
      );
      expect(productRepo.find).not.toHaveBeenCalled();
    });
  });

  describe("mine", () => {
    it("opts back into the licence number so staff can see and correct it in ProfileForm", async () => {
      staffRepo.find.mockResolvedValue([
        { pharmacyId: "pharmacy-1", active: true },
      ]);
      const builder = {
        addSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        getMany: jest
          .fn()
          .mockResolvedValue([{ id: "pharmacy-1", licenceNumber: "LR-1" }]),
      };
      pharmacyRepo.createQueryBuilder.mockReturnValue(builder);

      const result = await service.mine("user-1");

      expect(builder.addSelect).toHaveBeenCalledWith("p.licenceNumber");
      expect(result).toEqual([{ id: "pharmacy-1", licenceNumber: "LR-1" }]);
    });

    it("returns an empty list without querying pharmacies when the caller has no active memberships", async () => {
      staffRepo.find.mockResolvedValue([]);

      const result = await service.mine("user-1");

      expect(result).toEqual([]);
      expect(pharmacyRepo.createQueryBuilder).not.toHaveBeenCalled();
    });
  });

  describe("stats", () => {
    it("surfaces the caller's own staff role so the frontend can gate pharmacist-only controls", async () => {
      staffRepo.findOne.mockResolvedValue({ role: PharmacyStaffRole.EMPLOYEE });
      orderRepo.findBy.mockResolvedValue([]);

      const result = await service.stats("user-1", "pharmacy-1");

      expect(result.role).toBe(PharmacyStaffRole.EMPLOYEE);
    });
  });

  describe("saveOpeningHours / getOpeningHours", () => {
    it("upserts one row per submitted day, keyed on (pharmacyId, dayOfWeek)", async () => {
      staffRepo.findOne.mockResolvedValue({ role: PharmacyStaffRole.EMPLOYEE });

      await service.saveOpeningHours("user-1", "pharmacy-1", {
        hours: [
          {
            dayOfWeek: 1,
            opensAt: "08:00",
            closesAt: "20:00",
            isClosed: false,
          },
          { dayOfWeek: 0, opensAt: null, closesAt: null, isClosed: true },
        ],
      } as any);

      expect(hoursRepo.upsert).toHaveBeenCalledWith(
        [
          {
            pharmacyId: "pharmacy-1",
            dayOfWeek: 1,
            opensAt: "08:00",
            closesAt: "20:00",
            isClosed: false,
          },
          {
            pharmacyId: "pharmacy-1",
            dayOfWeek: 0,
            opensAt: null,
            closesAt: null,
            isClosed: true,
          },
        ],
        ["pharmacyId", "dayOfWeek"],
      );
    });

    it("discards stale opens/closes times for a day marked closed, even if the caller still sent them", async () => {
      staffRepo.findOne.mockResolvedValue({ role: PharmacyStaffRole.EMPLOYEE });

      await service.saveOpeningHours("user-1", "pharmacy-1", {
        hours: [
          { dayOfWeek: 0, opensAt: "08:00", closesAt: "20:00", isClosed: true },
        ],
      } as any);

      expect(hoursRepo.upsert).toHaveBeenCalledWith(
        [
          {
            pharmacyId: "pharmacy-1",
            dayOfWeek: 0,
            opensAt: null,
            closesAt: null,
            isClosed: true,
          },
        ],
        ["pharmacyId", "dayOfWeek"],
      );
    });

    it("refuses a caller who isn't staff at this pharmacy", async () => {
      staffRepo.findOne.mockResolvedValue(null);

      await expect(
        service.saveOpeningHours("user-1", "pharmacy-1", {
          hours: [],
        } as any),
      ).rejects.toThrow(ForbiddenException);
      expect(hoursRepo.upsert).not.toHaveBeenCalled();
    });

    it("rejects two entries for the same day before reaching the upsert", async () => {
      // Postgres's ON CONFLICT DO UPDATE refuses to touch the same row
      // twice in one statement — without this check, a duplicate dayOfWeek
      // in the submitted array would surface as a raw 500 instead of 400.
      staffRepo.findOne.mockResolvedValue({ role: PharmacyStaffRole.EMPLOYEE });

      await expect(
        service.saveOpeningHours("user-1", "pharmacy-1", {
          hours: [
            {
              dayOfWeek: 2,
              opensAt: "08:00",
              closesAt: "20:00",
              isClosed: false,
            },
            {
              dayOfWeek: 2,
              opensAt: "09:00",
              closesAt: "17:00",
              isClosed: false,
            },
          ],
        } as any),
      ).rejects.toThrow(BadRequestException);
      expect(hoursRepo.upsert).not.toHaveBeenCalled();
    });

    it("lets any staff role (not just manager) read the pharmacy's current hours", async () => {
      staffRepo.findOne.mockResolvedValue({
        role: PharmacyStaffRole.PHARMACIST,
      });
      hoursRepo.find.mockResolvedValue([
        { dayOfWeek: 0, opensAt: "08:00", closesAt: "20:00", isClosed: false },
      ]);

      const result = await service.getOpeningHours("user-1", "pharmacy-1");

      expect(result).toHaveLength(1);
    });
  });

  describe("saveProduct", () => {
    beforeEach(() => {
      staffRepo.findOne.mockResolvedValue({ role: PharmacyStaffRole.MANAGER });
    });

    it("sets stock as an absolute value for a new product — there is no prior stock to race against", async () => {
      await service.saveProduct("user-1", "pharmacy-1", undefined, {
        name: "New Product",
        categoryId: "category-1",
        price: 10,
        stockQuantity: 20,
        prescriptionRequired: false,
      } as any);

      expect(inventoryRepo.createQueryBuilder).not.toHaveBeenCalled();
      expect(inventoryRepo.upsert).toHaveBeenCalledWith(
        { productId: "product-1", quantity: 20 },
        ["productId"],
      );
    });

    it("applies an edit as a delta off the currently stored quantity, not the value the edit form loaded", async () => {
      productRepo.findOneBy.mockResolvedValue({
        id: "product-1",
        pharmacyId: "pharmacy-1",
        name: "Paracetamol",
      });
      // The form loaded 10 in stock and the staff member reduced it to 8 (a
      // delta of -2) — but a customer's concurrent checkout has already
      // brought the real count down to 7 while the form sat open.
      mockInventoryQueryBuilder({ quantity: 7 });

      await service.saveProduct("user-1", "pharmacy-1", "product-1", {
        name: "Paracetamol",
        categoryId: "category-1",
        price: 10,
        stockQuantity: 8,
        previousStockQuantity: 10,
        prescriptionRequired: false,
      } as any);

      expect(inventoryRepo.upsert).toHaveBeenCalledWith(
        { productId: "product-1", quantity: 5 },
        ["productId"],
      );
    });

    it("never lets a delta take stock negative", async () => {
      productRepo.findOneBy.mockResolvedValue({
        id: "product-1",
        pharmacyId: "pharmacy-1",
        name: "Paracetamol",
      });
      mockInventoryQueryBuilder({ quantity: 2 });

      await service.saveProduct("user-1", "pharmacy-1", "product-1", {
        name: "Paracetamol",
        categoryId: "category-1",
        price: 10,
        stockQuantity: 0,
        previousStockQuantity: 10,
        prescriptionRequired: false,
      } as any);

      expect(inventoryRepo.upsert).toHaveBeenCalledWith(
        { productId: "product-1", quantity: 0 },
        ["productId"],
      );
    });

    it("leaves stock untouched when the edit omits previousStockQuantity", async () => {
      productRepo.findOneBy.mockResolvedValue({
        id: "product-1",
        pharmacyId: "pharmacy-1",
        name: "Paracetamol",
      });

      await service.saveProduct("user-1", "pharmacy-1", "product-1", {
        name: "Paracetamol (renamed)",
        categoryId: "category-1",
        price: 10,
        stockQuantity: 999,
        prescriptionRequired: false,
      } as any);

      expect(inventoryRepo.createQueryBuilder).not.toHaveBeenCalled();
      expect(inventoryRepo.upsert).not.toHaveBeenCalled();
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

    it("deletes the object it just wrote to storage when the row+audit write fails, instead of leaving it orphaned", async () => {
      pharmacyRepo.findOneBy.mockResolvedValue(approvedPharmacy());
      storageProvider.savePrivate.mockResolvedValue({
        key: "prescriptions/abc123.jpg",
      });
      prescriptionRepo.save.mockRejectedValue(new Error("db down"));

      await expect(
        service.uploadPrescription("user-1", "pharmacy-1", {
          buffer: Buffer.from("fake-bytes"),
          originalName: "script.jpg",
          mimeType: "image/jpeg",
        }),
      ).rejects.toThrow("db down");

      expect(storageProvider.deletePrivate).toHaveBeenCalledWith(
        "prescriptions/abc123.jpg",
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

  describe("deleteUnattachedPrescription", () => {
    it("deletes the row and its storage object for the uploader's own unattached prescription", async () => {
      prescriptionRepo.createQueryBuilder.mockReturnValue({
        addSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue({
          id: "rx-1",
          customerUserId: "user-1",
          orderId: null,
          privateStorageKey: "prescriptions/abc123.jpg",
        }),
      });
      prescriptionRepo.delete.mockResolvedValue({ affected: 1 });

      await service.deleteUnattachedPrescription("user-1", "rx-1");

      expect(prescriptionRepo.delete).toHaveBeenCalledWith({
        id: "rx-1",
        customerUserId: "user-1",
        orderId: IsNull(),
      });
      expect(storageProvider.deletePrivate).toHaveBeenCalledWith(
        "prescriptions/abc123.jpg",
      );
    });

    it("refuses to delete a prescription already attached to an order", async () => {
      prescriptionRepo.createQueryBuilder.mockReturnValue({
        addSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue({
          id: "rx-1",
          customerUserId: "user-1",
          orderId: "order-1",
          privateStorageKey: "prescriptions/abc123.jpg",
        }),
      });

      await expect(
        service.deleteUnattachedPrescription("user-1", "rx-1"),
      ).rejects.toThrow(ConflictException);
      expect(prescriptionRepo.delete).not.toHaveBeenCalled();
      expect(storageProvider.deletePrivate).not.toHaveBeenCalled();
    });

    it("refuses a caller who doesn't own the prescription", async () => {
      // The query itself is scoped to customerUserId, so someone else's
      // prescription (or a nonexistent id) simply comes back as no row.
      prescriptionRepo.createQueryBuilder.mockReturnValue({
        addSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue(null),
      });

      await expect(
        service.deleteUnattachedPrescription("user-1", "rx-1"),
      ).rejects.toThrow(NotFoundException);
      expect(prescriptionRepo.delete).not.toHaveBeenCalled();
    });

    it("no-ops the storage cleanup when a concurrent checkout already claimed the prescription", async () => {
      prescriptionRepo.createQueryBuilder.mockReturnValue({
        addSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue({
          id: "rx-1",
          customerUserId: "user-1",
          orderId: null,
          privateStorageKey: "prescriptions/abc123.jpg",
        }),
      });
      prescriptionRepo.delete.mockResolvedValue({ affected: 0 });

      await service.deleteUnattachedPrescription("user-1", "rx-1");

      expect(storageProvider.deletePrivate).not.toHaveBeenCalled();
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
      const builder = mockPharmacyQueryBuilder({
        id: "pharmacy-1",
        licenceNumber: "LR-PHM-0042",
      });

      const result = await service.verification("admin-1", "pharmacy-1", {
        decision: PharmacyStatus.APPROVED,
      } as any);

      // Only the status column is written — never a full save() of the
      // locked-and-read entity, which would clobber any profile field
      // staff changed concurrently.
      expect(pharmacyRepo.update).toHaveBeenCalledWith(
        { id: "pharmacy-1" },
        { status: PharmacyStatus.APPROVED },
      );
      expect(pharmacyRepo.save).not.toHaveBeenCalled();
      expect(builder.setLock).toHaveBeenCalledWith("pessimistic_write");
      expect(result.status).toBe(PharmacyStatus.APPROVED);
    });

    it("does not require a licence number to reject or suspend", async () => {
      mockPharmacyQueryBuilder({ id: "pharmacy-1", licenceNumber: null });

      await service.verification("admin-1", "pharmacy-1", {
        decision: PharmacyStatus.REJECTED,
      } as any);

      expect(pharmacyRepo.update).toHaveBeenCalledWith(
        { id: "pharmacy-1" },
        { status: PharmacyStatus.REJECTED },
      );
      expect(pharmacyRepo.save).not.toHaveBeenCalled();
    });
  });

  describe("saveProfile", () => {
    it("sends an approved pharmacy back to pending when its licence number changes", async () => {
      staffRepo.findOne.mockResolvedValue({ role: PharmacyStaffRole.MANAGER });
      const builder = mockPharmacyQueryBuilder({
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
      // The update path must never save() the full stale entity — that
      // would silently overwrite a status changed concurrently by an
      // admin. Only the targeted update() calls should run.
      expect(pharmacyRepo.save).not.toHaveBeenCalled();
      expect(pharmacyRepo.update).toHaveBeenCalledWith(
        { id: "pharmacy-1", status: PharmacyStatus.APPROVED },
        { status: PharmacyStatus.PENDING },
      );
      // The status/licenceNumber this decision is based on must be read
      // (and locked) inside the transaction, not before it — a read taken
      // beforehand could miss a concurrent admin approval/rejection. See
      // the dedicated TOCTOU test below for the read-timing race itself;
      // this asserts the locking mechanism is actually requested.
      expect(builder.setLock).toHaveBeenCalledWith("pessimistic_write");
    });

    it("does not fabricate a pending status when a concurrent admin action already moved the pharmacy off approved", async () => {
      // Simulates the TOCTOU race this fix closes: the pharmacy was read as
      // APPROVED above, but an admin suspended it in between — the
      // conditional update's row lock finds `status = approved` no longer
      // matches, so this request's licence-driven reset silently loses the
      // race instead of clobbering the admin's concurrent decision back to
      // pending.
      staffRepo.findOne.mockResolvedValue({ role: PharmacyStaffRole.MANAGER });
      mockPharmacyQueryBuilder({
        id: "pharmacy-1",
        status: PharmacyStatus.APPROVED,
        licenceNumber: "LR-PHM-0042",
        slug: "existing-slug",
      });
      pharmacyRepo.update.mockImplementation((criteria: any) =>
        Promise.resolve(
          criteria.status === PharmacyStatus.APPROVED
            ? { affected: 0 } // lost the race — admin already changed status
            : { affected: 1 }, // the unconditional profile-fields patch
        ),
      );

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

      expect(saved.status).toBe(PharmacyStatus.APPROVED);
      expect(pharmacyRepo.save).not.toHaveBeenCalled();
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

    it("leaves an approved pharmacy's status and licence number untouched when the field is omitted entirely", async () => {
      // mine()/the dashboard list never return licenceNumber (select:
      // false), so a normal PATCH built from that response omits the
      // field — this must read as "unchanged", not as clearing it to null.
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
        // licenceNumber intentionally omitted
      } as any);

      expect(saved.status).toBe(PharmacyStatus.APPROVED);
      expect(saved.licenceNumber).toBe("LR-PHM-0042");
    });

    it("preserves the existing logo/cover images when a PATCH omits them", async () => {
      // Same reasoning as the licenceNumber test above: a client updating
      // unrelated fields sends a PATCH built from what mine()/the dashboard
      // list returned, which omits any image it didn't touch. Treating
      // that omission as "clear it" would erase the pharmacy's images on
      // every unrelated edit.
      staffRepo.findOne.mockResolvedValue({ role: PharmacyStaffRole.MANAGER });
      mockPharmacyQueryBuilder({
        id: "pharmacy-1",
        status: PharmacyStatus.APPROVED,
        licenceNumber: "LR-PHM-0042",
        slug: "existing-slug",
        logoUrl: "https://cdn.example.com/logo.jpg",
        coverUrl: "https://cdn.example.com/cover.jpg",
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
        // logoUrl/coverUrl intentionally omitted
      } as any);

      expect(saved.logoUrl).toBe("https://cdn.example.com/logo.jpg");
      expect(saved.coverUrl).toBe("https://cdn.example.com/cover.jpg");
      expect(pharmacyRepo.update).toHaveBeenCalledWith(
        { id: "pharmacy-1" },
        expect.not.objectContaining({
          logoUrl: expect.anything(),
          coverUrl: expect.anything(),
        }),
      );
    });

    it("updates the logo/cover images when the PATCH explicitly sends them", async () => {
      staffRepo.findOne.mockResolvedValue({ role: PharmacyStaffRole.MANAGER });
      mockPharmacyQueryBuilder({
        id: "pharmacy-1",
        status: PharmacyStatus.APPROVED,
        licenceNumber: "LR-PHM-0042",
        slug: "existing-slug",
        logoUrl: "https://cdn.example.com/old-logo.jpg",
        coverUrl: "https://cdn.example.com/old-cover.jpg",
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
        logoUrl: "https://cdn.example.com/new-logo.jpg",
        coverUrl: "https://cdn.example.com/new-cover.jpg",
      } as any);

      expect(saved.logoUrl).toBe("https://cdn.example.com/new-logo.jpg");
      expect(saved.coverUrl).toBe("https://cdn.example.com/new-cover.jpg");
      expect(pharmacyRepo.update).toHaveBeenCalledWith(
        { id: "pharmacy-1" },
        expect.objectContaining({
          logoUrl: "https://cdn.example.com/new-logo.jpg",
          coverUrl: "https://cdn.example.com/new-cover.jpg",
        }),
      );
    });

    it("clears the logo/cover/coordinates when the PATCH explicitly sends null", async () => {
      // Distinct from the "omitted" test above: an explicit null is how
      // ProfileForm represents "the user emptied this field" — it must
      // actually clear the column, not be swallowed the same way omission
      // is (the `!== undefined` check on the service side lets null
      // through while still treating undefined as "leave unchanged").
      staffRepo.findOne.mockResolvedValue({ role: PharmacyStaffRole.MANAGER });
      mockPharmacyQueryBuilder({
        id: "pharmacy-1",
        status: PharmacyStatus.APPROVED,
        licenceNumber: "LR-PHM-0042",
        slug: "existing-slug",
        logoUrl: "https://cdn.example.com/old-logo.jpg",
        coverUrl: "https://cdn.example.com/old-cover.jpg",
        latitude: 6.3,
        longitude: -10.8,
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
        logoUrl: null,
        coverUrl: null,
        latitude: null,
        longitude: null,
      } as any);

      expect(saved.logoUrl).toBeNull();
      expect(saved.coverUrl).toBeNull();
      expect(saved.latitude).toBeNull();
      expect(saved.longitude).toBeNull();
      expect(pharmacyRepo.update).toHaveBeenCalledWith(
        { id: "pharmacy-1" },
        expect.objectContaining({
          logoUrl: null,
          coverUrl: null,
          latitude: null,
          longitude: null,
        }),
      );
    });

    it("persists coordinates so an approved pharmacy can appear on PharmacyMap", async () => {
      staffRepo.findOne.mockResolvedValue({ role: PharmacyStaffRole.MANAGER });
      mockPharmacyQueryBuilder({
        id: "pharmacy-1",
        status: PharmacyStatus.APPROVED,
        licenceNumber: "LR-PHM-0042",
        slug: "existing-slug",
        latitude: null,
        longitude: null,
      });

      const saved = await service.saveProfile("user-1", "pharmacy-1", {
        name: "Test Pharmacy",
        address: "123 Main St",
        location: "Monrovia",
        telephone: "+231770000000",
        pickupEnabled: true,
        deliveryEnabled: true,
        deliveryFee: 5,
        licenceNumber: "LR-PHM-0042",
        latitude: 6.3156,
        longitude: -10.8074,
      } as any);

      expect(saved.latitude).toBe(6.3156);
      expect(saved.longitude).toBe(-10.8074);
      expect(pharmacyRepo.update).toHaveBeenCalledWith(
        { id: "pharmacy-1" },
        expect.objectContaining({ latitude: 6.3156, longitude: -10.8074 }),
      );
    });

    it("leaves coordinates untouched when the PATCH omits them", async () => {
      staffRepo.findOne.mockResolvedValue({ role: PharmacyStaffRole.MANAGER });
      mockPharmacyQueryBuilder({
        id: "pharmacy-1",
        status: PharmacyStatus.APPROVED,
        licenceNumber: "LR-PHM-0042",
        slug: "existing-slug",
        latitude: 6.3156,
        longitude: -10.8074,
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
        // latitude/longitude intentionally omitted
      } as any);

      expect(saved.latitude).toBe(6.3156);
      expect(saved.longitude).toBe(-10.8074);
    });

    it("creates the initial manager membership for a new application", async () => {
      staffRepo.save.mockResolvedValue({ id: "staff-1" });

      await service.saveProfile("user-1", undefined, {
        name: "New Pharmacy",
        address: "123 Main St",
        location: "Monrovia",
        telephone: "+231770000000",
        pickupEnabled: true,
        deliveryEnabled: true,
        deliveryFee: 5,
      } as any);

      expect(staffRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ userId: "user-1", role: "manager" }),
      );
    });
  });
});
