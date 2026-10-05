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
import { Clinic, DoctorProfile } from "./clinic.entity";
import {
  ConsultationOutcome,
  ConsultationPaymentMethod,
  ConsultationPaymentStatus,
  ConsultationStatus,
} from "./clinic.enums";

const money = {
  to: (v: number) => v,
  from: (v: string | null) => (v == null ? null : Number(v)),
};

/** A patient's paid online consultation with a verified doctor. */
@Entity("consultations")
export class Consultation {
  @PrimaryGeneratedColumn("uuid") id: string;
  @Column({ name: "clinic_id" }) clinicId: string;
  @ManyToOne(() => Clinic, { onDelete: "CASCADE", eager: true })
  @JoinColumn({ name: "clinic_id" })
  clinic: Clinic;
  @Column({ name: "doctor_profile_id" }) doctorProfileId: string;
  @ManyToOne(() => DoctorProfile, { onDelete: "CASCADE", eager: true })
  @JoinColumn({ name: "doctor_profile_id" })
  doctor: DoctorProfile;
  @Index() @Column({ name: "doctor_user_id" }) doctorUserId: string;
  @Index() @Column({ name: "patient_user_id" }) patientUserId: string;
  @ManyToOne(() => User, { onDelete: "CASCADE" })
  @JoinColumn({ name: "patient_user_id" })
  patient: User;
  @Column({ name: "patient_name", length: 150 }) patientName: string;
  @Column({ name: "patient_age", type: "smallint", nullable: true })
  patientAge: number | null;
  @Column({ type: "text" }) reason: string;
  @Column({
    name: "symptoms_since",
    type: "varchar",
    length: 60,
    nullable: true,
  })
  symptomsSince: string | null;
  // When the patient confirmed none of the emergency signs apply.
  @Column({ name: "triage_confirmed_at", type: "timestamptz" })
  triageConfirmedAt: Date;
  @Column({
    type: "enum",
    enum: ConsultationStatus,
    enumName: "consultation_status",
    default: ConsultationStatus.REQUESTED,
  })
  status: ConsultationStatus;
  @Column({ type: "decimal", precision: 10, scale: 2, transformer: money })
  fee: number;
  @Column({
    name: "payment_method",
    type: "enum",
    enum: ConsultationPaymentMethod,
    enumName: "consultation_payment_method",
  })
  paymentMethod: ConsultationPaymentMethod;
  @Column({ name: "payment_reference", type: "varchar", length: 80 })
  paymentReference: string;
  @Column({
    name: "payment_account",
    type: "varchar",
    length: 40,
    nullable: true,
  })
  paymentAccount: string | null;
  @Column({
    name: "payment_status",
    type: "enum",
    enum: ConsultationPaymentStatus,
    enumName: "consultation_payment_status",
    default: ConsultationPaymentStatus.AWAITING_VERIFICATION,
  })
  paymentStatus: ConsultationPaymentStatus;
  @Column({ name: "accepted_at", type: "timestamptz", nullable: true })
  acceptedAt: Date | null;
  @Column({ name: "completed_at", type: "timestamptz", nullable: true })
  completedAt: Date | null;
  @Column({
    type: "enum",
    enum: ConsultationOutcome,
    enumName: "consultation_outcome",
    nullable: true,
  })
  outcome: ConsultationOutcome | null;
  // The doctor's advice, shown to the patient when the consult closes.
  @Column({ type: "text", nullable: true }) summary: string | null;
  @Column({ name: "decline_reason", type: "text", nullable: true })
  declineReason: string | null;
  @Column({ name: "e_prescription_id", type: "uuid", nullable: true })
  ePrescriptionId: string | null;
  @CreateDateColumn({ name: "created_at" }) createdAt: Date;
  @UpdateDateColumn({ name: "updated_at" }) updatedAt: Date;
}

/** A text or voice message in a consultation. */
@Entity("consultation_messages")
export class ConsultationMessage {
  @PrimaryGeneratedColumn("uuid") id: string;
  @Index() @Column({ name: "consultation_id" }) consultationId: string;
  @ManyToOne(() => Consultation, { onDelete: "CASCADE" })
  @JoinColumn({ name: "consultation_id" })
  consultation: Consultation;
  @Column({ name: "sender_user_id" }) senderUserId: string;
  @Column({ name: "from_doctor", default: false }) fromDoctor: boolean;
  @Column({ type: "text", nullable: true }) body: string | null;
  // Voice notes live in private storage and are streamed after an
  // authorization check; the key never leaves the server.
  @Column({ name: "voice_key", type: "text", nullable: true, select: false })
  voiceKey: string | null;
  @Column({ name: "voice_mime", type: "varchar", length: 60, nullable: true })
  voiceMime: string | null;
  @Column({ name: "voice_seconds", type: "smallint", nullable: true })
  voiceSeconds: number | null;
  @Column({ name: "read_at", type: "timestamptz", nullable: true })
  readAt: Date | null;
  @CreateDateColumn({ name: "created_at" }) createdAt: Date;
}
