import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Brackets, In, Repository } from "typeorm";
import { slugify } from "../common/slugify";
import {
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

const NEXT: Record<PharmacyOrderStatus, PharmacyOrderStatus[]> = {
  [PharmacyOrderStatus.PENDING]: [
    PharmacyOrderStatus.UNDER_REVIEW,
    PharmacyOrderStatus.ACCEPTED,
    PharmacyOrderStatus.CANCELLED,
  ],
  [PharmacyOrderStatus.UNDER_REVIEW]: [
    PharmacyOrderStatus.ACCEPTED,
    PharmacyOrderStatus.REJECTED,
    PharmacyOrderStatus.CANCELLED,
  ],
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
    const pharmacy = id
      ? await this.pharmacies.findOneByOrFail({ id })
      : this.pharmacies.create({ status: PharmacyStatus.PENDING });
    Object.assign(pharmacy, dto, {
      slug: pharmacy.slug || `${slugify(dto.name)}-${Date.now().toString(36)}`,
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
    if (
      dto.fulfillmentMethod === FulfillmentMethod.DELIVERY &&
      (!pharmacy.deliveryEnabled || !dto.deliveryAddress)
    )
      throw new BadRequestException("A delivery address is required");
    if (
      dto.fulfillmentMethod === FulfillmentMethod.PICKUP &&
      !pharmacy.pickupEnabled
    )
      throw new BadRequestException("Pickup is unavailable");
    const ids = dto.items.map((x) => x.productId),
      products = await this.products.find({
        where: { id: In(ids), pharmacyId: dto.pharmacyId, isVisible: true },
      });
    if (products.length !== new Set(ids).size)
      throw new BadRequestException("Cart contains an unavailable product");
    const map = new Map(products.map((x) => [x.id, x]));
    let requires = false;
    const lines = dto.items.map((x) => {
      const p = map.get(x.productId)!;
      if (!p.inventory || p.inventory.quantity < x.quantity)
        throw new ConflictException(`${p.name} does not have enough stock`);
      requires ||= p.prescriptionRequired;
      return this.orderItems.create({
        productId: p.id,
        name: p.name,
        unitPrice: p.price,
        quantity: x.quantity,
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
    const { subtotal, delivery, total } = calculatePharmacyTotals(
      lines,
      dto.fulfillmentMethod,
      Number(pharmacy.deliveryFee),
    );
    const order = await this.orders.save(
      this.orders.create({
        pharmacyId: pharmacy.id,
        customerUserId: userId,
        fulfillmentMethod: dto.fulfillmentMethod,
        deliveryAddress: dto.deliveryAddress?.trim() || null,
        productSubtotal: subtotal,
        deliveryFee: delivery,
        platformFee: 0,
        finalTotal: total,
        status: requires
          ? PharmacyOrderStatus.UNDER_REVIEW
          : PharmacyOrderStatus.PENDING,
      }),
    );
    await this.orderItems.save(
      lines.map((x) => Object.assign(x, { orderId: order.id })),
    );
    if (requires) {
      const rx = await this.prescriptions.findOne({
        where: {
          id: dto.prescriptionId,
          customerUserId: userId,
          pharmacyId: dto.pharmacyId,
        },
      });
      if (!rx)
        throw new BadRequestException(
          "Prescription is not available for this pharmacy",
        );
      rx.orderId = order.id;
      await this.prescriptions.save(rx);
    }
    for (const x of dto.items) {
      const p = map.get(x.productId)!;
      await this.inventory.decrement(
        { productId: p.id },
        "quantity",
        x.quantity,
      );
    }
    await this.audit(userId, pharmacy.id, "order.created", "order", order.id);
    return this.orderDetail(order.id);
  }
  async customerOrders(userId: string) {
    return this.orders.find({
      where: { customerUserId: userId },
      order: { createdAt: "DESC" },
    });
  }
  async pharmacyOrders(userId: string, pharmacyId: string) {
    await this.assertStaff(userId, pharmacyId);
    return this.orders.find({
      where: { pharmacyId },
      order: { createdAt: "DESC" },
    });
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
    if (!NEXT[order.status].includes(status))
      throw new ConflictException(
        `Cannot move an order from ${order.status} to ${status}`,
      );
    order.status = status;
    await this.orders.save(order);
    await this.audit(
      userId,
      pharmacyId,
      "order.status_changed",
      "order",
      order.id,
      { status },
    );
    return order;
  }
  async review(
    userId: string,
    pharmacyId: string,
    prescriptionId: string,
    dto: PrescriptionReviewDto,
  ) {
    await this.assertStaff(userId, pharmacyId);
    const rx = await this.prescriptions.findOne({
      where: { id: prescriptionId, pharmacyId },
    });
    if (!rx)
      throw new NotFoundException("Prescription not found in this pharmacy");
    const review = await this.reviews.save(
      this.reviews.create({
        prescriptionId,
        reviewerUserId: userId,
        decision: dto.decision,
        notes: dto.notes?.trim() || null,
      }),
    );
    if (rx.orderId) {
      const order = await this.orders.findOneBy({ id: rx.orderId, pharmacyId });
      if (
        order &&
        order.status === PharmacyOrderStatus.UNDER_REVIEW &&
        dto.decision !== PrescriptionDecision.CLARIFICATION_REQUESTED
      ) {
        order.status =
          dto.decision === PrescriptionDecision.ACCEPTED
            ? PharmacyOrderStatus.ACCEPTED
            : PharmacyOrderStatus.REJECTED;
        await this.orders.save(order);
      }
    }
    await this.audit(
      userId,
      pharmacyId,
      `prescription.${dto.decision}`,
      "prescription",
      prescriptionId,
    );
    return review;
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
    const p = await this.pharmacies.findOneBy({ id: pharmacyId });
    if (!p) throw new NotFoundException("Pharmacy not found");
    p.status = dto.decision;
    await this.pharmacies.save(p);
    await this.verifications.save(
      this.verifications.create({
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
    );
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
  private audit(
    actorUserId: string | null,
    pharmacyId: string | null,
    action: string,
    targetType: string,
    targetId: string | null,
    metadata: Record<string, unknown> = {},
  ) {
    return this.audits.save(
      this.audits.create({
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
