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
import { Place } from "../../places/entities/place.entity";
import { User } from "../../users/entities/user.entity";

/**
 * "Featured this week" (Business Plan §8.3) — a time-boxed promotional
 * placement, distinct from Place.featured (Phase 1's general editorial
 * curation flag, which has no start/end date and isn't a paid campaign).
 * Admin-managed rather than self-service — there's no payment flow behind
 * it yet (see the Booking entity's note on deferred payment integration).
 */
@Entity("sponsored_placements")
export class SponsoredPlacement {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @ManyToOne(() => Place, { eager: true, onDelete: "CASCADE" })
  @JoinColumn({ name: "place_id" })
  place: Place;

  @Index()
  @Column({ name: "place_id" })
  placeId: string;

  @Column({ name: "start_date", type: "date" })
  startDate: string;

  @Column({ name: "end_date", type: "date" })
  endDate: string;

  @ManyToOne(() => User, { eager: true })
  @JoinColumn({ name: "created_by_user_id" })
  createdBy: User;

  @Column({ name: "created_by_user_id" })
  createdByUserId: string;

  @CreateDateColumn({ name: "created_at" })
  createdAt: Date;

  @UpdateDateColumn({ name: "updated_at" })
  updatedAt: Date;
}
