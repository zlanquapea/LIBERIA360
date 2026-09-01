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
import { Itinerary } from "./itinerary.entity";
import { User } from "../../users/entities/user.entity";

export enum TripJoinRequestStatus {
  PENDING = "pending",
  APPROVED = "approved",
  DECLINED = "declined",
}

/** "Public shouldn't necessarily mean anyone automatically becomes a
 * participant" — a public trip's own approval gate, distinct from
 * TripInvitation (the creator reaching out to a specific person) in the
 * opposite direction: a signed-in stranger asking to be let in. Always
 * tied to an existing account (no email-only variant — TripInvitation's
 * "someone with no account yet" case doesn't apply here, since only a
 * signed-in user can browse and request to join a public trip in the
 * first place) and needs no token/expiry handshake, since it's already
 * scoped to one specific known account rather than a link handed to
 * whoever has it.
 *
 * One row per (itinerary, user) — a declined request can be reused
 * (status reset to PENDING) rather than accumulating duplicate rows if
 * the same person asks again later, mirroring
 * TripInvitation.createOrResendInvitation's resend-by-reuse pattern. */
@Entity("trip_join_requests")
@Unique(["itineraryId", "userId"])
export class TripJoinRequest {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @ManyToOne(() => Itinerary, { onDelete: "CASCADE" })
  @JoinColumn({ name: "itinerary_id" })
  itinerary: Itinerary;

  @Index()
  @Column({ name: "itinerary_id" })
  itineraryId: string;

  @ManyToOne(() => User, { eager: true, onDelete: "CASCADE" })
  @JoinColumn({ name: "user_id" })
  user: User;

  @Index()
  @Column({ name: "user_id" })
  userId: string;

  @Column({
    type: "enum",
    enum: TripJoinRequestStatus,
    default: TripJoinRequestStatus.PENDING,
  })
  status: TripJoinRequestStatus;

  @Column({ name: "responded_at", type: "timestamptz", nullable: true })
  respondedAt: Date | null;

  @CreateDateColumn({ name: "created_at" })
  createdAt: Date;
}
