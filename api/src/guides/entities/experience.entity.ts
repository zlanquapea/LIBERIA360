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
import { decimalTransformer } from "../../database/decimal.transformer";
import { GuideProfile } from "./guide-profile.entity";
import {
  ExperienceCategory,
  ExperienceGroupType,
  ExperienceStatus,
} from "./guide.enums";

@Entity("experiences")
export class Experience {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @ManyToOne(() => GuideProfile, { eager: true, onDelete: "CASCADE" })
  @JoinColumn({ name: "guide_id" })
  guide: GuideProfile;

  @Column({ name: "guide_id" })
  guideId: string;

  @Column({ type: "varchar", length: 180 })
  title: string;

  @Column({ type: "text" })
  description: string;

  @Column({ type: "enum", enum: ExperienceCategory })
  category: ExperienceCategory;

  @Column({ type: "varchar", length: 120 })
  county: string;

  @ManyToOne(() => Place, { nullable: true, onDelete: "SET NULL" })
  @JoinColumn({ name: "place_id" })
  place: Place | null;

  @Column({ name: "place_id", nullable: true })
  placeId: string | null;

  @Column({ name: "duration_minutes", type: "smallint" })
  durationMinutes: number;

  @Column({ name: "group_type", type: "enum", enum: ExperienceGroupType })
  groupType: ExperienceGroupType;

  @Column({ name: "max_group_size", type: "smallint" })
  maxGroupSize: number;

  @Column({
    name: "price_usd",
    type: "numeric",
    precision: 10,
    scale: 2,
    transformer: decimalTransformer,
  })
  priceUsd: number;

  @Column({
    name: "price_lrd",
    type: "numeric",
    precision: 12,
    scale: 2,
    nullable: true,
    transformer: decimalTransformer,
  })
  priceLrd: number | null;

  @Column({ name: "meeting_point_text", type: "varchar", length: 300 })
  meetingPointText: string;

  @Column({
    name: "meeting_lat",
    type: "numeric",
    precision: 10,
    scale: 7,
    nullable: true,
  })
  meetingLat: number | null;

  @Column({
    name: "meeting_lng",
    type: "numeric",
    precision: 10,
    scale: 7,
    nullable: true,
  })
  meetingLng: number | null;

  @Column({ type: "text", array: true, default: () => "'{}'" })
  includes: string[];

  @Column({ name: "cancellation_policy", type: "text" })
  cancellationPolicy: string;

  @Column({
    name: "cover_image_url",
    type: "varchar",
    length: 1000,
    nullable: true,
  })
  coverImageUrl: string | null;

  @Column({
    name: "image_urls",
    type: "text",
    array: true,
    default: () => "'{}'",
  })
  imageUrls: string[];

  @Column({ name: "is_featured", default: false })
  isFeatured: boolean;

  @Column({
    type: "enum",
    enum: ExperienceStatus,
    default: ExperienceStatus.DRAFT,
  })
  status: ExperienceStatus;

  @CreateDateColumn({ name: "created_at" })
  createdAt: Date;

  @UpdateDateColumn({ name: "updated_at" })
  updatedAt: Date;
}
