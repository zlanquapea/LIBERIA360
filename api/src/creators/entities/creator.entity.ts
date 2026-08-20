import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from "typeorm";
import { County } from "../../counties/entities/county.entity";
import { User } from "../../users/entities/user.entity";
import { CreatorCategory, CreatorVerificationStatus } from "./creator.enums";

/**
 * Creator profile (Tech Spec §5 Creator, §3.2). One per User — `userId` (not
 * in the spec's minimal field list) is the FK needed to make "self-service
 * become a creator" actually work as an account extension rather than a
 * standalone record nobody owns.
 *
 * Portfolio items and offerings (services) are separate tables — see
 * CreatorPortfolioItem and CreatorOffering — rather than columns here,
 * since both are unbounded lists. "places visited" from the spec bullet
 * still isn't tracked as a separate join table — no concrete feature
 * depends on it yet, and it can be added without a breaking change later.
 */
@Entity("creators")
export class Creator {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @OneToOne(() => User, { eager: true, onDelete: "CASCADE" })
  @JoinColumn({ name: "user_id" })
  user: User;

  @Column({ name: "user_id", unique: true })
  userId: string;

  @Column({ type: "varchar", length: 150 })
  name: string;

  @Column({ type: "varchar", length: 50, unique: true })
  username: string;

  @Column({ type: "text", nullable: true })
  bio: string | null;

  @Column({
    name: "profile_image",
    type: "varchar",
    length: 500,
    nullable: true,
  })
  profileImage: string | null;

  @Column({
    name: "cover_image",
    type: "varchar",
    length: 500,
    nullable: true,
  })
  coverImage: string | null;

  @Column({
    type: "enum",
    enum: CreatorCategory,
    default: CreatorCategory.OTHER,
  })
  category: CreatorCategory;

  // Home base — same field/pattern as User.homeCounty, distinct from
  // `locationsCovered` below (the areas this creator actually serves,
  // which don't have to be limited to their home county).
  @ManyToOne(() => County, { eager: true, nullable: true })
  @JoinColumn({ name: "county_id" })
  county: County | null;

  @Column({ name: "county_id", nullable: true })
  countyId: string | null;

  @Column({ type: "varchar", length: 100, nullable: true })
  instagram: string | null;

  @Column({ type: "varchar", length: 100, nullable: true })
  tiktok: string | null;

  @Column({ type: "varchar", length: 100, nullable: true })
  youtube: string | null;

  @Column({
    name: "contact_email",
    type: "varchar",
    length: 255,
    nullable: true,
  })
  contactEmail: string | null;

  @Column({
    name: "contact_phone",
    type: "varchar",
    length: 40,
    nullable: true,
  })
  contactPhone: string | null;

  @Column({ type: "varchar", length: 40, nullable: true })
  whatsapp: string | null;

  @Column({ type: "varchar", length: 300, nullable: true })
  website: string | null;

  @Column({ type: "text", array: true, default: () => "'{}'" })
  languages: string[];

  @Column({ name: "years_experience", type: "smallint", nullable: true })
  yearsExperience: number | null;

  @Column({ type: "text", array: true, default: () => "'{}'" })
  certifications: string[];

  // Freeform for now ("Weekends only", "Booked through December") rather
  // than a real calendar/availability system — see the [Later phase] task
  // for extending the Booking system to creators, which is where a
  // structured calendar would actually earn its keep.
  @Column({ name: "availability_note", type: "text", nullable: true })
  availabilityNote: string | null;

  // Self-reported — no social-platform API integration to verify this.
  @Column({ name: "follower_count", type: "int", default: 0 })
  followerCount: number;

  @Column({ type: "text", array: true, default: () => "'{}'" })
  specialties: string[];

  @Column({
    name: "locations_covered",
    type: "text",
    array: true,
    default: () => "'{}'",
  })
  locationsCovered: string[];

  @Column({
    name: "content_links",
    type: "text",
    array: true,
    default: () => "'{}'",
  })
  contentLinks: string[];

  // Trust badge — see CreatorVerificationStatus's doc comment. Not an
  // eager relation on verifiedByUserId (matches Place/Business) so a
  // creator's own profile response never risks leaking another user's
  // passwordHash through an accidental eager join.
  @Column({
    name: "verification_status",
    type: "enum",
    enum: CreatorVerificationStatus,
    default: CreatorVerificationStatus.UNVERIFIED,
  })
  verificationStatus: CreatorVerificationStatus;

  @Column({ name: "verified_by_user_id", type: "uuid", nullable: true })
  verifiedByUserId: string | null;

  @Column({ name: "verified_at", type: "timestamptz", nullable: true })
  verifiedAt: Date | null;

  // Phase 3 creator promotion (Tech Spec §3.3) — admin-set, surfaces this
  // creator first in the directory. No self-service "sponsored content"
  // tooling beyond this yet; the spec gives that bullet one line with no
  // further detail to build against.
  @Column({ type: "boolean", default: false })
  featured: boolean;

  @CreateDateColumn({ name: "created_at" })
  createdAt: Date;

  @UpdateDateColumn({ name: "updated_at" })
  updatedAt: Date;
}
