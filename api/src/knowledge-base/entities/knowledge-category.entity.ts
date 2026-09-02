import {
  Column,
  CreateDateColumn,
  Entity,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from "typeorm";
import { KnowledgeArticle } from "./knowledge-article.entity";

/**
 * A Help Center topic grouping ("Bookings", "Accounts", "Payments", ...) —
 * purely organizational, admin-authored, no relation at all to the
 * existing support ticket system (SupportTicketCategory is a separate,
 * unrelated enum on SupportTicket). `sortOrder` drives display order on
 * the Help Center homepage; ties break on `name`.
 */
@Entity("knowledge_categories")
export class KnowledgeCategory {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({ type: "varchar", length: 120 })
  name: string;

  @Column({ type: "varchar", length: 140, unique: true })
  slug: string;

  @Column({ type: "text", nullable: true })
  description: string | null;

  @Column({ name: "sort_order", type: "int", default: 0 })
  sortOrder: number;

  @OneToMany(() => KnowledgeArticle, (article) => article.category)
  articles: KnowledgeArticle[];

  @CreateDateColumn({ name: "created_at" })
  createdAt: Date;

  @UpdateDateColumn({ name: "updated_at" })
  updatedAt: Date;
}
