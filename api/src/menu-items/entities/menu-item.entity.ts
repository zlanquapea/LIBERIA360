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
import { decimalTransformer } from "../../database/decimal.transformer";
import { MenuItemKind, MenuOptionGroup } from "./menu-item.enums";

/**
 * One dish/drink on a business's menu ("Menu" on the public profile) — a
 * restaurant or bar lists what it serves: a photo, the item's name, its
 * price, and any customizations. Orders snapshot an item's name, price,
 * and chosen options at order time (see FoodOrderLineItem), so editing an
 * item here never rewrites a past order.
 *
 * Unlike BusinessContent/CarListing/Advertisement, a menu item never goes
 * through admin review — same reasoning as CreatorOffering: a $6 jollof
 * rice listing carries none of the real-money/safety stakes a car rental
 * or an ad placement does, so gating it behind moderation would only slow
 * an owner down for no real protection gained. `isAvailable` is the
 * owner's own quick "sold out today" toggle — it hides nothing from the
 * database, just how the public menu presents it (see MenuItemsService's
 * doc comment).
 */
@Entity("menu_items")
export class MenuItem {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @ManyToOne(() => Business, { onDelete: "CASCADE" })
  @JoinColumn({ name: "business_id" })
  business: Business;

  @Index()
  @Column({ name: "business_id" })
  businessId: string;

  @Column({ type: "varchar", length: 150 })
  name: string;

  @Column({ type: "text", nullable: true })
  description: string | null;

  @Column({
    type: "numeric",
    precision: 10,
    scale: 2,
    transformer: decimalTransformer,
  })
  price: number;

  // One photo of the dish — uploaded like every other image field in this
  // app (SingleImageUploader → POST /uploads), not a required field: an
  // owner should be able to get a price list up before they have decent
  // food photography.
  @Column({ type: "varchar", length: 500, nullable: true })
  image: string | null;

  // Freeform menu section ("Appetizers", "Mains", "Drinks", "Desserts")
  // rather than a fixed enum — same reasoning as CreatorPortfolioItem.
  // category: what a menu's sections are called varies by cuisine and
  // business far too much for one fixed list to fit everyone. Null groups
  // the item under an "Other" bucket on the public menu.
  @Column({ type: "varchar", length: 60, nullable: true })
  category: string | null;

  // Which top-level tab (Food / Drinks / Desserts) this sits under —
  // `category` above is the finer-grained section within that tab.
  @Column({
    type: "enum",
    enum: MenuItemKind,
    enumName: "menu_items_kind_enum",
    default: MenuItemKind.FOOD,
  })
  kind: MenuItemKind;

  // Badges from MENU_ITEM_TAGS ("popular", "spicy", ...).
  @Column({ type: "text", array: true, default: () => "'{}'" })
  tags: string[];

  // Free text since drinks are sold in every unit imaginable ("330ml",
  // "Glass", "Bottle", "Pitcher").
  @Column({ name: "serving_size", type: "varchar", length: 40, nullable: true })
  servingSize: string | null;

  // Shows an 18+ badge and makes checkout ask the buyer to confirm their
  // age (see FoodOrdersService.create).
  @Column({ name: "contains_alcohol", type: "boolean", default: false })
  containsAlcohol: boolean;

  // Customizations ("Size", "Extras"). Stored inline as jsonb rather than
  // as child tables: they're only ever read and written together with
  // their item, and an order snapshots the chosen ones anyway.
  @Column({ name: "option_groups", type: "jsonb", default: () => "'[]'" })
  optionGroups: MenuOptionGroup[];

  // Owner's "sold out today" toggle — still shown on the public menu
  // (with a Sold out tag) rather than hidden, so a diner planning a visit
  // still sees the full menu and its prices; see MenuItemsService.
  @Column({ name: "is_available", type: "boolean", default: true })
  isAvailable: boolean;

  // Manual ordering within a category, same convention as
  // CreatorOffering.sortOrder/CreatorPortfolioItem.sortOrder.
  @Column({ name: "sort_order", type: "int", default: 0 })
  sortOrder: number;

  @CreateDateColumn({ name: "created_at" })
  createdAt: Date;

  @UpdateDateColumn({ name: "updated_at" })
  updatedAt: Date;
}
