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
import { User } from "../../users/entities/user.entity";
import {
  FulfillmentMethod,
  PaymentStatus,
  PharmacyOrderStatus,
  PrescriptionDecision,
} from "./pharmacy.enums";
import { Pharmacy } from "./pharmacy.entity";
import { PharmacyProduct } from "./product.entity";

@Entity("customer_addresses")
export class CustomerAddress {
  @PrimaryGeneratedColumn("uuid") id: string;
  @Column({ name: "user_id" }) userId: string;
  @ManyToOne(() => User, { onDelete: "CASCADE" })
  @JoinColumn({ name: "user_id" })
  user: User;
  @Column({ length: 80 }) label: string;
  @Column({ type: "text" }) address: string;
  @Column({ length: 80 }) city: string;
  @Column({ type: "varchar", length: 40, nullable: true }) telephone:
    string | null;
  @Column({ default: false }) isDefault: boolean;
}
@Entity("pharmacy_carts")
@Index(["userId", "pharmacyId"], { unique: true })
export class PharmacyCart {
  @PrimaryGeneratedColumn("uuid") id: string;
  @Column({ name: "user_id" }) userId: string;
  @Column({ name: "pharmacy_id" }) pharmacyId: string;
  @ManyToOne(() => Pharmacy, { onDelete: "CASCADE" })
  @JoinColumn({ name: "pharmacy_id" })
  pharmacy: Pharmacy;
  @CreateDateColumn({ name: "created_at" }) createdAt: Date;
}
@Entity("pharmacy_cart_items")
@Index(["cartId", "productId"], { unique: true })
export class PharmacyCartItem {
  @PrimaryGeneratedColumn("uuid") id: string;
  @Column({ name: "cart_id" }) cartId: string;
  @ManyToOne(() => PharmacyCart, { onDelete: "CASCADE" })
  @JoinColumn({ name: "cart_id" })
  cart: PharmacyCart;
  @Column({ name: "product_id" }) productId: string;
  @ManyToOne(() => PharmacyProduct, { eager: true, onDelete: "CASCADE" })
  @JoinColumn({ name: "product_id" })
  product: PharmacyProduct;
  @Column({ type: "int" }) quantity: number;
}

