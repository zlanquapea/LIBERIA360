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

// Exactly one of placeId/eventId/carListingId is set — a stop points at one
// catalog item, never more than one (same "nullable-FK XOR" convention as
// Booking's business/creator/carListing targeting, see that entity's own
// doc comment). Widened from placeId-only (Sep 2026, "make trip planning
// the platform's focus" product review): a trip should be able to include
// an event or a rental car alongside places, not just places. No migration
// needed for this — `stops` is jsonb, and every existing row already only
// ever set placeId, which stays valid with the other two simply absent.
export interface ItineraryStop {
  day: number; // 1-indexed
  order: number; // position within the day
  notes: string | null;
  placeId?: string;
  eventId?: string;
  carListingId?: string;
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
  // picker for the equivalent self-service pattern elsewhere). Optional
  // (Sep 2026, streamlined trip creation): CreateTripDto required this
  // for a while, but that turned out to be paperwork ahead of the actual
  // planning — a traveler can start adding stops with no destination set
  // and pick one later from the catalog if they want the tappable link.
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

  // Simple traveler headcount (Sep 2026 product ask) — mirrors
  // Booking.partySize's exact shape. Purely informational (sizing a car
  // rental, a restaurant reservation), never enforced against anything.
  @Column({ name: "party_size", type: "smallint", nullable: true })
  partySize: number | null;

  // Only meaningful when visibility is PUBLIC — an owner capping how many
  // strangers can join via a join request (see ItinerariesService.
  // requestToJoin/approveJoinRequest). Set once at creation, same
  // creation-only precedent as visibility itself (see CreateTripDto).
  @Column({ name: "max_participants", type: "smallint", nullable: true })
  maxParticipants: number | null;

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
