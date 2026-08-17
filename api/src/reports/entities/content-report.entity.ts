import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
} from "typeorm";
import { User } from "../../users/entities/user.entity";
import { ReportReason, ReportTargetType } from "./content-report.enums";

/**
 * User-triggered "report this" flag on a review or event — the piece the
 * admin moderation queue was missing: `GET /admin/moderation-queue`
 * already surfaces recent reviews and (via PlaceFreshnessReport)
 * possibly-closed places, but nothing let a user flag a specific piece of
 * content as spam/abusive/fake themselves. Scoped to reviews and events —
 * the two free-text fields a logged-in user can post without any
 * ownership/verification gate, and so the two most likely to attract
 * abuse. `targetType`/`targetId` is a polymorphic pointer (no FK — it
 * points at one of two different tables depending on targetType);
 * `ReportsService` validates the target actually exists before saving.
 *
 * One report per user per target (`@Unique`), upserted rather than
 * accumulated — same "a changed mind replaces the old report" reasoning
 * as `PlaceFreshnessReport`, so repeatedly reporting the same thing can't
 * inflate the count a moderator sees.
 */
@Entity("content_reports")
@Unique(["reporterUserId", "targetType", "targetId"])
@Index(["targetType", "targetId"])
export class ContentReport {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @ManyToOne(() => User, { onDelete: "CASCADE" })
  @JoinColumn({ name: "reporter_user_id" })
  reporter: User;

  @Column({ name: "reporter_user_id" })
  reporterUserId: string;

  @Column({ name: "target_type", type: "enum", enum: ReportTargetType })
  targetType: ReportTargetType;

  @Column({ name: "target_id", type: "uuid" })
  targetId: string;

  @Column({ type: "enum", enum: ReportReason })
  reason: ReportReason;

  @Column({ type: "varchar", length: 500, nullable: true })
  details: string | null;

  @CreateDateColumn({ name: "created_at" })
  createdAt: Date;
}
