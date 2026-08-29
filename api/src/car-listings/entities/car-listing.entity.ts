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
import {
  CarCategory,
  CarFuelType,
  CarListingReviewStatus,
  CarTransmission,
} from "./car-listing.enums";

/**
 * One vehicle in a car-rental Business's fleet ("Car Rental" — hire a car
 * to get around or for a trip, Business.type CAR_RENTAL). Deliberately
 * owned by a Business rather than standing alone: a rental company is a
 * real operator with a real pickup location, contact info, and trust
 * history, all of which Business/Place already model — this only needs
 * to add what's specific to one bookable vehicle (make/model, pricing,
 * features), the same "child list owned by an already-vetted profile"
 * shape as CreatorOffering, except a specific car's condition/price/
 * photos carry enough real-money and safety stakes to warrant its own
 * review gate (see CarListingReviewStatus) rather than going live
 * unmoderated the way a CreatorOffering display card does.
 *
 * Booked through the same Booking entity every other listing type uses
 * (see Booking.carListingId) — a renter "requests to book" a car exactly
 * like a hotel room or a tour, and the owner confirms/declines.
 */
@Entity("car_listings")
export class CarListing {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @ManyToOne(() => Business, { eager: true, onDelete: "CASCADE" })
  @JoinColumn({ name: "business_id" })
  business: Business;

  @Index()
  @Column({ name: "business_id" })
  businessId: string;

  // Owner-authored display name ("Toyota RAV4 2022") — make/model/year
  // below are structured for filtering, this is what actually renders as
  // the card/page title, same split as Place.name vs its structured
  // category/type fields.
  @Column({ type: "varchar", length: 150 })
  title: string;

  @Column({ type: "varchar", length: 60 })
  make: string;

  @Column({ type: "varchar", length: 60 })
  model: string;

  @Column({ type: "smallint" })
  year: number;

  @Column({ type: "enum", enum: CarCategory })
  category: CarCategory;

  @Column({ type: "enum", enum: CarTransmission })
  transmission: CarTransmission;

  @Column({ name: "fuel_type", type: "enum", enum: CarFuelType })
  fuelType: CarFuelType;

  @Column({ type: "smallint" })
  seats: number;

  @Column({
    name: "price_per_day",
    type: "numeric",
    precision: 10,
    scale: 2,
    transformer: decimalTransformer,
  })
  pricePerDay: number;

  // A renter who doesn't want to (or legally can't) drive themselves —
  // common enough in this market to be a first-class toggle rather than
  // something buried in freeform notes. Booking.withDriver carries the
  // renter's actual choice at request time.
  @Column({ name: "with_driver_available", type: "boolean", default: false })
  withDriverAvailable: boolean;

  @Column({
    name: "driver_fee_per_day",
    type: "numeric",
    precision: 10,
    scale: 2,
    nullable: true,
    transformer: decimalTransformer,
  })
  driverFeePerDay: number | null;

  @Column({ name: "min_rental_days", type: "smallint", default: 1 })
  minRentalDays: number;

  @Column({
    name: "security_deposit",
    type: "numeric",
    precision: 10,
    scale: 2,
    nullable: true,
    transformer: decimalTransformer,
  })
  securityDeposit: number | null;

  // Freeform tags ("aircon", "gps", "bluetooth", "child_seat", "4x4",
  // "dashcam", "usb_charger", "unlimited_mileage") — same convention as
  // Business.servicesOffered rather than a fixed enum set, so a fleet
  // owner is never blocked waiting on a new value to describe a real
  // feature their car has.
  @Column({ type: "text", array: true, default: () => "'{}'" })
  features: string[];

  @Column({ type: "text", array: true, default: () => "'{}'" })
  images: string[];

  @Column({ type: "text", nullable: true })
  description: string | null;

  // Defaults to the owning business's linked-place city/name for display
  // when left unset (computed at read time, not stored) — only needs a
  // value here when a specific car actually picks up somewhere other
  // than the business's main location (e.g. an airport counter).
  @Column({
    name: "pickup_location",
    type: "varchar",
    length: 200,
    nullable: true,
  })
  pickupLocation: string | null;

  // Owner-controlled pause (the car's in for service, already rented
  // out this week and not through this platform, etc.) — deliberately
  // separate from `reviewStatus`: toggling a car off the road for a
  // while shouldn't cost the owner their admin approval or require
  // resubmitting for review to bring it back.
  @Column({ name: "is_active", type: "boolean", default: true })
  isActive: boolean;

  @Column({
    name: "review_status",
    type: "enum",
    enum: CarListingReviewStatus,
    default: CarListingReviewStatus.DRAFT,
  })
  reviewStatus: CarListingReviewStatus;

  @Column({ name: "rejection_reason", type: "text", nullable: true })
  rejectionReason: string | null;

  @Column({ name: "submitted_at", type: "timestamptz", nullable: true })
  submittedAt: Date | null;

  @Column({ name: "reviewed_at", type: "timestamptz", nullable: true })
  reviewedAt: Date | null;

  @Column({ name: "reviewed_by_user_id", type: "uuid", nullable: true })
  reviewedByUserId: string | null;

  // Recomputed from the reviews table whenever a car-listing-targeted
  // Review is created/removed — see ReviewsService.recalculateCarListingRating,
  // same convention as Place.rating/Creator.rating.
  @Column({
    type: "numeric",
    precision: 3,
    scale: 2,
    default: 0,
    transformer: decimalTransformer,
  })
  rating: number;

  @Column({ name: "review_count", type: "int", default: 0 })
  reviewCount: number;

  @CreateDateColumn({ name: "created_at" })
  createdAt: Date;

  @UpdateDateColumn({ name: "updated_at" })
  updatedAt: Date;
}
