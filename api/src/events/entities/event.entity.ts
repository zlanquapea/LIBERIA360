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
import { County } from "../../counties/entities/county.entity";
import { User } from "../../users/entities/user.entity";
import { EventCategory } from "./event.enums";

/**
 * Event (Tech Spec §5 Event, §3.2). `county` is required so GET /events can
 * always filter by county (§10) even for events with no catalog Place link
 * (spec's "place_id/location" — `place` is optional, `locationText` covers
 * the freeform case, e.g. "Antoinette Tubman Stadium" with no catalog entry).
 */
@Entity("events")
export class Event {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({ type: "varchar", length: 200 })
  name: string;

  @Column({ type: "enum", enum: EventCategory })
  category: EventCategory;

  @ManyToOne(() => Place, { eager: true, nullable: true })
  @JoinColumn({ name: "place_id" })
  place: Place | null;

  @Column({ name: "place_id", nullable: true })
  placeId: string | null;

  @Column({
    name: "location_text",
    type: "varchar",
    length: 255,
    nullable: true,
  })
  locationText: string | null;

  @ManyToOne(() => County, { eager: true })
  @JoinColumn({ name: "county_id" })
  county: County;

  @Index()
  @Column({ name: "county_id" })
  countyId: string;

  @Index()
  @Column({ name: "start_date", type: "timestamptz" })
  startDate: Date;

  @Column({ name: "end_date", type: "timestamptz", nullable: true })
  endDate: Date | null;

  @Column({ type: "text", nullable: true })
  description: string | null;

  @Column({ type: "text", array: true, default: () => "'{}'" })
  images: string[];

  @Column({ name: "ticket_info", type: "text", nullable: true })
  ticketInfo: string | null;

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
