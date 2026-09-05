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
import { Place } from "../../places/entities/place.entity";
import { User } from "../../users/entities/user.entity";

/**
 * The account-side half of "Saved / Bucket List" (Tech Spec §3.1/§6.3).
 * Phase 1 shipped this as device-local `localStorage` only, deliberately
 * with no account required — that stays true, and still is the fast path
 * every save/unsave hits first. This table exists purely so a signed-in
 * visitor's saves also survive switching devices: `useSavedPlaces` merges
 * the device's local slug list into this table once per login (and mirrors
 * every subsequent toggle here in the background), rather than the local
 * list being the only copy that exists.
 *
 * One row per (userId, placeId) — `@Unique` below is what makes the merge
 * and the plain "save" endpoint both safely idempotent via `.upsert()`,
 * so double-clicking Save or re-running the login merge can never error or
 * duplicate a row.
 */
@Entity("saved_places")
@Unique(["userId", "placeId"])
@Index(["userId"])
export class SavedPlace {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @ManyToOne(() => User, { onDelete: "CASCADE" })
  @JoinColumn({ name: "user_id" })
  user: User;

  @Column({ name: "user_id", type: "uuid" })
  userId: string;

  @ManyToOne(() => Place, { onDelete: "CASCADE" })
  @JoinColumn({ name: "place_id" })
  place: Place;

  @Column({ name: "place_id", type: "uuid" })
  placeId: string;

  @CreateDateColumn({ name: "created_at" })
  createdAt: Date;
}
