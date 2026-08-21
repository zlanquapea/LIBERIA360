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
import { Place } from "../../places/entities/place.entity";
import { User } from "../../users/entities/user.entity";
import { Creator } from "../../creators/entities/creator.entity";

/**
 * Review sub-scores per Tech Spec §3.2 / Business Plan: experience,
 * accessibility, cleanliness, value, safety, service — all optional,
 * `overallRating` is the only required score.
 *
 * A review targets either a Place or a Creator, never both — enforced at
 * the service layer (ReviewsService.create), not a DB CHECK constraint.
 * Both FK columns are nullable so a single `reviews` table serves both; the two
 * @Unique constraints below still work as "one review per user per
 * target" because Postgres treats NULL as distinct from NULL — a
 * creator-targeted review (placeId NULL) never collides with another
 * creator-targeted review on the (userId, placeId) constraint, and vice
 * versa for (userId, creatorId).
 */
@Entity("reviews")
@Unique(["userId", "placeId"]) // one review per user per place — edit, don't spam
@Unique(["userId", "creatorId"]) // same, for creator-targeted reviews
export class Review {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @ManyToOne(() => User, { onDelete: "CASCADE" })
  @JoinColumn({ name: "user_id" })
  user: User;

  @Index()
  @Column({ name: "user_id" })
  userId: string;

  @ManyToOne(() => Place, { onDelete: "CASCADE", nullable: true })
  @JoinColumn({ name: "place_id" })
  place: Place | null;

  @Index()
  @Column({ name: "place_id", nullable: true })
  placeId: string | null;

  @ManyToOne(() => Creator, { onDelete: "CASCADE", nullable: true })
  @JoinColumn({ name: "creator_id" })
  creator: Creator | null;

  @Index()
  @Column({ name: "creator_id", nullable: true })
  creatorId: string | null;

  @Column({ name: "overall_rating", type: "smallint" })
  overallRating: number;

  @Column({ name: "experience_rating", type: "smallint", nullable: true })
  experienceRating: number | null;

  @Column({ name: "accessibility_rating", type: "smallint", nullable: true })
  accessibilityRating: number | null;

  @Column({ name: "cleanliness_rating", type: "smallint", nullable: true })
  cleanlinessRating: number | null;

  @Column({ name: "value_rating", type: "smallint", nullable: true })
  valueRating: number | null;

  @Column({ name: "safety_rating", type: "smallint", nullable: true })
  safetyRating: number | null;

  @Column({ name: "service_rating", type: "smallint", nullable: true })
  serviceRating: number | null;

  @Column({ type: "text", nullable: true })
  comment: string | null;

  @Column({ type: "text", array: true, default: () => "'{}'" })
  photos: string[];

  // Auto-computed at creation time (see ReviewsService.hasConfirmedBooking)
  // from whether the reviewer has a confirmed Booking with a business
  // linked to this place — Phase 1 had no booking data to verify a visit
  // against, so this stayed permanently false until Phase 3's Bookings
  // module existed to compute it from. Same loose "verified" semantics as
  // Amazon's Verified Purchase / Booking.com's Verified stay: a real
  // engagement signal, not a gate on who's allowed to review — most of the
  // catalog (plain attractions, no bookable business behind them) has no
  // way to ever earn this, and that's fine, reviews stay open regardless.
  @Column({ name: "verified_visit", type: "boolean", default: false })
  verifiedVisit: boolean;

  @CreateDateColumn({ name: "created_at" })
  createdAt: Date;

  @UpdateDateColumn({ name: "updated_at" })
  updatedAt: Date;
}
