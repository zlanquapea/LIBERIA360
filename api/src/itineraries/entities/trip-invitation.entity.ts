import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from "typeorm";
import { Itinerary } from "./itinerary.entity";
import { User } from "../../users/entities/user.entity";

/** Only three states are ever actually *transitioned* into — everything
 * else the organizer sees ("Viewed", "Expired") is derived, not stored
 * (see `viewedAt`/`expiresAt` below and TripInvitationsService.toStatus).
 * There's no separate persisted "Sent" state either: an invitation is
 * always emailed synchronously as part of creating it in the same
 * request, so "pending" and "sent" would never actually be observably
 * different states here — whether that email really left the building is
 * instead surfaced as `emailDelivered`, reusing MailService's existing
 * delivery-outcome tracking rather than inventing a fake queued state. */
export enum TripInvitationStatus {
  PENDING = "pending",
  ACCEPTED = "accepted",
  DECLINED = "declined",
}

const INVITATION_TTL_MS = 14 * 24 * 60 * 60 * 1000; // 14 days

export function invitationExpiresAt(): Date {
  return new Date(Date.now() + INVITATION_TTL_MS);
}

/**
 * A pending or resolved invite to co-plan a trip — the handshake
 * `ItineraryCollaborator` deliberately skipped (see that entity's doc
 * comment). One row per (itinerary, email): created either against a
 * known account (`inviteeUserId` set immediately, from the "people on
 * the platform" picker) or against a bare email address for someone with
 * no account yet (`inviteeUserId` stays null until they register through
 * the invite link — see AuthService.register's `inviteToken` handling,
 * which links it by token possession, not by matching the email they
 * choose to register with — deliberately: the secret token, emailed only
 * to the invited address, *is* the proof of identity here, and requiring
 * an exact email match would break "I'd rather sign up with my other
 * email" for no real security gain).
 *
 * Accepting doesn't happen here — it materializes an
 * `ItineraryCollaborator` row and leaves this row as a permanent
 * accepted/declined receipt for the organizer's People panel.
 */
@Entity("trip_invitations")
@Index(["itineraryId", "email"])
export class TripInvitation {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @ManyToOne(() => Itinerary, { onDelete: "CASCADE" })
  @JoinColumn({ name: "itinerary_id" })
  itinerary: Itinerary;

  @Index()
  @Column({ name: "itinerary_id" })
  itineraryId: string;

  @ManyToOne(() => User, { onDelete: "CASCADE" })
  @JoinColumn({ name: "invited_by_user_id" })
  invitedBy: User;

  @Column({ name: "invited_by_user_id", type: "uuid" })
  invitedByUserId: string;

  // Always set, whether this targets an existing account or a bare
  // address — the uniform key "resend"/"already invited" checks key off,
  // so those don't need to branch on whether inviteeUserId is set yet.
  @Column({ type: "varchar", length: 255 })
  email: string;

  // Set at creation for a "people on the platform" pick; set at
  // registration time (via inviteToken) for an email-only invite once
  // that person creates an account; stays null for as long as an
  // email-only invite is unclaimed.
  @ManyToOne(() => User, { nullable: true, onDelete: "CASCADE" })
  @JoinColumn({ name: "invitee_user_id" })
  invitee: User | null;

  @Index()
  @Column({ name: "invitee_user_id", type: "uuid", nullable: true })
  inviteeUserId: string | null;

  // SHA-256 of the accept/decline link's token — see auth/token-hash.ts.
  @Index({ unique: true })
  @Column({ name: "token_hash", type: "text" })
  tokenHash: string;

  @Column({
    type: "enum",
    enum: TripInvitationStatus,
    default: TripInvitationStatus.PENDING,
  })
  status: TripInvitationStatus;

  // First time the token-preview endpoint was opened while still pending
  // — this is what lets the organizer's panel show "Viewed" instead of
  // just "Pending" once the invite has actually been opened.
  @Column({ name: "viewed_at", type: "timestamptz", nullable: true })
  viewedAt: Date | null;

  @Column({ name: "responded_at", type: "timestamptz", nullable: true })
  respondedAt: Date | null;

  @Column({ name: "expires_at", type: "timestamptz" })
  expiresAt: Date;

  // MailService's real send outcome for the invite email — distinct from
  // `status`: an invite can be "pending" but the email that was supposed
  // to carry it never actually left, which the organizer otherwise has no
  // way to know (see the email-delivery-diagnostics work this reuses).
  @Column({ name: "email_delivered", type: "boolean", default: false })
  emailDelivered: boolean;

  @CreateDateColumn({ name: "created_at" })
  createdAt: Date;
}
