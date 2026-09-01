import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from "typeorm";
import { Itinerary } from "../../itineraries/entities/itinerary.entity";
import { User } from "../../users/entities/user.entity";
import { TripMessageType } from "./trip-message.enums";

/**
 * A single message in a trip's group chat (Section 9-12 of the Aug 2026
 * social-trip spec) — every current member (the admin plus every
 * collaborator, the same roster `ItinerariesService.assertMember` checks
 * against) can read and post here. Deliberately a flat list, not
 * per-recipient rows the way BookingMessage/FoodOrderMessage are for a
 * two-party thread: with N participants, a `readAt` column on the
 * message itself can't represent "read by whom", so per-viewer read
 * state lives instead in TripChatReadState as a read *cursor* (see its
 * doc comment) — the same trick Slack uses instead of one row per
 * message per viewer, which doesn't scale down any better than it scales
 * up.
 *
 * A message is either a real one from `sender`, or a `SYSTEM` one the
 * service posts itself (join/leave/rename/cancel) — `sender` is null
 * either way that happens: always for a system message, and permanently
 * once a real sender's account is deleted (`ON DELETE SET NULL` — the
 * message stays, same reasoning as anonymizing a moderation-removed
 * review's author elsewhere in this codebase, rather than cascading a
 * whole conversation away because one participant closed their account).
 */
@Entity("trip_messages")
export class TripMessage {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @ManyToOne(() => Itinerary, { onDelete: "CASCADE" })
  @JoinColumn({ name: "itinerary_id" })
  itinerary: Itinerary;

  @Index()
  @Column({ name: "itinerary_id" })
  itineraryId: string;

  @ManyToOne(() => User, { eager: true, onDelete: "SET NULL", nullable: true })
  @JoinColumn({ name: "sender_user_id" })
  sender: User | null;

  @Column({ name: "sender_user_id", nullable: true })
  senderUserId: string | null;

  @Column({
    type: "enum",
    enum: TripMessageType,
    default: TripMessageType.USER,
  })
  type: TripMessageType;

  // At least one of body/imageUrl is always present for a USER message
  // (enforced in TripChatService.sendMessage, not here — an image-only
  // message is valid, a body-only one is too, both-empty isn't); a
  // SYSTEM message is always body-only.
  @Column({ type: "text", nullable: true })
  body: string | null;

  @Column({ name: "image_url", type: "varchar", length: 500, nullable: true })
  imageUrl: string | null;

  // Echoed back by the client on send and again in every list response,
  // so the sender's own optimistic "Sending…" bubble can be reconciled
  // with the persisted row the next poll returns instead of showing a
  // duplicate. Best-effort only — never uniqueness-enforced, since a
  // deliberate retry-on-fail resend (Section 10) reuses the same value
  // on purpose, and a client that never retried just leaves it unused.
  @Column({ name: "client_id", type: "varchar", length: 100, nullable: true })
  clientId: string | null;

  // One level of quoting only (Section 11's "replies") — a reply's own
  // replyToMessage is never resolved recursively when building a
  // response (see TripChatService.toSummaries), the same "show the
  // immediate parent, not the whole ancestor chain" convention Slack/
  // Discord threads use. Set null (not cascaded away) if the quoted
  // message is later deleted, so the reply survives with a "message
  // deleted" quote instead of disappearing itself.
  @ManyToOne(() => TripMessage, { onDelete: "SET NULL", nullable: true })
  @JoinColumn({ name: "reply_to_message_id" })
  replyToMessage: TripMessage | null;

  @Column({ name: "reply_to_message_id", type: "uuid", nullable: true })
  replyToMessageId: string | null;

  @CreateDateColumn({ name: "created_at" })
  createdAt: Date;

  // Same "(edited)" convention as BookingMessage.editedAt — text-only;
  // see TripChatService.updateMessage for why an image-only message
  // can't be edited this way.
  @Column({ name: "edited_at", type: "timestamp", nullable: true })
  editedAt: Date | null;

  // Same soft-delete convention as BookingMessage.deletedAt — the row
  // (and its image) stays, but the API always redacts body/imageUrl once
  // this is set, rendering as "This message was deleted" to every member.
  @Column({ name: "deleted_at", type: "timestamp", nullable: true })
  deletedAt: Date | null;
}
