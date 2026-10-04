import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Optional,
  NotFoundException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { In, IsNull, Repository } from "typeorm";
import {
  PharmacyAuditLog,
  PharmacyOrder,
  PharmacyOrderItem,
  PharmacyOrderMessage,
  Prescription,
} from "./entities/order.entity";
import { PharmacyStaff } from "./entities/pharmacy.entity";
import { PharmacyInventory, PharmacyProduct } from "./entities/product.entity";
import {
  PHARMACY_PAYMENT_LABELS,
  PharmacyOrderPaymentStatus,
  PharmacyOrderStatus,
  PharmacyPaymentMethod,
} from "./entities/pharmacy.enums";
import { EPrescriptionsService } from "../clinics/e-prescriptions.service";
import { PharmacyNotifier, lrd, orderRef } from "./pharmacy-notifier";

/** One step on an order's timeline, as the customer and staff see it. */
export interface PharmacyOrderTimelineEntry {
  key: string;
  at: Date;
  note?: string;
}

// Before the pharmacy starts preparing, a customer can still change their
// mind. After that, cancelling goes through the pharmacy (chat).
const CUSTOMER_CANCELLABLE = [
  PharmacyOrderStatus.PENDING,
  PharmacyOrderStatus.UNDER_REVIEW,
  PharmacyOrderStatus.ACCEPTED,
];
const CLOSED = [
  PharmacyOrderStatus.COMPLETED,
  PharmacyOrderStatus.CANCELLED,
  PharmacyOrderStatus.REJECTED,
];

/**
 * Everything that happens to a pharmacy order after checkout that isn't a
 * staff status change: paying with mobile money, staff confirming the
 * payment, refunds, the customer cancelling, ordering the same again, the
 * order's timeline, and the chat between customer and pharmacy.
 *
 * Status changes and prescription decisions stay in PharmaciesService;
 * every step here is written to the same pharmacy audit log, which is also
 * where the timeline is read from.
 */
@Injectable()
export class PharmacyOrderFlowService {
  constructor(
    @InjectRepository(PharmacyOrder)
    private readonly orders: Repository<PharmacyOrder>,
    @InjectRepository(PharmacyOrderItem)
    private readonly items: Repository<PharmacyOrderItem>,
    @InjectRepository(PharmacyOrderMessage)
    private readonly messages: Repository<PharmacyOrderMessage>,
    @InjectRepository(PharmacyStaff)
    private readonly staff: Repository<PharmacyStaff>,
    @InjectRepository(PharmacyProduct)
    private readonly products: Repository<PharmacyProduct>,
    @InjectRepository(PharmacyInventory)
    private readonly inventory: Repository<PharmacyInventory>,
    @InjectRepository(Prescription)
    private readonly prescriptions: Repository<Prescription>,
    @InjectRepository(PharmacyAuditLog)
    private readonly audits: Repository<PharmacyAuditLog>,
    private readonly notifier: PharmacyNotifier,
    @Optional() private readonly ePrescriptions?: EPrescriptionsService,
  ) {}

  // ── Payments ────────────────────────────────────────────────────────

  /** The customer has sent mobile money and gives us the transaction ID. */
  async submitPayment(userId: string, orderId: string, reference: string) {
    const order = await this.customerOrder(userId, orderId);
    const ref = reference.trim();
    if (order.paymentMethod === PharmacyPaymentMethod.CASH)
      throw new BadRequestException("This order is paid in cash");
    if (CLOSED.includes(order.status))
      throw new ConflictException("This order is closed");
    if (
      order.paymentStatus !== PharmacyOrderPaymentStatus.AWAITING_PAYMENT &&
      order.paymentStatus !== PharmacyOrderPaymentStatus.FAILED
    )
      throw new ConflictException("This order isn't waiting for a payment");
    if (order.status === PharmacyOrderStatus.UNDER_REVIEW)
      throw new ConflictException(
        "Wait for the pharmacist to approve your prescription before paying",
      );
    const result = await this.orders
      .update(
        {
          id: order.id,
          paymentStatus: In([
            PharmacyOrderPaymentStatus.AWAITING_PAYMENT,
            PharmacyOrderPaymentStatus.FAILED,
          ]),
        },
        {
          paymentReference: ref,
          paymentStatus: PharmacyOrderPaymentStatus.AWAITING_VERIFICATION,
        },
      )
      .catch((error: unknown) => {
        if ((error as { code?: string }).code === "23505")
          throw new ConflictException(
            "That transaction ID is already on another order. Check it, or message the pharmacy.",
          );
        throw error;
      });
    if (!result.affected)
      throw new ConflictException("This order isn't waiting for a payment");
    await this.log(userId, order, "payment.submitted", { reference: ref });
    void this.notifier.staffOf(
      order.pharmacyId,
      "pharmacy_order.payment",
      `Payment sent for ${orderRef(order.id)}`,
      `Check ${PHARMACY_PAYMENT_LABELS[order.paymentMethod]} transaction ${ref} for ${lrd(order.finalTotal)}.`,
    );
    return this.orders.findOneByOrFail({ id: order.id });
  }

