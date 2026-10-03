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
import { CollaboratorRole } from "./itinerary.enums";

/**
 * Grants another user edit access to a trip (Wanderlog/TripIt-style
 * collaborative trip planning) — the owner invites by email, and from
 * then on the invited user can view and edit the shared stop list right
 * alongside the owner. Deliberately no invite/accept handshake: the same
 * "immediate effect" simplification the rest of the app already uses for
 * business self-claim and admin promotion, rather than a second async
 * flow to build and test. Each collaborator is an editor (changes the
 * plan) or a viewer (sees it, can't change it) — see CollaboratorRole.
 */
@Entity("itinerary_collaborators")
@Unique(["itineraryId", "userId"])
export class ItineraryCollaborator {
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
    enum: CollaboratorRole,
    enumName: "collaborator_role_enum",
    default: CollaboratorRole.EDITOR,
  })
  role: CollaboratorRole;

  @Column({ name: "invited_by_user_id", type: "uuid" })
  invitedByUserId: string;

  @CreateDateColumn({ name: "created_at" })
  createdAt: Date;
}
