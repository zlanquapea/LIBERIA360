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

  @UpdateDateColumn({ name: "updated_at" })
  updatedAt: Date;
}