  /** Staff confirm whether the mobile money arrived. */
  async verifyPayment(
    userId: string,
    pharmacyId: string,
    orderId: string,
    received: boolean,
  ) {
    await this.assertStaff(userId, pharmacyId);
    const order = await this.staffOrder(pharmacyId, orderId);
    if (
      order.paymentStatus !== PharmacyOrderPaymentStatus.AWAITING_VERIFICATION
    )
      throw new ConflictException("There's no payment waiting to be checked");
    const next = received
      ? PharmacyOrderPaymentStatus.PAID
      : PharmacyOrderPaymentStatus.FAILED;
    const result = await this.orders.update(
      {
        id: order.id,
        paymentStatus: PharmacyOrderPaymentStatus.AWAITING_VERIFICATION,
      },
      { paymentStatus: next },
    );
    if (!result.affected)
      throw new ConflictException("This payment was just checked");
    await this.log(
      userId,
      order,
      received ? "payment.confirmed" : "payment.failed",
    );
    void this.notifier.customer(
      order,
      "pharmacy_order.payment",
      received
        ? `Payment received · ${orderRef(order.id)}`
        : `Payment not found · ${orderRef(order.id)}`,
      received
        ? `The pharmacy received your ${lrd(order.finalTotal)}.`
        : `The pharmacy couldn't find transaction ${order.paymentReference}. Check the ID and send it again.`,
    );
    return this.orders.findOneByOrFail({ id: order.id });
  }

  /** Staff have sent back mobile money owed on a cancelled order. */
  async markRefunded(userId: string, pharmacyId: string, orderId: string) {
    await this.assertStaff(userId, pharmacyId);
    const order = await this.staffOrder(pharmacyId, orderId);
    const result = await this.orders.update(
      { id: order.id, paymentStatus: PharmacyOrderPaymentStatus.REFUND_DUE },
      { paymentStatus: PharmacyOrderPaymentStatus.REFUNDED },
    );
    if (!result.affected)
      throw new ConflictException("No refund is owed on this order");
    await this.log(userId, order, "payment.refunded");
    void this.notifier.customer(
      order,
      "pharmacy_order.payment",
      `Refund sent · ${orderRef(order.id)}`,
      `The pharmacy sent back ${lrd(order.finalTotal)} by ${PHARMACY_PAYMENT_LABELS[order.paymentMethod]}.`,
    );
    return this.orders.findOneByOrFail({ id: order.id });
  }

  // ── Customer actions ───────────────────────────────────────────────

  /** The customer cancels before the pharmacy starts preparing. */
  async cancelByCustomer(userId: string, orderId: string) {
    const order = await this.customerOrder(userId, orderId);
    if (!CUSTOMER_CANCELLABLE.includes(order.status))
      throw new ConflictException(
        "The pharmacy is already preparing this order — message them to cancel",
      );
    const refundDue =
      order.paymentStatus === PharmacyOrderPaymentStatus.PAID ||
      order.paymentStatus === PharmacyOrderPaymentStatus.AWAITING_VERIFICATION;
    const run = async (
      orderRepo: Repository<PharmacyOrder>,
      itemRepo: Repository<PharmacyOrderItem>,
      inventoryRepo: Repository<PharmacyInventory>,
      auditRepo: Repository<PharmacyAuditLog>,
    ) => {
      const result = await orderRepo.update(
        { id: order.id, status: order.status },
        {
          status: PharmacyOrderStatus.CANCELLED,
          previousStatus: order.status,
          ...(refundDue
            ? { paymentStatus: PharmacyOrderPaymentStatus.REFUND_DUE }
            : {}),
        },
      );
      if (!result.affected)
        throw new ConflictException(
          "This order just changed — reload and try again",
        );
      const lines = await itemRepo.find({ where: { orderId: order.id } });
      for (const line of lines) {
        if (!line.productId) continue;
        await inventoryRepo.increment(
          { productId: line.productId },
          "quantity",
          line.quantity,
        );
      }
      await auditRepo.save(
        auditRepo.create({
          actorUserId: userId,
          pharmacyId: order.pharmacyId,
          action: "order.cancelled_by_customer",
          targetType: "order",
          targetId: order.id,
          metadata: { status: PharmacyOrderStatus.CANCELLED },
        }),
      );
    };
    const manager = this.orders.manager;
    if (manager?.transaction)
      await manager.transaction((tx) =>
        run(
          tx.getRepository(PharmacyOrder),
          tx.getRepository(PharmacyOrderItem),
          tx.getRepository(PharmacyInventory),
          tx.getRepository(PharmacyAuditLog),
        ),
      );
    else await run(this.orders, this.items, this.inventory, this.audits);
    if (order.ePrescriptionId)
      await this.ePrescriptions?.orderSettled(order.id, false);
    void this.notifier.staffOf(
      order.pharmacyId,
      "pharmacy_order.cancelled",
      `Order ${orderRef(order.id)} cancelled`,
      refundDue
        ? `The customer cancelled. Refund ${lrd(order.finalTotal)} by ${PHARMACY_PAYMENT_LABELS[order.paymentMethod]} to them.`
        : "The customer cancelled this order.",
    );
    return this.orders.findOneByOrFail({ id: order.id });
  }

