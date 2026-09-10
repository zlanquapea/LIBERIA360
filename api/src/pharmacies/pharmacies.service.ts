import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Brackets, In, IsNull, Repository } from "typeorm";
import { randomUUID } from "crypto";
import { extname } from "path";
import {
  STORAGE_PROVIDER,
  StorageProvider,
} from "../uploads/storage/storage-provider.interface";
import { slugify } from "../common/slugify";
import {
  AssignStaffDto,
  CreateOrderDto,
  PharmacyProfileDto,
  PharmacyQueryDto,
  PrescriptionReviewDto,
  ProductDto,
  ProductQueryDto,
  VerificationDto,
} from "./dto/pharmacy.dto";
import {
  Pharmacy,
  PharmacyOpeningHours,
  PharmacyStaff,
  PharmacyVerification,
} from "./entities/pharmacy.entity";
import {
  FulfillmentMethod,
  PharmacyOrderStatus,
  PharmacyStaffRole,
  PharmacyStatus,
  PrescriptionDecision,
} from "./entities/pharmacy.enums";
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
import { UsersService } from "../users/users.service";

// Prescription photos/scans, not just product photos — a phone camera shot
// of a paper script is the common case, but a PDF scan is common enough
// (many Liberian pharmacies' partner clinics issue printed/PDF scripts) to
// allow too. Re-encoding through processUploadedImage (like /uploads/image
// does) isn't appropriate here: a PDF isn't an image at all, and a
// prescription photo shouldn't be silently recompressed/stripped the same
// way a profile photo is.
const ALLOWED_PRESCRIPTION_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/pdf",
];
const MAX_PRESCRIPTION_FILE_SIZE_BYTES = 10 * 1024 * 1024;

const NEXT: Record<PharmacyOrderStatus, PharmacyOrderStatus[]> = {
  // Deliberately does NOT list UNDER_REVIEW: createOrder() is the only
  // place an order is ever created there (because it has a prescription
  // attached), never moved into it later. A pending order has no
  // prescription to review, so accepting this jump here would let staff
  // PATCH any ordinary order into under_review and strand it — it can
  // only leave under_review via CANCELLED (below), with no prescription
  // for review() to ever act on.
  [PharmacyOrderStatus.PENDING]: [
    PharmacyOrderStatus.ACCEPTED,
    PharmacyOrderStatus.CANCELLED,
  ],
  // Deliberately does NOT list ACCEPTED/REJECTED: an order only reaches
  // under_review because it has a prescription attached (see createOrder),
  // and that decision belongs to review() alone — the only place that
  // checks the pharmacist role and records a PrescriptionReview. Letting
  // the generic status PATCH (transition(), below) also accept this jump
  // would let any staff member approve a prescription order without ever
  // going through review, silently bypassing that whole check.
  [PharmacyOrderStatus.UNDER_REVIEW]: [PharmacyOrderStatus.CANCELLED],
  [PharmacyOrderStatus.ACCEPTED]: [
    PharmacyOrderStatus.PREPARING,
    PharmacyOrderStatus.CANCELLED,
  ],
  [PharmacyOrderStatus.PREPARING]: [
    PharmacyOrderStatus.READY_FOR_PICKUP,
    PharmacyOrderStatus.OUT_FOR_DELIVERY,
  ],
  [PharmacyOrderStatus.READY_FOR_PICKUP]: [PharmacyOrderStatus.COMPLETED],
  [PharmacyOrderStatus.OUT_FOR_DELIVERY]: [PharmacyOrderStatus.COMPLETED],
  [PharmacyOrderStatus.COMPLETED]: [],
  [PharmacyOrderStatus.REJECTED]: [],
  [PharmacyOrderStatus.CANCELLED]: [],
};

@Injectable()
export class PharmaciesService {
  constructor(
    @InjectRepository(Pharmacy) private pharmacies: Repository<Pharmacy>,
    @InjectRepository(PharmacyStaff) private staff: Repository<PharmacyStaff>,
    @InjectRepository(PharmacyOpeningHours)
    private hours: Repository<PharmacyOpeningHours>,
    @InjectRepository(PharmacyProduct)
    private products: Repository<PharmacyProduct>,
    @InjectRepository(PharmacyInventory)
    private inventory: Repository<PharmacyInventory>,
    @InjectRepository(PharmacyProductCategory)
    private categories: Repository<PharmacyProductCategory>,
    @InjectRepository(PharmacyOrder) private orders: Repository<PharmacyOrder>,
    @InjectRepository(PharmacyOrderItem)
    private orderItems: Repository<PharmacyOrderItem>,
    @InjectRepository(Prescription)
    private prescriptions: Repository<Prescription>,
    @InjectRepository(PrescriptionReview)
    private reviews: Repository<PrescriptionReview>,
    @InjectRepository(PharmacyVerification)
    private verifications: Repository<PharmacyVerification>,
    @InjectRepository(PharmacyAuditLog)
    private audits: Repository<PharmacyAuditLog>,
    @Inject(STORAGE_PROVIDER) private readonly storage: StorageProvider,
    private readonly users: UsersService,
  ) {}

