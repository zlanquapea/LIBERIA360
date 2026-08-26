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
import {
  AdvertisementReviewStatus,
  AdvertisementType,
} from "./advertisement.enums";

/**
 * A self-service, paid marketplace ad slot — "advertise your digital
 * product or business" (a monetization feature, distinct from the
 * catalog's own Place/Business/Creator listings and from
 * SponsoredPlacement, which is an admin-only promotion of an *existing*
 * Place). Any signed-in user can create one for anything they want to
 * advertise; there's no requirement to already have a Business or Place
 * record, since not every advertiser is a tourism-catalog listing.
 *
 * Goes through the same review-gate as a self-submitted Place/Business —
 * SUBMITTED_FOR_REVIEW on creation, not publicly visible or eligible for
 * placement until an admin approves it (see AdvertisementReviewStatus's
 * doc comment). There's no live payment integration yet (same "request
 * to advertise, verified by a human, billed out of band" posture as
 * Booking's deferred payment note) — approving an ad is presently a
 * manual admin decision, same as everything else gated behind human
 * review on this platform.
 */
@Entity("advertisements")
export class Advertisement {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @ManyToOne(() => User, { eager: true, onDelete: "CASCADE" })
  @JoinColumn({ name: "owner_user_id" })
  owner: User;

  @Index()
  @Column({ name: "owner_user_id", type: "uuid" })
  ownerUserId: string;

  @Column({ type: "enum", enum: AdvertisementType })
  type: AdvertisementType;

  @Column({ type: "varchar", length: 200 })
  title: string;

  @Column({ type: "text" })
  description: string;

  // The flyer/product shots — first entry is the primary/cover image
  // shown on the compact "Sponsored" card; the rest render on the ad's
  // own detail view. Same array-of-URLs convention as Business.images.
  @Column({ type: "text", array: true, default: () => "'{}'" })
  images: string[];

  // Free-text price display ("$20", "Starting at $5/mo", "Contact for
  // price") rather than a structured amount — an ad can be for anything
  // from a one-time digital download to an ongoing service, so there's no
  // single currency/unit model worth forcing on every advertiser.
  @Column({ name: "price_label", type: "varchar", length: 100, nullable: true })
  priceLabel: string | null;

  @Column({
    name: "contact_phone",
    type: "varchar",
    length: 40,
    nullable: true,
  })
  contactPhone: string | null;

  @Column({
    name: "contact_whatsapp",
    type: "varchar",
    length: 40,
    nullable: true,
  })
  contactWhatsapp: string | null;

  @Column({
    name: "contact_email",
    type: "varchar",
    length: 200,
    nullable: true,
  })
  contactEmail: string | null;

  // Storefront/landing page/download link — optional; a WhatsApp-only
  // advertiser (the common case in this market) never sets one.
  @Column({
    name: "external_link",
    type: "varchar",
    length: 500,
    nullable: true,
  })
  externalLink: string | null;

  @Column({
    name: "review_status",
    type: "enum",
    enum: AdvertisementReviewStatus,
    default: AdvertisementReviewStatus.DRAFT,
  })
  reviewStatus: AdvertisementReviewStatus;

  // Reviewer-facing note — a rejection reason or a suspension reason,
  // depending on which status it was set alongside. Cleared on APPROVED.
  // Same pattern as Place.rejectionReason/Business.rejectionReason.
  @Column({ name: "rejection_reason", type: "text", nullable: true })
  rejectionReason: string | null;

  @Column({ name: "submitted_at", type: "timestamptz", nullable: true })
  submittedAt: Date | null;

  @Column({ name: "reviewed_at", type: "timestamptz", nullable: true })
  reviewedAt: Date | null;

  @Column({ name: "reviewed_by_user_id", type: "uuid", nullable: true })
  reviewedByUserId: string | null;

  @CreateDateColumn({ name: "created_at" })
  createdAt: Date;

  @UpdateDateColumn({ name: "updated_at" })
  updatedAt: Date;
}
