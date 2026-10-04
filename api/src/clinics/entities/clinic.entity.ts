import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from "typeorm";
import { User } from "../../users/entities/user.entity";
import { Pharmacy } from "../../pharmacies/entities/pharmacy.entity";
import {
  ClinicStaffRole,
  ClinicStatus,
  DoctorVerificationStatus,
} from "./clinic.enums";

@Entity("clinics")
export class Clinic {
  @PrimaryGeneratedColumn("uuid") id: string;
  @Index() @Column({ length: 160 }) name: string;
  @Column({ unique: true, length: 180 }) slug: string;
  @Column({ length: 240 }) address: string;
  @Column({ length: 80, default: "Monrovia" }) location: string;
  @Column({ length: 40 }) telephone: string;
  @Column({ type: "text", nullable: true }) about: string | null;
  @Column({ name: "logo_url", type: "varchar", length: 500, nullable: true })
  logoUrl: string | null;
  @Column({ name: "cover_url", type: "varchar", length: 500, nullable: true })
  coverUrl: string | null;
  // Ministry of Health facility licence. Hidden from public reads.
  @Column({
    name: "licence_number",
    type: "varchar",
    length: 120,
    nullable: true,
    select: false,
  })
  licenceNumber: string | null;
  @Column({
    type: "enum",
    enum: ClinicStatus,
    enumName: "clinic_status",
    default: ClinicStatus.PENDING,
  })
  status: ClinicStatus;
  @Column({ name: "status_notes", type: "text", nullable: true })
  statusNotes: string | null;
  // The pharmacy attached to this clinic, where its prescriptions go by
  // default ("ready when you walk out").
  @Column({ name: "pharmacy_id", type: "uuid", nullable: true })
  pharmacyId: string | null;
  @ManyToOne(() => Pharmacy, { nullable: true, onDelete: "SET NULL" })
  @JoinColumn({ name: "pharmacy_id" })
  pharmacy: Pharmacy | null;
  @CreateDateColumn({ name: "created_at" }) createdAt: Date;
  @UpdateDateColumn({ name: "updated_at" }) updatedAt: Date;
}

@Entity("clinic_staff")
@Unique(["clinicId", "userId"])
export class ClinicStaff {
  @PrimaryGeneratedColumn("uuid") id: string;
  @Column({ name: "clinic_id" }) clinicId: string;
  @ManyToOne(() => Clinic, { onDelete: "CASCADE" })
  @JoinColumn({ name: "clinic_id" })
  clinic: Clinic;
  @Index() @Column({ name: "user_id" }) userId: string;
  @ManyToOne(() => User, { onDelete: "CASCADE" })
  @JoinColumn({ name: "user_id" })
  user: User;
  @Column({
    type: "enum",
    enum: ClinicStaffRole,
    enumName: "clinic_staff_role",
  })
  role: ClinicStaffRole;
  @Column({ default: true }) active: boolean;
  @CreateDateColumn({ name: "created_at" }) createdAt: Date;
}

/**
 * A doctor's professional identity, checked by a LIBERIA360 admin against
 * the Liberia Medical and Dental Council register before they can write
 * prescriptions. One per user, shared by every clinic they work at.
 */
@Entity("doctor_profiles")
export class DoctorProfile {
  @PrimaryGeneratedColumn("uuid") id: string;
  @Index({ unique: true }) @Column({ name: "user_id" }) userId: string;
  @ManyToOne(() => User, { onDelete: "CASCADE" })
  @JoinColumn({ name: "user_id" })
  user: User;
  @Column({ name: "full_name", length: 150 }) fullName: string;
  @Column({ length: 120, default: "General practice" }) specialty: string;
  @Column({ name: "licence_number", length: 80 }) licenceNumber: string;
  @Column({ type: "text", nullable: true }) bio: string | null;
  @Column({ name: "photo_url", type: "varchar", length: 500, nullable: true })
  photoUrl: string | null;
  @Column({
    name: "verification_status",
    type: "enum",
    enum: DoctorVerificationStatus,
    enumName: "doctor_verification_status",
    default: DoctorVerificationStatus.PENDING,
  })
  verificationStatus: DoctorVerificationStatus;
  @Column({ name: "verification_notes", type: "text", nullable: true })
  verificationNotes: string | null;
  @Column({ name: "verified_at", type: "timestamptz", nullable: true })
  verifiedAt: Date | null;
  @Column({ name: "verified_by_user_id", type: "uuid", nullable: true })
  verifiedByUserId: string | null;
  @CreateDateColumn({ name: "created_at" }) createdAt: Date;
  @UpdateDateColumn({ name: "updated_at" }) updatedAt: Date;
}
