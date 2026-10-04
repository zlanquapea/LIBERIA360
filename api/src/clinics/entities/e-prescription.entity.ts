import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from "typeorm";
import { Pharmacy } from "../../pharmacies/entities/pharmacy.entity";
import { Clinic, DoctorProfile } from "./clinic.entity";
import { EPrescriptionStatus } from "./clinic.enums";

/**
 * A prescription written in the app by a verified doctor. It carries a
 * short code (printed and in the QR) and a secret token (QR only); a
 * pharmacy fills it once, which stops the same paper being used twice.
 */
@Entity("e_prescriptions")
export class EPrescription {
  @PrimaryGeneratedColumn("uuid") id: string;
  @Column({ length: 12, unique: true }) code: string;
  @Column({ name: "verify_token", length: 64, select: false })
  verifyToken: string;
  @Index() @Column({ name: "clinic_id" }) clinicId: string;
  @ManyToOne(() => Clinic, { onDelete: "CASCADE", eager: true })
  @JoinColumn({ name: "clinic_id" })
  clinic: Clinic;
  @Column({ name: "doctor_profile_id" }) doctorProfileId: string;
  @ManyToOne(() => DoctorProfile, { onDelete: "CASCADE", eager: true })
  @JoinColumn({ name: "doctor_profile_id" })
  doctor: DoctorProfile;
  @Index() @Column({ name: "doctor_user_id" }) doctorUserId: string;
  // Null for a patient without a LIBERIA360 account (paper/QR only).
  @Index()
  @Column({ name: "patient_user_id", type: "uuid", nullable: true })
  patientUserId: string | null;
  @Column({ name: "patient_name", length: 150 }) patientName: string;
  @Column({
    name: "patient_phone",
    type: "varchar",
    length: 40,
    nullable: true,
  })
  patientPhone: string | null;
  @Column({ name: "patient_age", type: "smallint", nullable: true })
  patientAge: number | null;
  @Column({ name: "notes_for_pharmacist", type: "text", nullable: true })
  notesForPharmacist: string | null;
  @Column({
    type: "enum",
    enum: EPrescriptionStatus,
    enumName: "e_prescription_status",
    default: EPrescriptionStatus.ISSUED,
  })
  status: EPrescriptionStatus;
  // The pharmacy filling it (counter queue or app order).
  @Index()
  @Column({ name: "pharmacy_id", type: "uuid", nullable: true })
  pharmacyId: string | null;
  @ManyToOne(() => Pharmacy, {
    nullable: true,
    onDelete: "SET NULL",
    eager: true,
  })
  @JoinColumn({ name: "pharmacy_id" })
  pharmacy: Pharmacy | null;
  @Column({ name: "pharmacy_order_id", type: "uuid", nullable: true })
  pharmacyOrderId: string | null;
  @Column({ name: "dispensed_at", type: "timestamptz", nullable: true })
  dispensedAt: Date | null;
  @Column({ name: "dispensed_by_user_id", type: "uuid", nullable: true })
  dispensedByUserId: string | null;
  @Column({ name: "cancelled_reason", type: "text", nullable: true })
  cancelledReason: string | null;
  @Column({ name: "expires_at", type: "timestamptz" }) expiresAt: Date;
  @OneToMany(() => EPrescriptionItem, (item) => item.prescription, {
    cascade: ["insert"],
  })
  items: EPrescriptionItem[];
  @CreateDateColumn({ name: "created_at" }) createdAt: Date;
  @UpdateDateColumn({ name: "updated_at" }) updatedAt: Date;
}

@Entity("e_prescription_items")
export class EPrescriptionItem {
  @PrimaryGeneratedColumn("uuid") id: string;
  @Index() @Column({ name: "prescription_id" }) prescriptionId: string;
  @ManyToOne(() => EPrescription, (p) => p.items, { onDelete: "CASCADE" })
  @JoinColumn({ name: "prescription_id" })
  prescription: EPrescription;
  @Column({ type: "smallint", default: 0 }) position: number;
  @Column({ length: 180 }) medicine: string;
  @Column({ type: "varchar", length: 60, nullable: true }) strength:
    string | null;
  // e.g. "1 tablet 3 times a day"
  @Column({ length: 160 }) dosage: string;
  @Column({ name: "duration_days", type: "smallint", nullable: true })
  durationDays: number | null;
  @Column({ type: "int" }) quantity: number;
  @Column({ type: "varchar", length: 300, nullable: true }) instructions:
    string | null;
  // Picked from the attached pharmacy's catalog while prescribing.
  @Column({ name: "product_id", type: "uuid", nullable: true })
  productId: string | null;
}
