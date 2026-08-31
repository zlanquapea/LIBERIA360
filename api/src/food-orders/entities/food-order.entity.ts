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
import { FoodOrderStatus } from "./food-order.enums";

/** One line item on a food order, snapshotted at order time — `name` and
 * `unitPrice` are copied from the MenuItem at the moment the order was
 * placed rather than joined live, so a later menu price change or a
 * renamed/removed dish never rewrites what a past order actually charged.
 * `menuItemId` is kept for reference (e.g. "order this again") but the
 * item it points to is allowed to change or disappear afterward. */
export interface FoodOrderLineItem {
  menuItemId: string;
  name: string;
  unitPrice: string;
  quantity: number;
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

  @Column({
    name: "total_amount",
    type: "numeric",
    precision: 10,
    scale: 2,
    transformer: decimalTransformer,
  })
  totalAmount: number;

  @Column({ type: "text", nullable: true })
  notes: string | null;

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
