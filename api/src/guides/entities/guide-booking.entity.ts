import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from "typeorm";
import { User } from "../../users/entities/user.entity";
import { decimalTransformer } from "../../database/decimal.transformer";
import { Experience } from "./experience.entity";
import { GuideBookingStatus, GuidePaymentStatus } from "./guide.enums";

@Entity("guide_bookings")
export class GuideBooking {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @ManyToOne(() => Experience, { eager: true, onDelete: "CASCADE" })
  @JoinColumn({ name: "experience_id" })
  experience: Experience;

  @Column({ name: "experience_id" })
  experienceId: string;

  @ManyToOne(() => User, { eager: true, onDelete: "CASCADE" })
  @JoinColumn({ name: "traveler_id" })
  traveler: User;

  @Column({ name: "traveler_id" })
  travelerId: string;

  @Column({ name: "requested_date", type: "date" })
  requestedDate: string;

  @Column({ name: "group_size", type: "smallint" })
  groupSize: number;

  @Column({ type: "text", nullable: true })
  note: string | null;

  @Column({
    type: "enum",
    enum: GuideBookingStatus,
    default: GuideBookingStatus.REQUESTED,
  })
  status: GuideBookingStatus;

  @Column({
    name: "price_usd_snapshot",
    type: "numeric",
    precision: 10,
    scale: 2,
    transformer: decimalTransformer,
  })
  priceUsdSnapshot: number;

  @Column({
    name: "price_lrd_snapshot",
    type: "numeric",
    precision: 12,
    scale: 2,
    nullable: true,
    transformer: decimalTransformer,
  })
  priceLrdSnapshot: number | null;

  @Column({
    name: "payment_status",
    type: "enum",
    enum: GuidePaymentStatus,
    default: GuidePaymentStatus.UNPAID,
  })
  paymentStatus: GuidePaymentStatus;

  @Column({ name: "guide_response", type: "text", nullable: true })
  guideResponse: string | null;

  @Column({ name: "responded_at", type: "timestamptz", nullable: true })
  respondedAt: Date | null;

  @CreateDateColumn({ name: "created_at" })
  createdAt: Date;

  @UpdateDateColumn({ name: "updated_at" })
  updatedAt: Date;
}
