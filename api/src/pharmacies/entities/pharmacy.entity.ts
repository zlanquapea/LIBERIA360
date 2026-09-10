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
import { PharmacyStaffRole, PharmacyStatus } from "./pharmacy.enums";

@Entity("pharmacies")
export class Pharmacy {
  @PrimaryGeneratedColumn("uuid") id: string;
  @Index() @Column({ length: 160 }) name: string;
  @Column({ unique: true, length: 180 }) slug: string;
  @Column({ length: 240 }) address: string;
  @Column({ length: 80, default: "Monrovia" }) location: string;
  @Column({ length: 40 }) telephone: string;
  @Column({ name: "logo_url", type: "varchar", length: 500, nullable: true })
  logoUrl: string | null;
  @Column({ name: "cover_url", type: "varchar", length: 500, nullable: true })
  coverUrl: string | null;
  @Column({ type: "decimal", precision: 9, scale: 6, nullable: true })
  latitude: number | null;
  @Column({ type: "decimal", precision: 9, scale: 6, nullable: true })
  longitude: number | null;
  @Column({ name: "pickup_enabled", default: true }) pickupEnabled: boolean;
  @Column({ name: "delivery_enabled", default: false })
  deliveryEnabled: boolean;
  @Column({
    name: "delivery_fee",
    type: "decimal",
    precision: 10,
    scale: 2,
    default: 0,
  })
  deliveryFee: number;
  @Column({
    type: "enum",
    enum: PharmacyStatus,
    default: PharmacyStatus.PENDING,
  })
  status: PharmacyStatus;
  @Column({
    name: "licence_number",
    type: "varchar",
    length: 100,
    nullable: true,
    select: false,
  })
  licenceNumber: string | null;
  @Column({
    name: "licence_document_key",
    type: "text",
    nullable: true,
    select: false,
  })
  licenceDocumentKey: string | null;
  @Column({ name: "sponsored", default: false }) sponsored: boolean;
  @CreateDateColumn({ name: "created_at" }) createdAt: Date;
  @UpdateDateColumn({ name: "updated_at" }) updatedAt: Date;
}

@Entity("pharmacy_staff")
@Index(["pharmacyId", "userId"], { unique: true })
export class PharmacyStaff {
  @PrimaryGeneratedColumn("uuid") id: string;
  @Column({ name: "pharmacy_id" }) pharmacyId: string;
  @ManyToOne(() => Pharmacy, { onDelete: "CASCADE" })
  @JoinColumn({ name: "pharmacy_id" })
  pharmacy: Pharmacy;
  @Column({ name: "user_id" }) userId: string;
  @ManyToOne(() => User, { onDelete: "CASCADE" })
  @JoinColumn({ name: "user_id" })
  user: User;
  @Column({
    type: "enum",
    enum: PharmacyStaffRole,
    default: PharmacyStaffRole.EMPLOYEE,
  })
  role: PharmacyStaffRole;
  @Column({ default: true }) active: boolean;
}

@Entity("pharmacy_opening_hours")
@Index(["pharmacyId", "dayOfWeek"], { unique: true })
export class PharmacyOpeningHours {
  @PrimaryGeneratedColumn("uuid") id: string;
  @Column({ name: "pharmacy_id" }) pharmacyId: string;
  @ManyToOne(() => Pharmacy, { onDelete: "CASCADE" })
  @JoinColumn({ name: "pharmacy_id" })
  pharmacy: Pharmacy;
  @Column({ name: "day_of_week", type: "smallint" }) dayOfWeek: number;
  @Column({ name: "opens_at", type: "time", nullable: true }) opensAt:
    string | null;
  @Column({ name: "closes_at", type: "time", nullable: true }) closesAt:
    string | null;
  @Column({ name: "is_closed", default: false }) isClosed: boolean;
}

@Entity("pharmacy_verifications")
export class PharmacyVerification {
  @PrimaryGeneratedColumn("uuid") id: string;
  @Column({ name: "pharmacy_id" }) pharmacyId: string;
  @ManyToOne(() => Pharmacy, { onDelete: "CASCADE" })
  @JoinColumn({ name: "pharmacy_id" })
  pharmacy: Pharmacy;
  @Column({ type: "enum", enum: PharmacyStatus }) decision: PharmacyStatus;
  @Column({ name: "reviewer_user_id" }) reviewerUserId: string;
  @Column({ type: "text", nullable: true }) notes: string | null;
  @CreateDateColumn({ name: "created_at" }) createdAt: Date;
}
