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
import { Business } from "../../businesses/entities/business.entity";
import { decimalTransformer } from "../../database/decimal.transformer";

/**
 * A kind of room a property sells ("Deluxe double, sea view") and how many
 * of them it has. Guests book a room type, not a numbered room; the front
 * desk assigns room numbers at check-in, the way most Liberian hotels and
 * lodges already work.
 */
@Entity("room_types")
export class RoomType {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @ManyToOne(() => Business, { onDelete: "CASCADE" })
  @JoinColumn({ name: "business_id" })
  business: Business;

  @Index()
  @Column({ name: "business_id" })
  businessId: string;

  @Column({ type: "varchar", length: 80 })
  name: string;

  @Column({ type: "text", nullable: true })
  description: string | null;

  @Column({ type: "text", array: true, default: () => "'{}'" })
  images: string[];

  // Most people who can sleep in one room.
  @Column({ name: "max_guests", type: "smallint", default: 2 })
  maxGuests: number;

  // e.g. "1 king bed" or "2 single beds".
  @Column({ name: "bed_summary", type: "varchar", length: 80, nullable: true })
  bedSummary: string | null;

  // In the property's currency (StaySettings.currency).
  @Column({
    name: "price_per_night",
    type: "numeric",
    precision: 10,
    scale: 2,
    transformer: decimalTransformer,
  })
  pricePerNight: number;

  // How many rooms of this type the property has in total.
  @Column({ name: "total_rooms", type: "smallint" })
  totalRooms: number;

  @Column({ type: "text", array: true, default: () => "'{}'" })
  amenities: string[];

  // Hidden from guests without losing its booking history.
  @Column({ name: "is_active", default: true })
  isActive: boolean;

  @Column({ name: "sort_order", type: "int", default: 0 })
  sortOrder: number;

  @CreateDateColumn({ name: "created_at" })
  createdAt: Date;

  @UpdateDateColumn({ name: "updated_at" })
  updatedAt: Date;
}
