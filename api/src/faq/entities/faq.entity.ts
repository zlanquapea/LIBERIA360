import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from "typeorm";

/**
 * One question/answer pair on the public FAQ accordion — deliberately
 * simpler than KnowledgeArticle (no rich category relation, no author
 * tracking): a FAQ is a short, standalone fact an admin edits directly,
 * not a piece of long-form content someone authored. `category` is a
 * free-text label ("Bookings", "Payments", ...) used only to group the
 * accordion, not a foreign key — keeps this table fully independent of
 * knowledge_categories, which belongs to a different feature (Help
 * Center articles) entirely.
 */
@Entity("faqs")
@Index(["published", "sortOrder"])
export class Faq {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({ type: "varchar", length: 300 })
  question: string;

  @Column({ type: "text" })
  answer: string;

  @Column({ type: "varchar", length: 120, nullable: true })
  category: string | null;

  @Column({ name: "sort_order", type: "int", default: 0 })
  sortOrder: number;

  @Column({ type: "boolean", default: false })
  published: boolean;

  @CreateDateColumn({ name: "created_at" })
  createdAt: Date;

  @UpdateDateColumn({ name: "updated_at" })
  updatedAt: Date;
}
