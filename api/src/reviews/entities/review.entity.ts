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

/**
 * Review sub-scores per Tech Spec §3.2 / Business Plan: experience,
 * accessibility, cleanliness, value, safety, service — all optional,
 * `overallRating` is the only required score.
 */
@Entity("reviews")
@Unique(["userId", "placeId"]) // one review per user per place — edit, don't spam
export class Review {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @ManyToOne(() => User, { onDelete: "CASCADE" })
  @JoinColumn({ name: "user_id" })
  user: User;

  @Index()
  @Column({ name: "user_id" })
  userId: string;

  @ManyToOne(() => Place, { onDelete: "CASCADE" })
  @JoinColumn({ name: "place_id" })
  place: Place;

  @Index()
  @Column({ name: "place_id" })
  placeId: string;

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

  // Phase 1 has no booking/check-in data to verify a visit against, so this
  // stays false unless an admin sets it later — not auto-computed.
  @Column({ name: "verified_visit", type: "boolean", default: false })
  verifiedVisit: boolean;

  @CreateDateColumn({ name: "created_at" })
  createdAt: Date;

  @UpdateDateColumn({ name: "updated_at" })
  updatedAt: Date;
}
