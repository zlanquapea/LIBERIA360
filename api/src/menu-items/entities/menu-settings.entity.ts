import {
  Column,
  Entity,
  JoinColumn,
  OneToOne,
  PrimaryColumn,
  UpdateDateColumn,
} from "typeorm";
import { Business } from "../../businesses/entities/business.entity";
import type { MenuCurrency } from "./menu-item.enums";
import { decimalTransformer } from "../../database/decimal.transformer";

/** Per-business menu configuration, one row per business with a menu. A
 * business with no row yet reads back the defaults (see
 * MenuItemsService.getSettings) — nothing is written until the owner
 * actually changes something. */
@Entity("menu_settings")
export class MenuSettings {
  @PrimaryColumn({ name: "business_id", type: "uuid" })
  businessId: string;

  @OneToOne(() => Business, { onDelete: "CASCADE" })
  @JoinColumn({ name: "business_id" })
  business: Business;

  // The currency every price on this business's menu is entered in.
  // Liberia runs on both USD and LRD; the public menu shows an estimate in
  // the other one using TravelerInfoSettings.usdToLrdRate.
  @Column({ type: "varchar", length: 3, default: "USD" })
  currency: MenuCurrency;

  // ── Fulfillment ──────────────────────────────────────────────────────
  // At least one of pickup/delivery stays on (enforced in updateSettings).
  @Column({ name: "pickup_enabled", default: true })
  pickupEnabled: boolean;

  @Column({ name: "delivery_enabled", default: false })
  deliveryEnabled: boolean;

  // In the menu's currency. 0 means delivery is free.
  @Column({
    name: "delivery_fee",
    type: "numeric",
    precision: 10,
    scale: 2,
    default: 0,
    transformer: decimalTransformer,
  })
  deliveryFee: number;

  // Orders whose subtotal reaches this get free delivery; null = never.
  @Column({
    name: "free_delivery_minimum",
    type: "numeric",
    precision: 10,
    scale: 2,
    nullable: true,
    transformer: decimalTransformer,
  })
  freeDeliveryMinimum: number | null;

  // Free text shown to customers, e.g. "Sinkor, Congo Town, Paynesville".
  @Column({
    name: "delivery_areas",
    type: "varchar",
    length: 300,
    nullable: true,
  })
  deliveryAreas: string | null;

  // Free text, e.g. "30–45 min".
  @Column({
    name: "delivery_estimate",
    type: "varchar",
    length: 40,
    nullable: true,
  })
  deliveryEstimate: string | null;

  // ── Payment ──────────────────────────────────────────────────────────
  // Pay in cash on delivery / at pickup.
  @Column({ name: "cash_enabled", default: true })
  cashEnabled: boolean;

  // Mobile money works like event tickets: the customer sends the money to
  // this number, then submits the transaction ID for the owner to verify.
  // A method is offered exactly when its number is set.
  @Column({
    name: "mtn_momo_number",
    type: "varchar",
    length: 30,
    nullable: true,
  })
  mtnMomoNumber: string | null;

  @Column({
    name: "orange_money_number",
    type: "varchar",
    length: 30,
    nullable: true,
  })
  orangeMoneyNumber: string | null;

  // The registered name customers should see when sending, so they can
  // confirm they're paying the right person.
  @Column({
    name: "mobile_money_name",
    type: "varchar",
    length: 100,
    nullable: true,
  })
  mobileMoneyName: string | null;

  @UpdateDateColumn({ name: "updated_at" })
  updatedAt: Date;
}
