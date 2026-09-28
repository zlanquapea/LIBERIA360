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
 * The "Explorer" feature (not "Bucket List" — that name is already taken
 * by SavedPlace) — a self-reported "I've been here," the raw material
 * VisitedPlacesService.getExplorerProgress computes counts and badges
 * from at read time. Mirrors SavedPlace's exact shape: one row per
 * (userId, placeId), `@Unique` is what makes marking a place visited
 * twice safely idempotent via `.upsert()`.
 */
@Entity("visited_places")
@Unique(["userId", "placeId"])
@Index(["userId"])
export class VisitedPlace {
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

  @CreateDateColumn({ name: "visited_at" })
  visitedAt: Date;
}
