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
import { Creator } from "../../creators/entities/creator.entity";
import { CreatorGuideStatus } from "./creator-guide.enums";

/** One place in a guide, in reading order, with the creator's note about
 * it. `day` lets a guide double as a multi-day itinerary. */
export interface CreatorGuideStop {
  placeId: string;
  day: number;
  note: string | null;
}

/** A local creator's guide to a set of real places — "my favourite
 * Robertsport weekend", "where I eat in Sinkor". Published only after
 * moderation, always attributed to its creator, and its cover/video are
 * only used once the creator confirms they have the right to share them. */
@Entity("creator_guides")
@Index(["status", "publishedAt"])
export class CreatorGuide {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @ManyToOne(() => Creator, { eager: true, onDelete: "CASCADE" })
  @JoinColumn({ name: "creator_id" })
  creator: Creator;

  @Index()
  @Column({ name: "creator_id" })
  creatorId: string;

  @Column({ type: "varchar", length: 150 })
  title: string;

  @Column({ type: "varchar", length: 170, unique: true })
  slug: string;

  @Column({ type: "text" })
  summary: string;

  @Column({ name: "cover_image", type: "varchar", length: 500, nullable: true })
  coverImage: string | null;

  // A YouTube/Vimeo link or an uploaded video. Loaded only when a visitor
  // asks to play it.
  @Column({ name: "video_url", type: "varchar", length: 500, nullable: true })
  videoUrl: string | null;

  @Column({ type: "jsonb", default: () => "'[]'" })
  stops: CreatorGuideStop[];

  @Column({
    type: "enum",
    enum: CreatorGuideStatus,
    default: CreatorGuideStatus.DRAFT,
  })
  status: CreatorGuideStatus;

  @Column({ name: "rejection_reason", type: "text", nullable: true })
  rejectionReason: string | null;

  // When the creator confirmed they own, or have permission to share,
  // the guide's photos and video. Required before submitting.
  @Column({
    name: "media_permission_confirmed_at",
    type: "timestamptz",
    nullable: true,
  })
  mediaPermissionConfirmedAt: Date | null;

  @Column({ name: "published_at", type: "timestamptz", nullable: true })
  publishedAt: Date | null;

  @Column({ name: "reviewed_by_user_id", type: "uuid", nullable: true })
  reviewedByUserId: string | null;

  @CreateDateColumn({ name: "created_at", type: "timestamptz" })
  createdAt: Date;

  @UpdateDateColumn({ name: "updated_at", type: "timestamptz" })
  updatedAt: Date;
}
