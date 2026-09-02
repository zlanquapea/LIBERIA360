import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from "typeorm";
import { KnowledgeArticle } from "./knowledge-article.entity";

/**
 * One "Was this article helpful?" vote — anonymous and append-only, same
 * shape as AnalyticsEvent's view log: no identity is required to read the
 * Help Center, so none is required to answer this. Multiple votes per
 * visitor are possible (there is nothing to key a dedupe off of without
 * requiring login just to click Yes/No, which would defeat the point of a
 * frictionless self-serve helpfulness signal) — the frontend keeps its own
 * "already voted on this article" flag in localStorage to keep the button
 * from re-firing, but that is a UX nicety, not a server-enforced
 * constraint.
 */
@Entity("article_feedback")
@Index(["articleId", "createdAt"])
export class ArticleFeedback {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @ManyToOne(() => KnowledgeArticle, { onDelete: "CASCADE" })
  @JoinColumn({ name: "article_id" })
  article: KnowledgeArticle;

  @Column({ name: "article_id" })
  articleId: string;

  @Column({ type: "boolean" })
  helpful: boolean;

  @CreateDateColumn({ name: "created_at" })
  createdAt: Date;
}