  /**
   * "Order again": the lines of a past order that this pharmacy can still
   * sell, at today's price, capped at what is in stock. The customer's
   * cart is built from this; nothing is ordered until they check out.
   */
  async reorder(userId: string, orderId: string) {
    const order = await this.customerOrder(userId, orderId);
    const lines = await this.items.find({ where: { orderId: order.id } });
    const ids = lines
      .map((l) => l.productId)
      .filter((id): id is string => !!id);
    const products = ids.length
      ? await this.products.find({
          where: { id: In(ids), pharmacyId: order.pharmacyId, isVisible: true },
        })
      : [];
    const stock = ids.length
      ? await this.inventory.find({ where: { productId: In(ids) } })
      : [];
    const productById = new Map(products.map((p) => [p.id, p]));
    const stockById = new Map(stock.map((s) => [s.productId, s.quantity]));
    return {
      pharmacyId: order.pharmacyId,
      pharmacySlug: order.pharmacy?.slug ?? null,
      lines: lines.map((line) => {
        const product = line.productId
          ? productById.get(line.productId)
          : undefined;
        const inStock = line.productId
          ? (stockById.get(line.productId) ?? 0)
          : 0;
        return {
          productId: product?.id ?? null,
          name: product?.name ?? line.name,
          quantity: product ? Math.min(line.quantity, inStock) : 0,
          previousQuantity: line.quantity,
          price: product ? Number(product.price) : null,
          prescriptionRequired:
            product?.prescriptionRequired ?? line.prescriptionRequired,
          available: Boolean(product) && inStock > 0,
        };
      }),
    };
  }

  // ── Timeline and unread counts on order lists ─────────────────────

  /**
   * Adds each order's timeline (from the audit log) and its count of
   * unread messages from the other side to a list of orders.
   */
  async enrich<T extends { id: string }>(orders: T[], forPharmacy: boolean) {
    if (!orders.length) return [];
    const ids = orders.map((o) => o.id);
    const rx = await this.prescriptions.find({ where: { orderId: In(ids) } });
    const orderByRx = new Map(rx.map((p) => [p.id, p.orderId as string]));
    const targets = [...ids, ...rx.map((p) => p.id)];
    const logs = await this.audits.find({
      where: { targetId: In(targets) },
      order: { createdAt: "ASC" },
    });
    const timelines = new Map<string, PharmacyOrderTimelineEntry[]>();
    for (const log of logs) {
      const orderId =
        log.targetType === "order"
          ? log.targetId
          : orderByRx.get(log.targetId ?? "");
      if (!orderId) continue;
      const entry = timelineEntry(log);
      if (!entry) continue;
      const list = timelines.get(orderId) ?? [];
      list.push(entry);
      timelines.set(orderId, list);
    }
    const unread = await this.messages
      .createQueryBuilder("m")
      .select("m.orderId", "orderId")
      .addSelect("COUNT(*)", "count")
      .where("m.orderId IN (:...ids)", { ids })
      .andWhere("m.readAt IS NULL")
      .andWhere("m.fromPharmacy = :fromOther", { fromOther: !forPharmacy })
      .groupBy("m.orderId")
      .getRawMany<{ orderId: string; count: string }>();
    const unreadById = new Map(unread.map((u) => [u.orderId, Number(u.count)]));
    const rxIds = orders
      .map((o) => (o as { ePrescriptionId?: string | null }).ePrescriptionId)
      .filter(Boolean) as string[];
    const eRx = rxIds.length
      ? ((await this.ePrescriptions?.summaries(rxIds)) ?? new Map())
      : new Map();
    return orders.map((o) => ({
      ...o,
      timeline: timelines.get(o.id) ?? [],
      unreadMessages: unreadById.get(o.id) ?? 0,
      ePrescription:
        eRx.get(
          (o as { ePrescriptionId?: string | null }).ePrescriptionId ?? "",
        ) ?? null,
    }));
  }

  // ── Chat ───────────────────────────────────────────────────────────

