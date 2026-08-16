import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from "typeorm";
import { Place } from "../../places/entities/place.entity";
import { User } from "../../users/entities/user.entity";
import { FreshnessResponse } from "./place-freshness-report.enums";

/**
 * "Is this still here?" crowdsourced signal (Waze-style "still there?"
 * prompts) — the admin moderation queue's own doc comment flags that
 * there's no reporting/flagging mechanism in the schema; this is that
 * mechanism, scoped to the one thing a catalog this size can't keep
 * current by manual re-verification alone: whether a place has closed or
 * moved. One report per user per place (`@Unique`), upserted rather than
 * accumulated — a changed mind (it reopened, or the first report was
 * wrong) replaces the old one instead of piling up alongside it, which
 * would make the aggregate count meaningless.
 */
@Entity("place_freshness_reports")
@Unique(["userId", "placeId"])
export class PlaceFreshnessReport {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @ManyToOne(() => Place, { onDelete: "CASCADE" })
  @JoinColumn({ name: "place_id" })
  place: Place;

  @Index()
  @Column({ name: "place_id" })
  placeId: string;

  @ManyToOne(() => User, { onDelete: "CASCADE" })
  @JoinColumn({ name: "user_id" })
  user: User;

  @Index()
  @Column({ name: "user_id" })
  userId: string;

  @Column({ type: "enum", enum: FreshnessResponse })
  response: FreshnessResponse;

  @CreateDateColumn({ name: "created_at" })
  createdAt: Date;

  @UpdateDateColumn({ name: "updated_at" })
  updatedAt: Date;
}
