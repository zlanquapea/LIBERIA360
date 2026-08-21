import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from "typeorm";
import { Place } from "../../places/entities/place.entity";
import { User } from "../../users/entities/user.entity";
import { decimalTransformer } from "../../database/decimal.transformer";
import { VerificationStatus } from "../../places/entities/place.enums";
import {
  BusinessReviewStatus,
  BusinessType,
  SubscriptionTier,
} from "./business.enums";

/**
 * Business self-claim record (Tech Spec §5 Business, §3.2 "claim this
 * listing"). Always tied to an existing catalog Place — `location` from the
 * spec's field list is intentionally dropped here since the linked Place
 * already carries structured county/city/lat/lng; a second freeform
 * location string would just be a second, driftable source of truth.
 */
@Entity("businesses")
export class Business {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({ type: "varchar", length: 200 })
  name: string;

  // Server-generated at claim/create time (see BusinessesService.buildSlug)
  // from `name`, deduped with a short suffix on collision — never
  // user-entered, unlike Place.slug (which an admin types by hand). Gives
  // a business its own shareable URL (`/businesses/:slug`) instead of only
  // being reachable embedded in its linked Place's page.
  @Column({ type: "varchar", length: 220, unique: true })
  slug: string;

  @Column({ type: "enum", enum: BusinessType })
  type: BusinessType;

  @ManyToOne(() => User, { eager: true, nullable: true })
  @JoinColumn({ name: "owner_user_id" })
  owner: User | null;

  @Column({ name: "owner_user_id", nullable: true })
  ownerUserId: string | null;

  @ManyToOne(() => Place, { eager: true })
  @JoinColumn({ name: "linked_place_id" })
  linkedPlace: Place;

  @Column({ name: "linked_place_id" })
  linkedPlaceId: string;

  @Column({ type: "varchar", length: 40, nullable: true })
  phone: string | null;

  @Column({ type: "varchar", length: 40, nullable: true })
  whatsapp: string | null;

  @Column({ type: "varchar", length: 255, nullable: true })
  email: string | null;

  @Column({ type: "varchar", length: 255, nullable: true })
  website: string | null;

  @Column({
    name: "social_links",
    type: "text",
    array: true,
    default: () => "'{}'",
  })
  socialLinks: string[];

  @Column({ type: "text", nullable: true })
  description: string | null;

  @Column({ type: "text", array: true, default: () => "'{}'" })
  images: string[];

  // Distinct from `images[0]` — a business may want a square/transparent
  // mark for card/avatar contexts separate from the photos travelers
  // actually browse (rooms, storefront, menu).
  @Column({ name: "logo_image", type: "text", nullable: true })
  logoImage: string | null;

  @Column({ type: "text", array: true, default: () => "'{}'" })
  videos: string[];

  @Column({ name: "opening_hours", type: "text", nullable: true })
  openingHours: string | null;

  @Column({
    name: "price_range_min",
    type: "decimal",
    precision: 10,
    scale: 2,
    nullable: true,
    transformer: decimalTransformer,
  })
  priceRangeMin: number | null;

  @Column({
    name: "price_range_max",
    type: "decimal",
    precision: 10,
    scale: 2,
    nullable: true,
    transformer: decimalTransformer,
  })
  priceRangeMax: number | null;

  // Freeform list ("Airport pickup", "Guided city tour", "Room service") —
  // a lighter-weight alternative to a full CreatorOffering-style entity for
  // Phase 1; a business with genuinely bookable, priced offerings is a
  // later-phase concern (see the deferred business-authored-content task).
  @Column({
    name: "services_offered",
    type: "text",
    array: true,
    default: () => "'{}'",
  })
  servicesOffered: string[];

  @Column({
    name: "review_status",
    type: "enum",
    enum: BusinessReviewStatus,
    default: BusinessReviewStatus.DRAFT,
  })
  reviewStatus: BusinessReviewStatus;

  // Reviewer-facing note — a rejection reason, "changes requested"
  // guidance (UNDER_REVIEW), or a suspension reason, depending on which
  // status it was set alongside. Cleared on APPROVED.
  @Column({ name: "rejection_reason", type: "text", nullable: true })
  rejectionReason: string | null;

  @Column({ name: "submitted_at", type: "timestamptz", nullable: true })
  submittedAt: Date | null;

  @Column({ name: "reviewed_at", type: "timestamptz", nullable: true })
  reviewedAt: Date | null;

  @Column({ name: "reviewed_by_user_id", type: "uuid", nullable: true })
  reviewedByUserId: string | null;

  @Column({
    name: "verification_status",
    type: "enum",
    enum: VerificationStatus,
    default: VerificationStatus.UNVERIFIED,
  })
  verificationStatus: VerificationStatus;

  // Audit trail (Tech Spec §7) — see Place.verifiedByUserId for why this is
  // a plain id, not an eager relation.
  @Column({ name: "verified_by_user_id", type: "uuid", nullable: true })
  verifiedByUserId: string | null;

  @Column({ name: "verified_at", type: "timestamptz", nullable: true })
  verifiedAt: Date | null;

  @Column({
    name: "subscription_tier",
    type: "enum",
    enum: SubscriptionTier,
    default: SubscriptionTier.FREE,
  })
  subscriptionTier: SubscriptionTier;

  @CreateDateColumn({ name: "created_at" })
  createdAt: Date;

  @UpdateDateColumn({ name: "updated_at" })
  updatedAt: Date;
}
