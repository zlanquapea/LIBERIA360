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
import { KnowledgeCategory } from "./knowledge-category.entity";

export enum ArticleStatus {
  DRAFT = "draft",
  PUBLISHED = "published",
}

/**
 * A Help Center support article — admin-authored reference content a
 * customer can self-serve from before ever opening a support ticket. This
 * is a brand-new, standalone content type: it has no relationship to
 * SupportTicket/SupportMessage at all (see support/entities), it just
 * happens to live behind the same "Still need help? Contact Support"
 * button on the Help Center UI, which points at the *existing* ticket
 * creation flow rather than introducing a second one.
 */
@Entity("knowledge_articles")
@Index(["categoryId", "status"])
export class KnowledgeArticle {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @ManyToOne(() => KnowledgeCategory, { eager: true })
  @JoinColumn({ name: "category_id" })
  category: KnowledgeCategory;

  @Column({ name: "category_id" })
  categoryId: string;

  @Column({ type: "varchar", length: 200 })
  title: string;

  @Column({ type: "varchar", length: 220, unique: true })
  slug: string;

  @Column({ type: "text" })
  content: string;

  @ManyToOne(() => User, { eager: true })
  @JoinColumn({ name: "author_user_id" })
  author: User;

  @Column({ name: "author_user_id" })
  authorUserId: string;

  @Column({
    type: "enum",
    enum: ArticleStatus,
    default: ArticleStatus.DRAFT,
  })
  status: ArticleStatus;

  @CreateDateColumn({ name: "created_at" })
  createdAt: Date;

  @UpdateDateColumn({ name: "updated_at" })
  updatedAt: Date;
}
