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
import { Category } from "../../categories/entities/category.entity";
import { County } from "../../counties/entities/county.entity";
import { Activity } from "../../activities/entities/activity.entity";
import { User } from "../../users/entities/user.entity";
import { decimalTransformer } from "../../database/decimal.transformer";
import {
  PlaceReviewStatus,
  PlaceType,
  RecommendedVisitLength,
  VerificationStatus,
} from "./place.enums";
import { OpeningPeriod } from "../opening-hours";

/**
 * Core catalog entity. Every place renders through one standardized profile
 * template (Tech Spec §4.2) so the catalog stays consistent past hundreds of
 * entries. Field set mirrors the data model in Tech Spec §5.
 */
@Entity("places")
@Index(["countyId"])
@Index(["categoryId"])
export class Place {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({ type: "varchar", length: 200 })
  name: string;

  @Column({ type: "varchar", length: 220, unique: true })
  slug: string;

  @Column({ type: "text" })
  description: string;

  @Column({ type: "enum", enum: PlaceType })
  type: PlaceType;

  @ManyToOne(() => Category, { eager: true, nullable: false })
  @JoinColumn({ name: "category_id" })
  category: Category;

  @Column({ name: "category_id" })
  categoryId: string;

  @Column({ type: "text", array: true, default: () => "'{}'" })
  tags: string[];

  @ManyToOne(() => County, { eager: true, nullable: false })
  @JoinColumn({ name: "county_id" })
  county: County;

  @Column({ name: "county_id" })
  countyId: string;

  @Column({ type: "varchar", length: 150 })
  city: string;

  @Column({
    type: "decimal",
    precision: 9,
    scale: 6,
    transformer: decimalTransformer,
  })
  latitude: number;

  @Column({
    type: "decimal",
    precision: 9,
    scale: 6,
    transformer: decimalTransformer,
  })
  longitude: number;

  @Column({
    name: "distance_from_monrovia_km",
    type: "decimal",
    precision: 6,
    scale: 1,
    nullable: true,
    transformer: decimalTransformer,
  })
  distanceFromMonroviaKm: number | null;

  @Column({
    name: "recommended_visit_length",
    type: "enum",
    enum: RecommendedVisitLength,
    nullable: true,
  })
  recommendedVisitLength: RecommendedVisitLength | null;

  @Column({
    name: "estimated_cost_entry",
    type: "decimal",
    precision: 10,
    scale: 2,
    nullable: true,
    transformer: decimalTransformer,
  })
  estimatedCostEntry: number | null;

  @Column({
    name: "estimated_cost_guide",
    type: "decimal",
    precision: 10,
    scale: 2,
    nullable: true,
    transformer: decimalTransformer,
  })
  estimatedCostGuide: number | null;

  @Column({
    name: "estimated_cost_transport",
    type: "decimal",
    precision: 10,
    scale: 2,
    nullable: true,
    transformer: decimalTransformer,
  })
  estimatedCostTransport: number | null;

  @Column({ type: "text", array: true, default: () => "'{}'" })
  images: string[];

  @Column({ type: "text", array: true, default: () => "'{}'" })
  videos: string[];

  @Column({ name: "opening_hours", type: "text", nullable: true })
  openingHours: string | null;

  // Computed from openingHours by parseOpeningHoursText (opening-hours.ts)
  // whenever it's set/changed — see that file's doc comment for why this
  // exists alongside the free text rather than replacing it. Never set
  // directly from a DTO field; null means "couldn't parse it" just as much
  // as "never set."
  @Column({ name: "structured_hours", type: "jsonb", nullable: true })
  structuredHours: OpeningPeriod[] | null;

  @Column({
    name: "contact_phone",
    type: "varchar",
    length: 40,
    nullable: true,
  })
  contactPhone: string | null;

  @Column({ type: "varchar", length: 40, nullable: true })
  whatsapp: string | null;

  @Column({ type: "varchar", length: 255, nullable: true })
  website: string | null;

  @Column({ type: "varchar", length: 100, nullable: true })
  instagram: string | null;

  @Column({ type: "varchar", length: 100, nullable: true })
  facebook: string | null;

  @Column({
    type: "decimal",
    precision: 2,
    scale: 1,
    default: 0,
    transformer: decimalTransformer,
  })
  rating: number;

  @Column({ name: "review_count", type: "int", default: 0 })
  reviewCount: number;

  @Column({
    name: "verification_status",
    type: "enum",
    enum: VerificationStatus,
    default: VerificationStatus.UNVERIFIED,
  })
  verificationStatus: VerificationStatus;

  // Audit trail (Tech Spec §7 — "who verified what and when"). A plain FK
  // id, not a relation, deliberately: Place is embedded (directly or via
  // Business/Review/Event/Itinerary) in nearly every response in the app,
  // and a full eager User relation here would mean auditing every one of
  // those response paths for a passwordHash leak. An id is enough for an
  // admin to cross-reference.
  @Column({ name: "verified_by_user_id", type: "uuid", nullable: true })
  verifiedByUserId: string | null;

  @Column({ name: "verified_at", type: "timestamptz", nullable: true })
  verifiedAt: Date | null;

  @Column({ type: "boolean", default: false })
  featured: boolean;

  // Who submitted this place, if it didn't come from an admin — null for
  // every admin-authored catalog entry (the overwhelming majority; see
  // PlaceReviewStatus's doc comment). Not `eager`, unlike Business.owner —
  // Place is embedded in nearly every response in the app (Business,
  // Review, Event, Booking, itinerary stops, ...), and an eager User
  // relation here would mean auditing every one of those response paths
  // for a passwordHash leak. Only the one admin query that actually needs
  // it (AdminContentService.findPlaces/findPlaceById) joins it explicitly;
  // everywhere else just gets `ownerUserId`, an id to cross-reference.
  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: "owner_user_id" })
  owner: User | null;

  @Column({ name: "owner_user_id", type: "uuid", nullable: true })
  ownerUserId: string | null;

  @Column({
    name: "review_status",
    type: "enum",
    enum: PlaceReviewStatus,
    default: PlaceReviewStatus.APPROVED,
  })
  reviewStatus: PlaceReviewStatus;

  // Reviewer-facing note — a rejection reason, "changes requested"
  // guidance (UNDER_REVIEW), or a suspension reason, depending on which
  // status it was set alongside. Cleared on APPROVED. See
  // Business.rejectionReason for the identical pattern.
  @Column({ name: "rejection_reason", type: "text", nullable: true })
  rejectionReason: string | null;

  @Column({ name: "submitted_at", type: "timestamptz", nullable: true })
  submittedAt: Date | null;

  @Column({ name: "reviewed_at", type: "timestamptz", nullable: true })
  reviewedAt: Date | null;

  @Column({ name: "reviewed_by_user_id", type: "uuid", nullable: true })
  reviewedByUserId: string | null;

  @OneToMany(() => Activity, (activity) => activity.place)
  activities: Activity[];

  @CreateDateColumn({ name: "created_at" })
  createdAt: Date;

  @UpdateDateColumn({ name: "updated_at" })
  updatedAt: Date;
}
