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
import { County } from "../../counties/entities/county.entity";
import { User } from "../../users/entities/user.entity";
import { decimalTransformer } from "../../database/decimal.transformer";
import {
  CarCategory,
  CarFuelType,
  CarListingReviewStatus,
  CarTransmission,
} from "./car-listing.enums";

/**
 * One vehicle listed for rent ("Car Rental" — hire a car to get around or
 * for a trip). Liberia has very few formal car-rental companies, so this
 * is deliberately a peer-to-peer marketplace listing (same shape as
 * Advertisement: `ownerUserId` is the direct lister, no Business or Place
 * required to get started) rather than something bolted onto the
 * Business/Place claim flow the way a hotel or restaurant listing is —
 * anyone with a car can sign up and list it, the same way a driver signs
 * up on Uber or a host signs up on Airbnb, not the way a business claims
 * an existing catalog entry.
 *
 * `businessId` stays as an *optional* link for the rare case of an actual
 * registered rental company that already has a claimed Business (type
 * CAR_RENTAL) and wants its fleet to also show up on that business's
 * profile page — never a prerequisite for listing a car.
 *
 * `county` is required, same reasoning as Event.county: a listing needs
 * to be filterable/discoverable by location even though it has no
 * Business/Place to inherit one from; `pickupLocation` (free text) covers
 * the specific spot within that county.
 *
 * Goes through the same review-gate as Advertisement/Place/Business — a
 * specific car's condition/price/photos carry enough real-money and
 * safety stakes to warrant admin review rather than going live
 * unmoderated (see CarListingReviewStatus). Booked through the same
 * Booking entity every other listing type uses (see Booking.carListingId)
 * — a renter "requests to book" a car exactly like a hotel room or a
 * tour, and the owner confirms/declines.
 */
@Entity("car_listings")
export class CarListing {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @ManyToOne(() => User, { eager: true, onDelete: "CASCADE" })
  @JoinColumn({ name: "owner_user_id" })
  owner: User;

  @Index()
  @Column({ name: "owner_user_id", type: "uuid" })
  ownerUserId: string;

  // Optional — see class doc comment. A car-rental company that already
  // has a claimed Business can link its listings here; almost every
  // individual lister leaves this null.
  @ManyToOne(() => Business, {
    eager: true,
    nullable: true,
    onDelete: "SET NULL",
  })
  @JoinColumn({ name: "business_id" })
  business: Business | null;

  @Index()
  @Column({ name: "business_id", nullable: true })
  businessId: string | null;

  @ManyToOne(() => County, { eager: true })
  @JoinColumn({ name: "county_id" })
  county: County;

  @Index()
  @Column({ name: "county_id" })
  countyId: string;

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

  // Hourly rental is opt-in: a listing with pricePerHour left null only
  // supports day-based booking (the original model). Setting it turns on
  // the "by hour" mode in BookingRequestSection for this car — for a
  // quick errand or an airport run, a renter shouldn't have to pay for
  // (and the owner shouldn't have to block out) a whole day.
  // minRentalHours/driverFeePerHour mirror minRentalDays/driverFeePerDay
  // exactly, just for the hourly path.
  @Column({
    name: "price_per_hour",
    type: "numeric",
    precision: 10,
    scale: 2,
    nullable: true,
    transformer: decimalTransformer,
  })
  pricePerHour: number | null;

  @Column({ name: "min_rental_hours", type: "smallint", nullable: true })
  minRentalHours: number | null;

  @Column({
    name: "driver_fee_per_hour",
    type: "numeric",
    precision: 10,
    scale: 2,
    nullable: true,
    transformer: decimalTransformer,
  })
  driverFeePerHour: number | null;

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

  // Where the car actually gets picked up — free text since it's rarely
  // as clean as a catalog Place (an owner's home, a taxi stand, an
  // airport arrivals curb). Only needs a value when it's more specific
  // than "somewhere in the county" above.
  @Column({
    name: "pickup_location",
    type: "varchar",
    length: 200,
    nullable: true,
  })
  pickupLocation: string | null;

  // Direct contact for a renter to reach the lister — same fields as
  // Advertisement.contactPhone/contactWhatsapp, needed here for the same
  // reason: there's no Business record to pull contact info from for the
  // common case of an individual lister.
  @Column({
    name: "contact_phone",
    type: "varchar",
    length: 40,
    nullable: true,
  })
  contactPhone: string | null;

  @Column({
    name: "contact_whatsapp",
    type: "varchar",
    length: 40,
    nullable: true,
  })
  contactWhatsapp: string | null;

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
