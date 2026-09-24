import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from "typeorm";
import { CarListing } from "./car-listing.entity";

/**
 * A date range an owner has manually blocked out (maintenance, personal
 * use, an off-platform rental) — excluded from availability alongside
 * CONFIRMED/PENDING bookings (see BookingsService.create's overlap check
 * and CarListingsService.getAvailability). No reverse `@OneToMany` on
 * CarListing itself: that entity is eager-loaded and widely serialized,
 * and blocked dates are only ever queried by carListingId directly.
 */
@Entity("car_listing_blocked_dates")
export class CarListingBlockedDate {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @ManyToOne(() => CarListing, { onDelete: "CASCADE" })
  @JoinColumn({ name: "car_listing_id" })
  carListing: CarListing;

  @Index()
  @Column({ name: "car_listing_id", type: "uuid" })
  carListingId: string;

  @Column({ name: "start_date", type: "date" })
  startDate: string;

  @Column({ name: "end_date", type: "date" })
  endDate: string;

  // Private to the owner — never included in the public availability
  // response (CarListingsService.getAvailability omits it deliberately).
  @Column({ type: "text", nullable: true })
  reason: string | null;

  @CreateDateColumn({ name: "created_at" })
  createdAt: Date;
}
