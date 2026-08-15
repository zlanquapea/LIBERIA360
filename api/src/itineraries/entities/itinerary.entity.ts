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
import { BudgetBand, ItineraryKind } from "./itinerary.enums";

export interface ItineraryStop {
  day: number; // 1-indexed
  order: number; // position within the day
  placeId: string;
  notes: string | null;
}

/**
 * Saved trip plan (Tech Spec §5 Itinerary, §4.3). `stops` is stored as
 * jsonb rather than a join table — it's always read/written as one ordered
 * unit with the itinerary, never queried stop-by-stop, so a table plus
 * joins would add cost without buying anything.
 */
@Entity("itineraries")
export class Itinerary {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @ManyToOne(() => User, { onDelete: "CASCADE" })
  @JoinColumn({ name: "user_id" })
  user: User;

  @Index()
  @Column({ name: "user_id" })
  userId: string;

  @Column({ type: "varchar", length: 200 })
  title: string;

  @Column({ type: "enum", enum: ItineraryKind, default: ItineraryKind.TRIP })
  kind: ItineraryKind;

  @Column({ name: "duration_days", type: "smallint" })
  durationDays: number;

  @Column({ name: "budget_band", type: "enum", enum: BudgetBand })
  budgetBand: BudgetBand;

  @Column({ type: "text", array: true, default: () => "'{}'" })
  interests: string[];

  @Column({ type: "jsonb", default: () => "'[]'" })
  stops: ItineraryStop[];

  @CreateDateColumn({ name: "created_at" })
  createdAt: Date;

  @UpdateDateColumn({ name: "updated_at" })
  updatedAt: Date;
}