  async directory(q: PharmacyQueryDto) {
    const qb = this.pharmacies
      .createQueryBuilder("p")
      .where("p.status = :approved", { approved: PharmacyStatus.APPROVED });
    if (q.search)
      qb.andWhere(
        new Brackets((x) =>
          x
            .where("p.name ILIKE :s", { s: `%${q.search}%` })
            .orWhere("p.address ILIKE :s", { s: `%${q.search}%` }),
        ),
      );
    if (q.location)
      qb.andWhere("p.location ILIKE :l", { l: `%${q.location}%` });
    if (q.delivery) qb.andWhere("p.delivery_enabled = true");
    if (q.pickup) qb.andWhere("p.pickup_enabled = true");
    if (q.openNow) {
      const day = new Date().getUTCDay(),
        time = new Date().toISOString().slice(11, 19);
      qb.innerJoin(
        PharmacyOpeningHours,
        "h",
        "h.pharmacy_id=p.id AND h.day_of_week=:day AND h.is_closed=false AND h.opens_at<=:time AND h.closes_at>:time",
        { day, time },
      );
    }
    return qb
      .orderBy("p.sponsored", "DESC")
      .addOrderBy("p.name", "ASC")
      .getMany();
  }
  async one(slug: string) {
    const pharmacy = await this.pharmacies.findOne({
      where: { slug, status: PharmacyStatus.APPROVED },
    });
    if (!pharmacy) throw new NotFoundException("Pharmacy not found");
    return {
      ...pharmacy,
      openingHours: await this.hours.find({
        where: { pharmacyId: pharmacy.id },
        order: { dayOfWeek: "ASC" },
      }),
    };
  }
  categoriesList() {
    return this.categories.find({ order: { name: "ASC" } });
  }
  async catalog(pharmacyId: string, q: ProductQueryDto) {
    // Public route (no auth) — directory() and one() already gate on
    // approved-only, but this one only checked isVisible on the product
    // itself. Without this, a pharmacy's product list and stock levels
    // stayed fetchable by anyone who already had its UUID even after it
    // was suspended, rejected, or was never approved in the first place.
    const pharmacy = await this.pharmacies.findOneBy({ id: pharmacyId });
    if (!pharmacy || pharmacy.status !== PharmacyStatus.APPROVED)
      throw new NotFoundException("Pharmacy not found");
    const where: any = { pharmacyId, isVisible: true };
    if (q.categoryId) where.categoryId = q.categoryId;
    const items = await this.products.find({
      where,
      relations: { category: true },
      order: { name: "ASC" },
    });
    return q.search
      ? items.filter((x) =>
          x.name.toLowerCase().includes(q.search!.toLowerCase()),
        )
      : items;
  }
  async assertStaff(userId: string, pharmacyId: string) {
    const member = await this.staff.findOne({
      where: { userId, pharmacyId, active: true },
    });
    if (!member)
      throw new ForbiddenException("You are not authorized for this pharmacy");
    return member;
  }
  async mine(userId: string) {
    const memberships = await this.staff.find({
      where: { userId, active: true },
    });
    return this.pharmacies.findBy({
      id: In(memberships.map((x) => x.pharmacyId)),
    });
  }
  async saveProfile(
    userId: string,
    id: string | undefined,
    dto: PharmacyProfileDto,
  ) {
    if (id) await this.assertStaff(userId, id);
    // licenceNumber is `select: false` (see verification()'s comment on the
    // same column) — a plain findOneByOrFail() would come back with it
    // `undefined`, which would make every update to an approved pharmacy
    // look like a licence change and reset it to pending. Opt back in via
    // the query builder, same as verification()/applications() do.
    const pharmacy = id
      ? await this.pharmacies
          .createQueryBuilder("p")
          .addSelect("p.licenceNumber")
          .where("p.id = :id", { id })
          .getOneOrFail()
      : this.pharmacies.create({ status: PharmacyStatus.PENDING });
    // An admin verified this exact licenceNumber (see verification()) — if
    // staff change it afterward, the pharmacy keeps showing the "approved"
    // badge for evidence nobody has actually reviewed. Any licence change
    // on an already-approved pharmacy must go back through admin review.
    const licenceChanged =
      pharmacy.status === PharmacyStatus.APPROVED &&
      (dto.licenceNumber ?? null) !== (pharmacy.licenceNumber ?? null);
    Object.assign(pharmacy, dto, {
      slug: pharmacy.slug || `${slugify(dto.name)}-${Date.now().toString(36)}`,
      ...(licenceChanged ? { status: PharmacyStatus.PENDING } : {}),
    });
    const saved = await this.pharmacies.save(pharmacy);
    if (!id)
      await this.staff.save(
        this.staff.create({
          pharmacyId: saved.id,
          userId,
          role: "manager" as any,
          active: true,
        }),
      );
    await this.audit(
      userId,
      saved.id,
      id ? "pharmacy.updated" : "pharmacy.applied",
      "pharmacy",
      saved.id,
    );
    return saved;
  }
  // The only way a pharmacy gets any staff beyond the manager saveProfile()
  // creates automatically for a new application — without this, a freshly
  // onboarded pharmacy has no pharmacist, and review() (correctly) refuses
  // every non-pharmacist decision, so it could never approve a prescription
  // order except through direct DB access.
  async assignStaff(
    managerId: string,
    pharmacyId: string,
    dto: AssignStaffDto,
  ) {
    const manager = await this.assertStaff(managerId, pharmacyId);
    if (manager.role !== PharmacyStaffRole.MANAGER)
      throw new ForbiddenException(
        "Only a manager on staff can assign staff roles",
      );
    const user = await this.users.findByEmail(dto.email);
    if (!user) throw new NotFoundException("No account found for that email");
    let member = await this.staff.findOne({
      where: { pharmacyId, userId: user.id },
    });
    // If this call would demote the pharmacy's only active manager (most
    // often a manager doing it to themselves), refuse it: this same
    // endpoint requires the caller already be a manager, so once the last
    // one is gone nobody can assign a replacement without direct DB access.
    if (
      member?.role === PharmacyStaffRole.MANAGER &&
      member.active &&
      dto.role !== PharmacyStaffRole.MANAGER
    ) {
      const managerCount = await this.staff.count({
        where: { pharmacyId, role: PharmacyStaffRole.MANAGER, active: true },
      });
      if (managerCount <= 1)
        throw new ConflictException(
          "Cannot demote the pharmacy's only manager — assign another manager first",
        );
    }
    member = Object.assign(
      member ?? this.staff.create({ pharmacyId, userId: user.id }),
      { role: dto.role, active: true },
    );
    const saved = await this.staff.save(member);
    await this.audit(
      managerId,
      pharmacyId,
      "staff.assigned",
      "staff",
      saved.id,
      { userId: user.id, role: dto.role },
    );
    return saved;
  }
  async saveProduct(
    userId: string,
    pharmacyId: string,
    id: string | undefined,
    dto: ProductDto,
  ) {
    await this.assertStaff(userId, pharmacyId);
    const category = await this.categories.findOneBy({ id: dto.categoryId });
    if (!category) throw new BadRequestException("Unknown category");
    let product = id ? await this.products.findOneBy({ id, pharmacyId }) : null;
    if (id && !product)
      throw new NotFoundException("Product not found in this pharmacy");
    product = Object.assign(
      product ?? this.products.create({ pharmacyId }),
      dto,
    );
    const saved = await this.products.save(product);
    await this.inventory.upsert(
      { productId: saved.id, quantity: dto.stockQuantity },
      ["productId"],
    );
    await this.audit(
      userId,
      pharmacyId,
      id ? "product.updated" : "product.created",
      "product",
      saved.id,
    );
    return this.products.findOneOrFail({ where: { id: saved.id } });
  }
  async removeProduct(userId: string, pharmacyId: string, id: string) {
    await this.assertStaff(userId, pharmacyId);
    const result = await this.products.delete({ id, pharmacyId });
    if (!result.affected)
      throw new NotFoundException("Product not found in this pharmacy");
    await this.audit(userId, pharmacyId, "product.deleted", "product", id);
  }
  async createOrder(userId: string, dto: CreateOrderDto) {
    if (!dto.items.length) throw new BadRequestException("Your cart is empty");
    const pharmacy = await this.pharmacies.findOneBy({ id: dto.pharmacyId });
    if (!pharmacy || pharmacy.status !== PharmacyStatus.APPROVED)
      throw new BadRequestException(
        "This pharmacy is not approved to receive orders",
      );
    // Checked against the trimmed value — the DTO's length validation and
    // this check both pass for a whitespace-only address ("     "), which
    // then trims to nothing when it's actually saved a few lines down,
    // leaving an order with no usable delivery destination.
    const trimmedDeliveryAddress = dto.deliveryAddress?.trim();
    if (
      dto.fulfillmentMethod === FulfillmentMethod.DELIVERY &&
      (!pharmacy.deliveryEnabled || !trimmedDeliveryAddress)
    )
      throw new BadRequestException("A delivery address is required");
    if (
      dto.fulfillmentMethod === FulfillmentMethod.PICKUP &&
      !pharmacy.pickupEnabled
    )
      throw new BadRequestException("Pickup is unavailable");

    // Aggregate quantities per product first — the cart can list the same
    // productId on more than one line (e.g. added in two separate clicks).
    // Checking/reserving stock per *line* instead of per product lets two
    // lines each pass a "quantity <= stock" check against the same
    // pre-decrement stock figure, then have the second decrement violate
    // the DB's CHECK(quantity>=0) after the first has already landed.
    const quantityByProduct = new Map<string, number>();
    for (const item of dto.items) {
      quantityByProduct.set(
        item.productId,
        (quantityByProduct.get(item.productId) ?? 0) + item.quantity,
      );
    }
    const ids = [...quantityByProduct.keys()];
    const products = await this.products.find({
      where: { id: In(ids), pharmacyId: dto.pharmacyId, isVisible: true },
    });
    if (products.length !== ids.length)
      throw new BadRequestException("Cart contains an unavailable product");
    const map = new Map(products.map((x) => [x.id, x]));
    let requires = false;
    const lines = ids.map((id) => {
      const p = map.get(id)!;
      const quantity = quantityByProduct.get(id)!;
      if (!p.inventory || p.inventory.quantity < quantity)
        throw new ConflictException(`${p.name} does not have enough stock`);
      requires ||= p.prescriptionRequired;
      return this.orderItems.create({
        productId: p.id,
        name: p.name,
        unitPrice: p.price,
        quantity,
        prescriptionRequired: p.prescriptionRequired,
      });
    });
    if (
      requires &&
      (!dto.prescriptionId || !dto.consentToPrescriptionProcessing)
    )
      throw new BadRequestException(
        "Prescription upload and consent are required; upload does not guarantee approval",
      );

    // Validate the prescription *before* writing anything — findOne here,
    // not after the order/items are already saved, so a bad prescriptionId
    // (nonexistent, someone else's, a different pharmacy's, or already
    // attached to another order) fails with nothing persisted rather than
    // leaving a phantom under_review order behind.
    let prescription: Prescription | null = null;
    if (requires) {
      prescription = await this.prescriptions.findOne({
        where: {
          id: dto.prescriptionId,
          customerUserId: userId,
          pharmacyId: dto.pharmacyId,
          orderId: IsNull(),
        },
      });
      if (!prescription)
        throw new BadRequestException(
          "Prescription is not available for this pharmacy",
        );
    }

    const { subtotal, delivery, total } = calculatePharmacyTotals(
      lines,
      dto.fulfillmentMethod,
      Number(pharmacy.deliveryFee),
    );

    const persist = async (
      orderRepo: Repository<PharmacyOrder>,
      itemRepo: Repository<PharmacyOrderItem>,
      inventoryRepo: Repository<PharmacyInventory>,
      prescriptionRepo: Repository<Prescription>,
      auditRepo: Repository<PharmacyAuditLog>,
    ) => {
      const order = await orderRepo.save(
        orderRepo.create({
          pharmacyId: pharmacy.id,
          customerUserId: userId,
          fulfillmentMethod: dto.fulfillmentMethod,
          deliveryAddress: trimmedDeliveryAddress || null,
          productSubtotal: subtotal,
          deliveryFee: delivery,
          platformFee: 0,
          finalTotal: total,
          status: requires
            ? PharmacyOrderStatus.UNDER_REVIEW
            : PharmacyOrderStatus.PENDING,
        }),
      );
      await itemRepo.save(
        lines.map((x) => Object.assign(x, { orderId: order.id })),
      );
      if (prescription) {
        // Conditioned on orderId still being null, and checked for exactly
        // one affected row — without this, two concurrent checkouts that
        // both read the same unattached prescription in the findOne above
        // would both pass this update, the second one silently
        // reassigning the prescription away from whichever order it had
        // just been attached to. This UPDATE's row lock is what actually
        // serializes that race: a concurrent transaction attempting the
        // same conditional update blocks until this one commits, then
        // re-evaluates orderId IS NULL against the now-committed row and
        // finds it no longer matches.
        const result = await prescriptionRepo.update(
          { id: prescription.id, orderId: IsNull() },
          { orderId: order.id },
        );
        if (!result.affected)
          throw new ConflictException(
            "This prescription was just used for another order",
          );
      }
      for (const [productId, quantity] of quantityByProduct) {
        try {
          await inventoryRepo.decrement({ productId }, "quantity", quantity);
        } catch {
          // Someone else's order landed between our availability check
          // above and this write and took the remaining stock — the DB's
          // CHECK(quantity>=0) is the real backstop against overselling;
          // surface it the same way the pre-check above does.
          throw new ConflictException(
            `${map.get(productId)!.name} does not have enough stock`,
          );
        }
      }
      // Logged inside the same transaction as the order/items/inventory
      // writes — a standalone post-commit audit call would let a failure
      // here (a DB blip, a constraint the audit table alone enforces)
      // return an error to the customer for an order that had already
      // fully succeeded, inviting a retry that pays and reserves stock
      // twice for what looks to them like one checkout.
      await this.audit(
        userId,
        pharmacy.id,
        "order.created",
        "order",
        order.id,
        {},
        auditRepo,
      );
      return order;
    };

    // Wrapped in a transaction so a mid-flight failure (the stock-check
    // race above, or anything else) can't leave an order with some but
    // not all of its items/inventory/prescription-link/audit-log written.
    const manager = this.orders.manager;
    const order = manager?.transaction
      ? await manager.transaction((tx) =>
          persist(
            tx.getRepository(PharmacyOrder),
            tx.getRepository(PharmacyOrderItem),
            tx.getRepository(PharmacyInventory),
            tx.getRepository(Prescription),
            tx.getRepository(PharmacyAuditLog),
          ),
        )
      : await persist(
          this.orders,
          this.orderItems,
          this.inventory,
          this.prescriptions,
          this.audits,
        );

    return this.orderDetail(order.id);
  }
  async customerOrders(userId: string) {
    const orders = await this.orders.find({
      where: { customerUserId: userId },
      order: { createdAt: "DESC" },
    });
    // Same reasoning as pharmacyOrders() below: without line items, a
    // customer with several orders of the same total can't tell them apart
    // on an order-history page. One extra query, not N+1.
    const orderIds = orders.map((o) => o.id);
    const items = orderIds.length
      ? await this.orderItems.find({ where: { orderId: In(orderIds) } })
      : [];
    const itemsByOrderId = new Map<string, typeof items>();
    for (const item of items) {
      const bucket = itemsByOrderId.get(item.orderId);
      if (bucket) bucket.push(item);
      else itemsByOrderId.set(item.orderId, [item]);
    }
    return orders.map((o) => ({
      ...o,
      items: itemsByOrderId.get(o.id) ?? [],
    }));
  }
  async pharmacyOrders(userId: string, pharmacyId: string) {
    await this.assertStaff(userId, pharmacyId);
    const orders = await this.orders.find({
      where: { pharmacyId },
      order: { createdAt: "DESC" },
    });
    const orderIds = orders.map((o) => o.id);
    // PharmacyOrder itself has no prescription reference (the FK points
    // the other way — Prescription.orderId), so without this a staff
    // member has no way to discover the id review()/prescriptionFile()
    // need for an under_review order: neither route is reachable from the
    // order queue alone. One extra query rather than N+1 per order.
    const prescriptions = orderIds.length
      ? await this.prescriptions.find({ where: { orderId: In(orderIds) } })
      : [];
    const prescriptionIdByOrderId = new Map(
      prescriptions.map((p) => [p.orderId as string, p.id]),
    );
    // Same story for line items: staff preparing an order need to know
    // what's actually in it (product names, quantities), and there was no
    // other route exposing that — just totals and a status.
    const items = orderIds.length
      ? await this.orderItems.find({ where: { orderId: In(orderIds) } })
      : [];
    const itemsByOrderId = new Map<string, typeof items>();
    for (const item of items) {
      const bucket = itemsByOrderId.get(item.orderId);
      if (bucket) bucket.push(item);
      else itemsByOrderId.set(item.orderId, [item]);
    }
    return orders.map((o) => ({
      ...o,
      prescriptionId: prescriptionIdByOrderId.get(o.id) ?? null,
      items: itemsByOrderId.get(o.id) ?? [],
    }));
  }
  async transition(
    userId: string,
    pharmacyId: string,
    orderId: string,
    status: PharmacyOrderStatus,
  ) {
    await this.assertStaff(userId, pharmacyId);
    const order = await this.orders.findOneBy({ id: orderId, pharmacyId });
    if (!order) throw new NotFoundException("Order not found in this pharmacy");
    const fromStatus = order.status;
    if (!NEXT[fromStatus].includes(status))
      throw new ConflictException(
        `Cannot move an order from ${fromStatus} to ${status}`,
      );
    // NEXT[PREPARING] offers both dispatch states so one table can serve
    // every order regardless of how it's fulfilled — but only one of them
    // actually matches this particular order; picking the other would show
    // the customer a tracking status ("out for delivery") that contradicts
    // what they actually chose ("pickup") at checkout.
    if (
      status === PharmacyOrderStatus.READY_FOR_PICKUP &&
      order.fulfillmentMethod !== FulfillmentMethod.PICKUP
    )
      throw new ConflictException(
        "This order is for delivery, not pickup — mark it out for delivery instead",
      );
    if (
      status === PharmacyOrderStatus.OUT_FOR_DELIVERY &&
      order.fulfillmentMethod !== FulfillmentMethod.DELIVERY
    )
      throw new ConflictException(
        "This order is for pickup, not delivery — mark it ready for pickup instead",
      );

    const run = async (
      orderRepo: Repository<PharmacyOrder>,
      itemRepo: Repository<PharmacyOrderItem>,
      inventoryRepo: Repository<PharmacyInventory>,
      auditRepo: Repository<PharmacyAuditLog>,
    ) => {
      // Conditioned on the order still being in fromStatus — two concurrent
      // requests both racing this transition (e.g. two staff both hit
      // "cancel" on the same order) would otherwise both pass the
      // in-memory NEXT[] check above, both save CANCELLED, and both run
      // restoreInventory, inflating stock by an entire order. This UPDATE's
      // row lock serializes that: whichever commits first wins, the other
      // affects zero rows and throws instead of restoring inventory twice.
      const result = await orderRepo.update(
        { id: orderId, pharmacyId, status: fromStatus },
        { status },
      );
      if (!result.affected)
        throw new ConflictException(
          `Cannot move an order from ${fromStatus} to ${status}`,
        );
      // A cancelled order was already decremented against inventory at
      // creation time — every path into CANCELLED is a one-way transition
      // (NEXT[CANCELLED] is empty), and the conditional update above
      // ensures only one concurrent request's restore actually runs.
      if (status === PharmacyOrderStatus.CANCELLED) {
        await this.restoreInventory(order.id, itemRepo, inventoryRepo);
      }
      // Committed with the status change and any restock above — otherwise
      // a failure here would leave the transition (and a cancellation's
      // restock) applied with no status-change audit entry, and a retry
      // can't repair it once the order has moved out of fromStatus.
      await this.audit(
        userId,
        pharmacyId,
        "order.status_changed",
        "order",
        order.id,
        { status },
        auditRepo,
      );
    };
    const manager = this.orders.manager;
    if (manager?.transaction) {
      await manager.transaction((tx) =>
        run(
          tx.getRepository(PharmacyOrder),
          tx.getRepository(PharmacyOrderItem),
          tx.getRepository(PharmacyInventory),
          tx.getRepository(PharmacyAuditLog),
        ),
      );
    } else {
      await run(this.orders, this.orderItems, this.inventory, this.audits);
    }

    order.status = status;
    return order;
  }
  async review(
    userId: string,
    pharmacyId: string,
    prescriptionId: string,
    dto: PrescriptionReviewDto,
  ) {
    const member = await this.assertStaff(userId, pharmacyId);
    // A manager or ordinary employee passes assertStaff the same as a
    // pharmacist — but deciding whether a prescription is genuine and
    // matches the order is a clinical judgment call the storefront
    // advertises as "pharmacist review only"; only that role may record one.
    if (member.role !== PharmacyStaffRole.PHARMACIST)
      throw new ForbiddenException(
        "Only a pharmacist on staff can decide on a prescription",
      );
    const rx = await this.prescriptions.findOne({
      where: { id: prescriptionId, pharmacyId },
    });
    if (!rx)
      throw new NotFoundException("Prescription not found in this pharmacy");
    // Refuse to record a decision once this prescription's order has
    // already left under_review — otherwise a duplicate submission, or a
    // second pharmacist deciding after the first, could record e.g.
    // "rejected" here for audit purposes while the order itself keeps
    // progressing under an earlier "accepted" decision, with nothing
    // downstream ever reflecting the contradiction. The conditional
    // UPDATE below is still what actually serializes a genuinely
    // concurrent double-decision; this is the sequential case (order
    // already decided, or cancelled, before this call even started).
    if (rx.orderId) {
      const order = await this.orders.findOneBy({
        id: rx.orderId,
        pharmacyId,
      });
      if (!order || order.status !== PharmacyOrderStatus.UNDER_REVIEW)
        throw new ConflictException(
          "This order has already left review — a new decision can't be recorded",
        );
    }
    const willTransitionOrder =
      rx.orderId &&
      dto.decision !== PrescriptionDecision.CLARIFICATION_REQUESTED;
    const newStatus = willTransitionOrder
      ? dto.decision === PrescriptionDecision.ACCEPTED
        ? PharmacyOrderStatus.ACCEPTED
        : PharmacyOrderStatus.REJECTED
      : null;
    const orderId = rx.orderId;

    // The review row and (when applicable) the order's status transition
    // are one decision — committed together, in this order, inside one
    // transaction. Without that, two pharmacists deciding concurrently
    // could both pass the preliminary under_review check above, both save
    // a review row here, and only then race on the conditional UPDATE
    // below — silently leaving a contradictory review (e.g. "rejected")
    // recorded and audited beside whichever decision actually won.
    const run = async (
      reviewRepo: Repository<PrescriptionReview>,
      orderRepo: Repository<PharmacyOrder>,
      itemRepo: Repository<PharmacyOrderItem>,
      inventoryRepo: Repository<PharmacyInventory>,
      auditRepo: Repository<PharmacyAuditLog>,
    ) => {
      const review = await reviewRepo.save(
        reviewRepo.create({
          prescriptionId,
          reviewerUserId: userId,
          decision: dto.decision,
          notes: dto.notes?.trim() || null,
        }),
      );
      if (willTransitionOrder && newStatus) {
        // Conditioned on the order still being under_review, same reasoning
        // as transition()'s conditional update: this row lock serializes a
        // concurrent second decision on the same prescription/order (e.g.
        // a double-submitted review request) so at most one of them can
        // move the order and, on rejection, restore its inventory.
        const result = await orderRepo.update(
          {
            id: orderId!,
            pharmacyId,
            status: PharmacyOrderStatus.UNDER_REVIEW,
          },
          { status: newStatus },
        );
        if (!result.affected)
          throw new ConflictException(
            "This order was just decided by another request",
          );
        // A rejected prescription means this order will never be
        // fulfilled — release the stock it reserved at checkout, same as
        // an explicit cancellation. REJECTED is terminal (NEXT[REJECTED]
        // is empty) so this can only happen once per order.
        if (newStatus === PharmacyOrderStatus.REJECTED) {
          await this.restoreInventory(orderId!, itemRepo, inventoryRepo);
        }
      }
      // Committed in the same transaction as the review row and order
      // transition above — otherwise a failure here would leave the
      // clinical decision (and any inventory restoration) applied with no
      // corresponding audit entry, and a retry can't repair it once the
      // order has left under_review (the preliminary check above now
      // correctly refuses a second decision).
      await this.audit(
        userId,
        pharmacyId,
        `prescription.${dto.decision}`,
        "prescription",
        prescriptionId,
        {},
        auditRepo,
      );
      return review;
    };
    const manager = this.orders.manager;
    const review = manager?.transaction
      ? await manager.transaction((tx) =>
          run(
            tx.getRepository(PrescriptionReview),
            tx.getRepository(PharmacyOrder),
            tx.getRepository(PharmacyOrderItem),
            tx.getRepository(PharmacyInventory),
            tx.getRepository(PharmacyAuditLog),
          ),
        )
      : await run(
          this.reviews,
          this.orders,
          this.orderItems,
          this.inventory,
          this.audits,
        );

    return review;
  }
  // Customer-facing upload — happens *before* checkout, so the cart can
  // submit the returned id as CreateOrderDto.prescriptionId. Saved through
  // StorageProvider.savePrivate() — not the save() every other upload in
  // this app uses — because that one always returns a publicly-fetchable
  // URL (local disk under the statically-served /uploads, or an S3 object
  // meant to sit behind a public bucket/CDN); a prescription photo is
  // sensitive enough that it must stay unreachable without going through
  // prescriptionFile() below, which checks the caller is the order owner,
  // assigned pharmacy staff, or an admin before reading it back. Never
  // returned as part of any pharmacy/order listing either
  // (Prescription.privateStorageKey is `select: false`).
  async uploadPrescription(
    userId: string,
    pharmacyId: string,
    file: { buffer: Buffer; originalName: string; mimeType: string },
  ) {
    if (!ALLOWED_PRESCRIPTION_MIME_TYPES.includes(file.mimeType))
      throw new BadRequestException(
        "Only JPEG, PNG, WebP images or a PDF are allowed",
      );
    if (file.buffer.length > MAX_PRESCRIPTION_FILE_SIZE_BYTES)
      throw new BadRequestException("Prescription file is larger than 10MB");
    const pharmacy = await this.pharmacies.findOneBy({ id: pharmacyId });
    if (!pharmacy || pharmacy.status !== PharmacyStatus.APPROVED)
      throw new BadRequestException(
        "This pharmacy is not approved to receive orders",
      );
    const filename = `prescriptions/${randomUUID()}${extname(file.originalName).slice(0, 10)}`;
    const { key } = await this.storage.savePrivate({
      buffer: file.buffer,
      filename,
      contentType: file.mimeType,
    });
    const rx = await this.prescriptions.save(
      this.prescriptions.create({
        customerUserId: userId,
        pharmacyId,
        orderId: null,
        privateStorageKey: key,
        originalFilename: file.originalName,
        mimeType: file.mimeType,
      }),
    );
    await this.audit(
      userId,
      pharmacyId,
      "prescription.uploaded",
      "prescription",
      rx.id,
    );
    return { id: rx.id };
  }
  // Auditable, access-controlled reveal of an uploaded prescription's file
  // — the only place privateStorageKey ever leaves the service, and only
  // to the customer who uploaded it, staff of the pharmacy it was uploaded
  // for, or an admin. Reads the actual bytes back through
  // StorageProvider.readPrivate() and returns them directly (the
  // controller streams them to the caller) rather than a URL — there is no
  // "private URL" a client could be handed and still have the
  // authorization check above actually apply to it.
  async prescriptionFile(userId: string, isAdmin: boolean, id: string) {
    const rx = await this.prescriptions
      .createQueryBuilder("rx")
      .addSelect("rx.privateStorageKey")
      .where("rx.id = :id", { id })
      .getOne();
    if (!rx) throw new NotFoundException("Prescription not found");
    const isOwner = rx.customerUserId === userId;
    const isStaff =
      !isOwner &&
      !isAdmin &&
      (await this.staff.findOne({
        where: { userId, pharmacyId: rx.pharmacyId, active: true },
      }));
    if (!isOwner && !isAdmin && !isStaff)
      throw new ForbiddenException(
        "You are not authorized to view this prescription",
      );
    await this.audit(
      userId,
      rx.pharmacyId,
      "prescription.viewed",
      "prescription",
      rx.id,
    );
    const { buffer } = await this.storage.readPrivate(rx.privateStorageKey);
    return {
      buffer,
      mimeType: rx.mimeType,
      originalFilename: rx.originalFilename,
    };
  }
  async verification(
    adminId: string,
    pharmacyId: string,
    dto: VerificationDto,
  ) {
    if (
      ![
        PharmacyStatus.APPROVED,
        PharmacyStatus.REJECTED,
        PharmacyStatus.SUSPENDED,
      ].includes(dto.decision)
    )
      throw new BadRequestException("Invalid verification decision");
    // licenceNumber is `select: false` — opt back in explicitly, the same
    // way applications() does, since it's what this check is actually for.
    const p = await this.pharmacies
      .createQueryBuilder("p")
      .addSelect("p.licenceNumber")
      .where("p.id = :id", { id: pharmacyId })
      .getOne();
    if (!p) throw new NotFoundException("Pharmacy not found");
    // The admin oversight page is the only place a licence number can be
    // inspected before verifying — enforced here too, not just by disabling
    // the button there, since this is the endpoint that actually grants a
    // storefront "approved" status.
    if (dto.decision === PharmacyStatus.APPROVED && !p.licenceNumber?.trim())
      throw new BadRequestException(
        "Cannot approve a pharmacy with no licence number on file",
      );
    p.status = dto.decision;

    // The status change, the PharmacyVerification evidence record, and the
    // audit entry all describe one decision — committed together so a
    // failure partway through can't leave the pharmacy "approved" (and
    // therefore publicly listed) with no verification record explaining
    // why, or reporting failure to the caller for a decision that had, in
    // fact, already taken effect.
    const run = async (
      pharmacyRepo: Repository<Pharmacy>,
      verificationRepo: Repository<PharmacyVerification>,
      auditRepo: Repository<PharmacyAuditLog>,
    ) => {
      await pharmacyRepo.save(p);
      await verificationRepo.save(
        verificationRepo.create({
          pharmacyId,
          reviewerUserId: adminId,
          decision: dto.decision,
          notes: dto.notes?.trim() || null,
        }),
      );
      await this.audit(
        adminId,
        pharmacyId,
        "verification.decided",
        "pharmacy",
        pharmacyId,
        { decision: dto.decision },
        auditRepo,
      );
    };
    const manager = this.pharmacies.manager;
    if (manager?.transaction) {
      await manager.transaction((tx) =>
        run(
          tx.getRepository(Pharmacy),
          tx.getRepository(PharmacyVerification),
          tx.getRepository(PharmacyAuditLog),
        ),
      );
    } else {
      await run(this.pharmacies, this.verifications, this.audits);
    }
    return p;
  }
  applications() {
    return this.pharmacies
      .createQueryBuilder("p")
      .addSelect(["p.licenceNumber", "p.licenceDocumentKey"])
      .orderBy("p.createdAt", "DESC")
      .getMany();
  }
  allOrders() {
    return this.orders.find({ order: { createdAt: "DESC" } });
  }
  stats(userId: string, pharmacyId: string) {
    return this.assertStaff(userId, pharmacyId).then(async () => {
      const all = await this.orders.findBy({ pharmacyId });
      return {
        totalOrders: all.length,
        completedOrders: all.filter(
          (x) => x.status === PharmacyOrderStatus.COMPLETED,
        ).length,
        pendingOrders: all.filter((x) =>
          [
            PharmacyOrderStatus.PENDING,
            PharmacyOrderStatus.UNDER_REVIEW,
          ].includes(x.status),
        ).length,
        revenue: all
          .filter((x) => x.status === PharmacyOrderStatus.COMPLETED)
          .reduce((s, x) => s + Number(x.finalTotal), 0),
      };
    });
  }
  auditLogs() {
    return this.audits.find({ order: { createdAt: "DESC" }, take: 250 });
  }
  private orderDetail(id: string) {
    return this.orders.findOneOrFail({ where: { id } });
  }
  // Undoes the per-line decrements createOrder() made at checkout, for an
  // order that turns out never to be fulfilled (cancelled, or a rejected
  // prescription). A line whose product was since deleted (ON DELETE SET
  // NULL leaves productId null) has nothing left to credit back. Callers
  // that need this atomic with the order's own status update (transition(),
  // review()) pass in transaction-scoped repos; the defaults keep this
  // usable standalone.
  private async restoreInventory(
    orderId: string,
    itemRepo: Repository<PharmacyOrderItem> = this.orderItems,
    inventoryRepo: Repository<PharmacyInventory> = this.inventory,
  ) {
    const items = await itemRepo.find({ where: { orderId } });
    for (const item of items) {
      if (!item.productId) continue;
      await inventoryRepo.increment(
        { productId: item.productId },
        "quantity",
        item.quantity,
      );
    }
  }
  private audit(
    actorUserId: string | null,
    pharmacyId: string | null,
    action: string,
    targetType: string,
    targetId: string | null,
    metadata: Record<string, unknown> = {},
    // Callers that need this audit row committed atomically with other
    // writes (createOrder(), below) pass a transaction-scoped repo; every
    // other call site logs standalone against this.audits.
    auditRepo: Repository<PharmacyAuditLog> = this.audits,
  ) {
    return auditRepo.save(
      auditRepo.create({
        actorUserId,
        pharmacyId,
        action,
        targetType,
        targetId,
        metadata,
      }),
    );
  }
}

export { NEXT as PHARMACY_ORDER_TRANSITIONS };

export function calculatePharmacyTotals(
  items: Array<{ unitPrice: number | string; quantity: number }>,
  method: FulfillmentMethod,
  deliveryFee: number,
  platformFee = 0,
) {
  const subtotal = items.reduce(
    (sum, item) => sum + Number(item.unitPrice) * item.quantity,
    0,
  );
  const delivery = method === FulfillmentMethod.DELIVERY ? deliveryFee : 0;
  return {
    subtotal,
    delivery,
    platformFee,
    total: subtotal + delivery + platformFee,
  };
}
