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
import { decimalTransformer } from "../../database/decimal.transformer";
import { Creator } from "./creator.entity";

/**
 * A service or experience a creator offers ("Services & Experiences" on the
 * public profile) — e.g. a photographer's "Half-day shoot" package, a tour
 * guide's "Sapo National Park day trip". Deliberately just a display/pricing
 * card, not a bookable inventory item: dates/availability/payment live on
 * Booking (bookings/entities/booking.entity.ts), which the [Later phase]
 * task extends to target a creator instead of only a Business. `priceFrom`
 * is a "starting price" for display, not a real line-item price.
 */
@Entity("creator_offerings")
export class CreatorOffering {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @ManyToOne(() => Creator, { onDelete: "CASCADE" })
  @JoinColumn({ name: "creator_id" })
  creator: Creator;

  @Index()
  @Column({ name: "creator_id" })
  creatorId: string;

  @Column({ type: "varchar", length: 150 })
  title: string;

  @Column({ type: "text", nullable: true })
  description: string | null;

  @Column({
    name: "price_from",
    type: "numeric",
    precision: 10,
    scale: 2,
    nullable: true,
    transformer: decimalTransformer,
  })
  priceFrom: number | null;

  // Freeform ("2 hours", "Half-day", "Per project") rather than a
  // structured duration — same reasoning as Creator.availabilityNote.
  @Column({
    name: "duration_label",
    type: "varchar",
    length: 100,
    nullable: true,
  })
  durationLabel: string | null;

  @Column({ type: "varchar", length: 150, nullable: true })
  location: string | null;

  @Column({ name: "sort_order", type: "int", default: 0 })
  sortOrder: number;

  @CreateDateColumn({ name: "created_at" })
  createdAt: Date;

  @UpdateDateColumn({ name: "updated_at" })
  updatedAt: Date;
}
