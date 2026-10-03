import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from "typeorm";
import { Business } from "../../businesses/entities/business.entity";
import { User } from "../../users/entities/user.entity";
import { decimalTransformer } from "../../database/decimal.transformer";
import {
  FoodFulfillment,
  FoodOrderStatus,
  FoodPaymentMethod,
  FoodPaymentStatus,
} from "./food-order.enums";
import type { MenuCurrency } from "../../menu-items/entities/menu-item.enums";

/** One line item on a food order, snapshotted at order time — `name` and
 * `unitPrice` are copied from the MenuItem at the moment the order was
 * placed rather than joined live, so a later menu price change or a
 * renamed/removed dish never rewrites what a past order actually charged.
 * `menuItemId` is kept for reference (e.g. "order this again") but the
 * item it points to is allowed to change or disappear afterward. */
export interface FoodOrderLineItem {
  menuItemId: string;
  name: string;
  /** Base price plus every chosen option's priceDelta. */
  unitPrice: string;
  quantity: number;
  /** Absent on orders placed before item options existed. */
  options?: FoodOrderLineOption[];
}

export interface FoodOrderLineOption {
  group: string;
  choice: string;
  priceDelta: string;
}

/**
 * A guest's request to order specific dishes from a restaurant's menu —
 * the same "guest asks, business owner responds" shape as Booking, just
 * with a cart of MenuItems instead of a reservation date. Kept as its own
 * entity rather than bolted onto Booking (whose `requestedDate` and
 * party-size fields are a reservation's shape, not a cart's) the same way
 * EventTicketOrder is kept separate from Booking despite the conceptual
 * overlap — the shape of what's being requested genuinely differs.
 *
 * Always targets exactly one Business (no XOR union the way Booking does
 * for business/creator/carListing — a menu, and therefore an order against
 * it, only ever belongs to a business). `items` and `totalAmount` are
 * computed and snapshotted server-side from the live MenuItem catalog at
 * creation time (see FoodOrdersService.create) — a client never gets to
 * assert its own price for a line item.
 */
@Entity("food_orders")
// One mobile money transaction can only pay for one live order at a time
// at a given restaurant (same guard as event tickets). Declined and
// cancelled orders drop out so a customer can retry with the same ID.
@Index(
  "UQ_food_orders_business_payment_reference",
  ["businessId", "paymentReference"],
  {
    unique: true,
    where:
      "payment_reference IS NOT NULL AND status NOT IN ('declined', 'cancelled')",
  },
)
export class FoodOrder {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @ManyToOne(() => Business, { eager: true, onDelete: "CASCADE" })
  @JoinColumn({ name: "business_id" })
  business: Business;

  @Index()
  @Column({ name: "business_id" })
  businessId: string;

  @ManyToOne(() => User, { eager: true, onDelete: "CASCADE" })
  @JoinColumn({ name: "buyer_user_id" })
  buyer: User;

  @Index()
  @Column({ name: "buyer_user_id" })
  buyerUserId: string;

  @Column({ type: "jsonb" })
  items: FoodOrderLineItem[];

  // Sum of the line items, before delivery.
  @Column({
    type: "numeric",
    precision: 10,
    scale: 2,
    default: 0,
    transformer: decimalTransformer,
  })
  subtotal: number;

  // Snapshotted from MenuSettings at order time; 0 for pickup and for
  // free delivery.
  @Column({
    name: "delivery_fee",
    type: "numeric",
    precision: 10,
    scale: 2,
    default: 0,
    transformer: decimalTransformer,
  })
  deliveryFee: number;

  // subtotal + deliveryFee: what the customer pays.
  @Column({
    name: "total_amount",
    type: "numeric",
    precision: 10,
    scale: 2,
    transformer: decimalTransformer,
  })
  totalAmount: number;

  // Snapshotted from the restaurant's MenuSettings at order time — every
  // price on this order is in this currency.
  @Column({ type: "varchar", length: 3, default: "USD" })
  currency: MenuCurrency;

  @Column({ type: "text", nullable: true })
  notes: string | null;

  @Column({
    type: "enum",
    enum: FoodFulfillment,
    default: FoodFulfillment.PICKUP,
  })
  fulfillment: FoodFulfillment;

  @Column({ name: "delivery_address", type: "text", nullable: true })
  deliveryAddress: string | null;

  // How the restaurant or rider reaches the customer. Required for
  // delivery, optional for pickup.
  @Column({
    name: "contact_phone",
    type: "varchar",
    length: 30,
    nullable: true,
  })
  contactPhone: string | null;

  @Column({
    name: "payment_method",
    type: "enum",
    enum: FoodPaymentMethod,
    default: FoodPaymentMethod.CASH,
  })
  paymentMethod: FoodPaymentMethod;

  @Column({
    name: "payment_status",
    type: "enum",
    enum: FoodPaymentStatus,
    default: FoodPaymentStatus.PAY_ON_DELIVERY,
  })
  paymentStatus: FoodPaymentStatus;

  // Mobile money transaction ID the customer submitted.
  @Column({
    name: "payment_reference",
    type: "varchar",
    length: 100,
    nullable: true,
  })
  paymentReference: string | null;

  // The number the customer was told to pay, kept so the restaurant can
  // see which wallet to check even if they change numbers later.
  @Column({
    name: "payment_account",
    type: "varchar",
    length: 30,
    nullable: true,
  })
  paymentAccount: string | null;

  @Column({
    type: "enum",
    enum: FoodOrderStatus,
    default: FoodOrderStatus.PENDING,
  })
  status: FoodOrderStatus;

  @Column({ name: "business_response", type: "text", nullable: true })
  businessResponse: string | null;

  @Column({ name: "responded_at", type: "timestamptz", nullable: true })
  respondedAt: Date | null;

  @CreateDateColumn({ name: "created_at" })
  createdAt: Date;

  @UpdateDateColumn({ name: "updated_at" })
  updatedAt: Date;
}