@Entity("pharmacy_orders")
export class PharmacyOrder {
  @PrimaryGeneratedColumn("uuid") id: string;
  @Column({ name: "pharmacy_id" }) pharmacyId: string;
  @ManyToOne(() => Pharmacy, { eager: true })
  @JoinColumn({ name: "pharmacy_id" })
  pharmacy: Pharmacy;
  @Column({ name: "customer_user_id" }) customerUserId: string;
  @ManyToOne(() => User)
  @JoinColumn({ name: "customer_user_id" })
  customer: User;
  @Column({
    type: "enum",
    enum: PharmacyOrderStatus,
    default: PharmacyOrderStatus.PENDING,
  })
  status: PharmacyOrderStatus;
  @Column({ name: "fulfillment_method", type: "enum", enum: FulfillmentMethod })
  fulfillmentMethod: FulfillmentMethod;
  @Column({ name: "delivery_address", type: "text", nullable: true })
  deliveryAddress: string | null;
  @Column({
    name: "product_subtotal",
    type: "decimal",
    precision: 10,
    scale: 2,
  })
  productSubtotal: number;
  @Column({
    name: "delivery_fee",
    type: "decimal",
    precision: 10,
    scale: 2,
    default: 0,
  })
  deliveryFee: number;
  @Column({
    name: "platform_fee",
    type: "decimal",
    precision: 10,
    scale: 2,
    default: 0,
  })
  platformFee: number;
  @Column({ name: "final_total", type: "decimal", precision: 10, scale: 2 })
  finalTotal: number;
  @CreateDateColumn({ name: "created_at" }) createdAt: Date;
  @UpdateDateColumn({ name: "updated_at" }) updatedAt: Date;
}
@Entity("pharmacy_order_items")
export class PharmacyOrderItem {
  @PrimaryGeneratedColumn("uuid") id: string;
  @Column({ name: "order_id" }) orderId: string;
  @ManyToOne(() => PharmacyOrder, { onDelete: "CASCADE" })
  @JoinColumn({ name: "order_id" })
  order: PharmacyOrder;
  @Column({ name: "product_id", type: "uuid", nullable: true }) productId:
    string | null;
  @Column({ length: 180 }) name: string;
  @Column({ name: "unit_price", type: "decimal", precision: 10, scale: 2 })
  unitPrice: number;
  @Column({ type: "int" }) quantity: number;
  @Column({ name: "prescription_required" }) prescriptionRequired: boolean;
}
@Entity("prescriptions")
export class Prescription {
  @PrimaryGeneratedColumn("uuid") id: string;
  // Nullable: a prescription is uploaded *before* checkout (to obtain the
  // prescriptionId the cart submits), so it starts unattached to any order
  // — createOrder() links it once the order it belongs to actually exists.
  @Column({ name: "order_id", type: "uuid", nullable: true }) orderId:
    string | null;
  @ManyToOne(() => PharmacyOrder, { onDelete: "CASCADE", nullable: true })
  @JoinColumn({ name: "order_id" })
  order: PharmacyOrder | null;
  @Column({ name: "customer_user_id" }) customerUserId: string;
  @Column({ name: "pharmacy_id" }) pharmacyId: string;
  @Column({ name: "private_storage_key", type: "text", select: false })
  privateStorageKey: string;
  @Column({ name: "original_filename", length: 255 }) originalFilename: string;
  @Column({ name: "mime_type", length: 60 }) mimeType: string;
  // Bumped by resubmitPrescription() every time the file changes — review()
  // requires the caller's PrescriptionReviewDto.prescriptionVersion to match
  // this before recording a decision, so a pharmacist who opened the file
  // before a resubmission landed can't unknowingly accept/reject bytes they
  // never actually looked at.
  @Column({ type: "int", default: 1 }) version: number;
  @CreateDateColumn({ name: "created_at" }) createdAt: Date;
}
@Entity("prescription_reviews")
export class PrescriptionReview {
  @PrimaryGeneratedColumn("uuid") id: string;
  @Column({ name: "prescription_id" }) prescriptionId: string;
  @Column({ name: "reviewer_user_id" }) reviewerUserId: string;
  @Column({ type: "enum", enum: PrescriptionDecision })
  decision: PrescriptionDecision;
  @Column({ type: "text", nullable: true }) notes: string | null;
  @CreateDateColumn({ name: "created_at" }) createdAt: Date;
}
@Entity("pharmacy_payments")
export class PharmacyPayment {
  @PrimaryGeneratedColumn("uuid") id: string;
  @Column({ name: "order_id", unique: true }) orderId: string;
  @Column({ length: 40, default: "unconfigured" }) provider: string;
  @Column({
    name: "provider_reference",
    type: "varchar",
    length: 255,
    nullable: true,
  })
  providerReference: string | null;
  @Column({ type: "enum", enum: PaymentStatus, default: PaymentStatus.PENDING })
  status: PaymentStatus;
  @Column({ type: "decimal", precision: 10, scale: 2 }) amount: number;
}
@Entity("pharmacy_deliveries")
export class PharmacyDelivery {
  @PrimaryGeneratedColumn("uuid") id: string;
  @Column({ name: "order_id", unique: true }) orderId: string;
  @Column({ type: "text" }) address: string;
  @Column({ name: "driver_name", type: "varchar", length: 120, nullable: true })
  driverName: string | null;
  @Column({ name: "tracking_note", type: "text", nullable: true })
  trackingNote: string | null;
}
@Entity("pharmacy_audit_logs")
export class PharmacyAuditLog {
  @PrimaryGeneratedColumn("uuid") id: string;
  @Column({ name: "actor_user_id", type: "uuid", nullable: true }) actorUserId:
    string | null;
  @Column({ name: "pharmacy_id", type: "uuid", nullable: true }) pharmacyId:
    string | null;
  @Column({ length: 100 }) action: string;
  @Column({ name: "target_type", length: 60 }) targetType: string;
  @Column({ name: "target_id", type: "uuid", nullable: true }) targetId:
    string | null;
  @Column({ type: "jsonb", default: () => "'{}'" }) metadata: Record<
    string,
    unknown
  >;
  @CreateDateColumn({ name: "created_at" }) createdAt: Date;
}
@Entity("pharmacy_reports")
export class PharmacyReport {
  @PrimaryGeneratedColumn("uuid") id: string;
  @Column({ name: "reporter_user_id" }) reporterUserId: string;
  @Column({ name: "pharmacy_id", type: "uuid", nullable: true }) pharmacyId:
    string | null;
  @Column({ name: "product_id", type: "uuid", nullable: true }) productId:
    string | null;
  @Column({ type: "text" }) reason: string;
  @Column({ default: "open", length: 30 }) status: string;
  @CreateDateColumn({ name: "created_at" }) createdAt: Date;
}
