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
import { Business } from "../../businesses/entities/business.entity";
import {
  BusinessContentStatus,
  BusinessContentType,
} from "./business-content.enums";

/**
 * Business-authored publishable content — offers, announcements,
 * articles, travel tips, new-experience posts. Deferred from Business
 * Profiles Phase 1 as its own subsystem (a new content type + moderation
 * queue, not a Business-entity change); this is that phase.
 *
 * Goes through the same "not live until approved" gate as a Business
 * listing itself (see BusinessReviewStatus's doc comment on the
 * businesses module) — a business's own trust/verification status has no
 * bearing on whether an individual post it authors is appropriate;
 * moderation happens per-item.
 */
@Entity("business_content")
export class BusinessContent {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @ManyToOne(() => Business, { onDelete: "CASCADE" })
  @JoinColumn({ name: "business_id" })
  business: Business;

  @Index()
  @Column({ name: "business_id" })
  businessId: string;

  @Column({ type: "enum", enum: BusinessContentType })
  type: BusinessContentType;

  @Column({ type: "varchar", length: 200 })
  title: string;

  @Column({ type: "text" })
  body: string;

  @Column({ type: "text", array: true, default: () => "'{}'" })
  images: string[];

  // Booking/reservation/more-info link — optional, relevant mainly to an
  // offer or experience post (a travel tip or article usually has none).
  @Column({
    name: "external_link",
    type: "varchar",
    length: 500,
    nullable: true,
  })
  externalLink: string | null;

  // Only meaningful for a time-boxed OFFER — null on every other type.
  // Not enforced at the DB level (an article with a "validity window"
  // isn't a data-integrity problem worth a CHECK constraint over), just
  // left null when irrelevant.
  @Column({ name: "valid_from", type: "timestamptz", nullable: true })
  validFrom: Date | null;

  @Column({ name: "valid_until", type: "timestamptz", nullable: true })
  validUntil: Date | null;

  @Column({
    type: "enum",
    enum: BusinessContentStatus,
    default: BusinessContentStatus.DRAFT,
  })
  status: BusinessContentStatus;

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
