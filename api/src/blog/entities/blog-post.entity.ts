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

export enum BlogPostStatus {
  DRAFT = "draft",
  PUBLISHED = "published",
}

/**
 * A Blog/Updates post — product announcements, maintenance notices, tips.
 * Deliberately the simplest of the three new content types (no category,
 * no feedback): "Do not build a complicated CMS" per the product ask.
 * `publishedAt` is set once, the first time a post moves to PUBLISHED, and
 * never cleared by a later unpublish — same "don't erase history on a
 * status flip" convention as SupportTicket.resolvedAt/closedAt, just
 * without the "unpublishing clears it back to null" half of that
 * convention, since a post going back to draft doesn't need to look like
 * it was never published.
 */
@Entity("blog_posts")
export class BlogPost {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({ type: "varchar", length: 200 })
  title: string;

  @Column({ type: "varchar", length: 220, unique: true })
  slug: string;

  @Column({ name: "cover_image", type: "varchar", length: 500, nullable: true })
  coverImage: string | null;

  @Column({ type: "text" })
  content: string;

  @ManyToOne(() => User, { eager: true })
  @JoinColumn({ name: "author_user_id" })
  author: User;

  @Column({ name: "author_user_id" })
  authorUserId: string;

  @Column({
    type: "enum",
    enum: BlogPostStatus,
    default: BlogPostStatus.DRAFT,
  })
  status: BlogPostStatus;

  @Column({ name: "published_at", type: "timestamptz", nullable: true })
  publishedAt: Date | null;

  @CreateDateColumn({ name: "created_at" })
  createdAt: Date;

  @UpdateDateColumn({ name: "updated_at" })
  updatedAt: Date;
}
