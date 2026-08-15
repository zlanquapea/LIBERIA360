import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from "typeorm";
import { Place } from "../../places/entities/place.entity";
import { User } from "../../users/entities/user.entity";
import { VerificationStatus } from "../../places/entities/place.enums";
import { BusinessType, SubscriptionTier } from "./business.enums";

/**
 * Business self-claim record (Tech Spec §5 Business, §3.2 "claim this
 * listing"). Always tied to an existing catalog Place — `location` from the
 * spec's field list is intentionally dropped here since the linked Place
 * already carries structured county/city/lat/lng; a second freeform
 * location string would just be a second, driftable source of truth.
 */
@Entity("businesses")
export class Business {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({ type: "varchar", length: 200 })
  name: string;

  @Column({ type: "enum", enum: BusinessType })
  type: BusinessType;

  @ManyToOne(() => User, { eager: true, nullable: true })
  @JoinColumn({ name: "owner_user_id" })
  owner: User | null;

  @Column({ name: "owner_user_id", nullable: true })
  ownerUserId: string | null;

  @ManyToOne(() => Place, { eager: true })
  @JoinColumn({ name: "linked_place_id" })
  linkedPlace: Place;

  @Column({ name: "linked_place_id" })
  linkedPlaceId: string;

  @Column({ type: "varchar", length: 40, nullable: true })
  phone: string | null;

  @Column({ type: "varchar", length: 40, nullable: true })
  whatsapp: string | null;

  @Column({ type: "varchar", length: 255, nullable: true })
  email: string | null;

  @Column({ type: "varchar", length: 255, nullable: true })
  website: string | null;

  @Column({
    name: "social_links",
    type: "text",
    array: true,
    default: () => "'{}'",
  })
  socialLinks: string[];

  @Column({ type: "text", nullable: true })
  description: string | null;

  @Column({ type: "text", array: true, default: () => "'{}'" })
  images: string[];

  @Column({
    name: "verification_status",
    type: "enum",
    enum: VerificationStatus,
    default: VerificationStatus.UNVERIFIED,
  })
  verificationStatus: VerificationStatus;

  // Audit trail (Tech Spec §7) — see Place.verifiedByUserId for why this is
  // a plain id, not an eager relation.
  @Column({ name: "verified_by_user_id", type: "uuid", nullable: true })
  verifiedByUserId: string | null;

  @Column({ name: "verified_at", type: "timestamptz", nullable: true })
  verifiedAt: Date | null;

  @Column({
    name: "subscription_tier",
    type: "enum",
    enum: SubscriptionTier,
    default: SubscriptionTier.FREE,
  })
  subscriptionTier: SubscriptionTier;

  @CreateDateColumn({ name: "created_at" })
  createdAt: Date;

  @UpdateDateColumn({ name: "updated_at" })
  updatedAt: Date;
}
