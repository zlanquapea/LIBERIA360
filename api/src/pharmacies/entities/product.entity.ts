import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
  Relation,
} from "typeorm";
import { Pharmacy } from "./pharmacy.entity";

@Entity("pharmacy_product_categories")
export class PharmacyProductCategory {
  @PrimaryGeneratedColumn("uuid") id: string;
  @Column({ unique: true, length: 100 }) name: string;
  @Column({ unique: true, length: 100 }) slug: string;
}

@Entity("pharmacy_products")
@Index(["pharmacyId", "name"])
export class PharmacyProduct {
  @PrimaryGeneratedColumn("uuid") id: string;
  @Column({ name: "pharmacy_id" }) pharmacyId: string;
  @ManyToOne(() => Pharmacy, { onDelete: "CASCADE" })
  @JoinColumn({ name: "pharmacy_id" })
  pharmacy: Pharmacy;
  @Column({ name: "category_id" }) categoryId: string;
  @ManyToOne(() => PharmacyProductCategory)
  @JoinColumn({ name: "category_id" })
  category: PharmacyProductCategory;
  @Column({ length: 180 }) name: string;
  @Column({ name: "image_url", type: "varchar", length: 500, nullable: true })
  imageUrl: string | null;
  @Column({ type: "decimal", precision: 10, scale: 2 }) price: number;
  @Column({ name: "prescription_required", default: false })
  prescriptionRequired: boolean;
  @Column({ name: "is_visible", default: true }) isVisible: boolean;
  @OneToOne(() => PharmacyInventory, (inventory) => inventory.product, {
    eager: true,
  })
  inventory: Relation<PharmacyInventory>;
  @CreateDateColumn({ name: "created_at" }) createdAt: Date;
  @UpdateDateColumn({ name: "updated_at" }) updatedAt: Date;
}

@Entity("pharmacy_inventory")
export class PharmacyInventory {
  @PrimaryGeneratedColumn("uuid") id: string;
  @Column({ name: "product_id", unique: true }) productId: string;
  @OneToOne(() => PharmacyProduct, (product) => product.inventory, {
    onDelete: "CASCADE",
  })
  @JoinColumn({ name: "product_id" })
  product: Relation<PharmacyProduct>;
  @Column({ type: "int", default: 0 }) quantity: number;
  @UpdateDateColumn({ name: "updated_at" }) updatedAt: Date;
}
