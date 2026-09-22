import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
} from "typeorm";
import { User } from "../../users/entities/user.entity";
import { GuideBooking } from "./guide-booking.entity";
import { GuideProfile } from "./guide-profile.entity";

@Entity("guide_reviews")
@Unique("UQ_guide_reviews_booking", ["bookingId"])
export class GuideReview {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @ManyToOne(() => GuideBooking, { nullable: true, onDelete: "CASCADE" })
  @JoinColumn({ name: "booking_id" })
  booking: GuideBooking;

  @Column({ name: "booking_id", nullable: true })
  bookingId: string | null;

  @ManyToOne(() => User, { eager: true, onDelete: "CASCADE" })
  @JoinColumn({ name: "traveler_id" })
  traveler: User;

  @Column({ name: "traveler_id" })
  travelerId: string;

  @ManyToOne(() => GuideProfile, { onDelete: "CASCADE" })
  @JoinColumn({ name: "guide_id" })
  guide: GuideProfile;

  @Column({ name: "guide_id" })
  guideId: string;

  @Column({ type: "smallint" })
  rating: number;

  @Column({ type: "text", nullable: true })
  comment: string | null;

  @CreateDateColumn({ name: "created_at" })
  createdAt: Date;
}
