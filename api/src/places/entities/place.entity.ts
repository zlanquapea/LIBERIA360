import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from "typeorm";
import { Category } from "../../categories/entities/category.entity";
import { County } from "../../counties/entities/county.entity";
import { Activity } from "../../activities/entities/activity.entity";
import { decimalTransformer } from "../../database/decimal.transformer";
import {
  PlaceType,
  RecommendedVisitLength,
  VerificationStatus,
} from "./place.enums";

/**
 * Core catalog entity. Every place renders through one standardized profile
 * template (Tech Spec §4.2) so the catalog stays consistent past hundreds of
 * entries. Field set mirrors the data model in Tech Spec §5.
 */
@Entity("places")
@Index(["countyId"])
@Index(["categoryId"])
export class Place {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({ type: "varchar", length: 200 })
  name: string;

  @Column({ type: "varchar", length: 220, unique: true })
  slug: string;

  @Column({ type: "text" })
  description: string;

  @Column({ type: "enum", enum: PlaceType })
  type: PlaceType;

  @ManyToOne(() => Category, { eager: true, nullable: false })
  @JoinColumn({ name: "category_id" })
  category: Category;

  @Column({ name: "category_id" })
  categoryId: string;

  @Column({ type: "text", array: true, default: () => "'{}'" })
  tags: string[];

  @ManyToOne(() => County, { eager: true, nullable: false })
  @JoinColumn({ name: "county_id" })
  county: County;

  @Column({ name: "county_id" })
  countyId: string;

  @Column({ type: "varchar", length: 150 })
  city: string;

  @Column({
    type: "decimal",
    precision: 9,
    scale: 6,
    transformer: decimalTransformer,
  })
  latitude: number;

  @Column({
    type: "decimal",
    precision: 9,
    scale: 6,
    transformer: decimalTransformer,
  })
  longitude: number;

  @Column({
    name: "distance_from_monrovia_km",
    type: "decimal",
    precision: 6,
    scale: 1,
    nullable: true,
    transformer: decimalTransformer,
  })
  distanceFromMonroviaKm: number | null;

  @Column({
    name: "recommended_visit_length",
    type: "enum",
    enum: RecommendedVisitLength,
    nullable: true,
  })
  recommendedVisitLength: RecommendedVisitLength | null;

  @Column({
    name: "estimated_cost_entry",
    type: "decimal",
    precision: 10,
    scale: 2,
    nullable: true,
    transformer: decimalTransformer,
  })
  estimatedCostEntry: number | null;

  @Column({
    name: "estimated_cost_guide",
    type: "decimal",
    precision: 10,
    scale: 2,
    nullable: true,
    transformer: decimalTransformer,
  })
  estimatedCostGuide: number | null;

  @Column({
    name: "estimated_cost_transport",
    type: "decimal",
    precision: 10,
    scale: 2,
    nullable: true,
    transformer: decimalTransformer,
  })
  estimatedCostTransport: number | null;

  @Column({ type: "text", array: true, default: () => "'{}'" })
  images: string[];

  @Column({ type: "text", array: true, default: () => "'{}'" })
  videos: string[];

  @Column({ name: "opening_hours", type: "text", nullable: true })
  openingHours: string | null;

  @Column({
    name: "contact_phone",
    type: "varchar",
    length: 40,
    nullable: true,
  })
  contactPhone: string | null;

  @Column({ type: "varchar", length: 40, nullable: true })
  whatsapp: string | null;

  @Column({ type: "varchar", length: 255, nullable: true })
  website: string | null;

  @Column({ type: "varchar", length: 100, nullable: true })
  instagram: string | null;

  @Column({ type: "varchar", length: 100, nullable: true })
  facebook: string | null;

  @Column({
    type: "decimal",
    precision: 2,
    scale: 1,
    default: 0,
    transformer: decimalTransformer,
  })
  rating: number;

  @Column({ name: "review_count", type: "int", default: 0 })
  reviewCount: number;

  @Column({
    name: "verification_status",
    type: "enum",
    enum: VerificationStatus,
    default: VerificationStatus.UNVERIFIED,
  })
  verificationStatus: VerificationStatus;

  @Column({ type: "boolean", default: false })
  featured: boolean;

  @OneToMany(() => Activity, (activity) => activity.place)
  activities: Activity[];

  @CreateDateColumn({ name: "created_at" })
  createdAt: Date;

  @UpdateDateColumn({ name: "updated_at" })
  updatedAt: Date;
}