  async listMessages(userId: string, orderId: string) {
    const { order, asPharmacy } = await this.participant(userId, orderId);
    // Opening the thread reads everything the other side sent.
    await this.messages.update(
      { orderId: order.id, fromPharmacy: !asPharmacy, readAt: IsNull() },
      { readAt: new Date() },
    );
    const rows = await this.messages.find({
      where: { orderId: order.id },
      order: { createdAt: "ASC" },
    });
    return rows.map((m) => this.present(m, order));
  }

  async sendMessage(userId: string, orderId: string, body: string) {
    const { order, asPharmacy } = await this.participant(userId, orderId);
    const text = body.trim();
    if (!text) throw new BadRequestException("Write a message first");
    const saved = await this.messages.save(
      this.messages.create({
        orderId: order.id,
        senderUserId: userId,
        fromPharmacy: asPharmacy,
        body: text,
      }),
    );
    const preview = text.length > 140 ? `${text.slice(0, 137)}…` : text;
    if (asPharmacy)
      void this.notifier.customer(
        order,
        "pharmacy_order_message.received",
        `${order.pharmacy?.name ?? "The pharmacy"} · ${orderRef(order.id)}`,
        preview,
      );
    else
      void this.notifier.staffOf(
        order.pharmacyId,
        "pharmacy_order_message.received",
        `Message on ${orderRef(order.id)}`,
        preview,
        userId,
      );
    const full = await this.messages.findOneOrFail({ where: { id: saved.id } });
    return this.present(full, order);
  }

  // ── Helpers ────────────────────────────────────────────────────────

  private present(m: PharmacyOrderMessage, order: PharmacyOrder) {
    return {
      id: m.id,
      body: m.body,
      createdAt: m.createdAt,
      readAt: m.readAt,
      fromPharmacy: m.fromPharmacy,
      senderUserId: m.senderUserId,
      // Staff speak as the pharmacy, not as individuals, to the customer.
      senderName: m.fromPharmacy
        ? (order.pharmacy?.name ?? "Pharmacy")
        : (m.sender?.name ?? "Customer"),
    };
  }

  private async participant(userId: string, orderId: string) {
    const order = await this.orders.findOne({ where: { id: orderId } });
    if (!order) throw new NotFoundException("Order not found");
    if (order.customerUserId === userId) return { order, asPharmacy: false };
    const member = await this.staff.findOne({
      where: { userId, pharmacyId: order.pharmacyId, active: true },
    });
    if (!member) throw new NotFoundException("Order not found");
    return { order, asPharmacy: true };
  }

  private async customerOrder(userId: string, orderId: string) {
    const order = await this.orders.findOne({
      where: { id: orderId, customerUserId: userId },
    });
    // Same "don't confirm someone else's order exists" rule as elsewhere.
    if (!order) throw new NotFoundException("Order not found");
    return order;
  }

  private async staffOrder(pharmacyId: string, orderId: string) {
    const order = await this.orders.findOne({
      where: { id: orderId, pharmacyId },
    });
    if (!order) throw new NotFoundException("Order not found in this pharmacy");
    return order;
  }

  private async assertStaff(userId: string, pharmacyId: string) {
    const member = await this.staff.findOne({
      where: { userId, pharmacyId, active: true },
    });
    if (!member)
      throw new ForbiddenException("You are not authorized for this pharmacy");
    return member;
  }

  private log(
    actorUserId: string,
    order: PharmacyOrder,
    action: string,
    metadata: Record<string, unknown> = {},
  ) {
    return this.audits.save(
      this.audits.create({
        actorUserId,
        pharmacyId: order.pharmacyId,
        action,
        targetType: "order",
        targetId: order.id,
        metadata,
      }),
    );
  }
}

/** Audit actions the customer and staff see on an order's timeline. */
function timelineEntry(
  log: PharmacyAuditLog,
): PharmacyOrderTimelineEntry | null {
  const status = (log.metadata?.status as string | undefined) ?? null;
  switch (log.action) {
    case "order.created":
      return { key: "placed", at: log.createdAt };
    case "order.status_changed":
    case "order.cancelled_by_customer":
      return status ? { key: status, at: log.createdAt } : null;
    case "order.restored":
      return { key: "restored", at: log.createdAt };
    case "prescription.accepted":
      return { key: "rx_accepted", at: log.createdAt };
    case "prescription.rejected":
      return { key: "rx_rejected", at: log.createdAt };
    case "prescription.clarification_requested":
      return { key: "rx_clarification", at: log.createdAt };
    case "prescription.resubmitted":
      return { key: "rx_resubmitted", at: log.createdAt };
    case "payment.submitted":
      return { key: "payment_submitted", at: log.createdAt };
    case "payment.confirmed":
      return { key: "payment_confirmed", at: log.createdAt };
    case "payment.failed":
      return { key: "payment_failed", at: log.createdAt };
    case "payment.refunded":
      return { key: "refunded", at: log.createdAt };
    default:
      return null;
  }
}
