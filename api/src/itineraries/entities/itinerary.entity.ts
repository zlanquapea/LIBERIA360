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
import { Place } from "../../places/entities/place.entity";
import { BudgetBand, ItineraryKind, TripVisibility } from "./itinerary.enums";

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

  // Social travel experience (Aug 2026 spec): the trip's one primary
  // destination, picked from the catalog via autocomplete rather than
  // free text — "cleaner location data" and a tappable link straight to
  // that destination's own page (see PlaceSubmissionForm's location
  // picker for the equivalent self-service pattern elsewhere). Nullable
  // only because it predates every trip generated before this shipped;
  // CreateTripDto requires it for anything created from here on.
  @ManyToOne(() => Place, { eager: true, nullable: true })
  @JoinColumn({ name: "destination_place_id" })
  destination: Place | null;

  @Column({ name: "destination_place_id", type: "uuid", nullable: true })
  destinationPlaceId: string | null;

  @Column({
    type: "enum",
    enum: TripVisibility,
    default: TripVisibility.PRIVATE,
  })
  visibility: TripVisibility;

  @Column({ type: "text", nullable: true })
  description: string | null;

  // Explicit only — falls back to the destination place's first photo at
  // read time (see ItinerariesService.toResponse) when unset, rather than
  // duplicating that image into a stored column that could drift.
  @Column({ name: "cover_image", type: "varchar", length: 500, nullable: true })
  coverImage: string | null;

  @Column({ name: "start_date", type: "timestamptz", nullable: true })
  startDate: Date | null;

  @Column({ name: "end_date", type: "timestamptz", nullable: true })
  endDate: Date | null;

  // Set once, never cleared — cancelling a trip is a one-way door (same
  // as CarListing/Event's own review-lifecycle terminal states), and its
  // mere presence is what computeTripStatus checks rather than a separate
  // boolean, so there's only ever one field to keep in sync.
  @Column({ name: "cancelled_at", type: "timestamptz", nullable: true })
  cancelledAt: Date | null;

  @CreateDateColumn({ name: "created_at" })
  createdAt: Date;

  @UpdateDateColumn({ name: "updated_at" })
  updatedAt: Date;
}
