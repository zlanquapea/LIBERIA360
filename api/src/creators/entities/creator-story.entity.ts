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
import { Creator } from "./creator.entity";

export enum CreatorStoryMediaType {
  IMAGE = "image",
  VIDEO = "video",
}

export enum CreatorStoryStatus {
  PENDING = "pending",
  APPROVED = "approved",
  REJECTED = "rejected",
  EXPIRED = "expired",
  DELETED = "deleted",
}

export enum CreatorStoryVisibility {
  PUBLIC = "public",
  FOLLOWERS = "followers",
}

@Entity("creator_stories")
@Index(["creatorId", "status", "expiresAt"])
@Index(["status", "publishedAt"])
@Index(["expiresAt"])
export class CreatorStory {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @ManyToOne(() => Creator, { onDelete: "CASCADE" })
  @JoinColumn({ name: "creator_id" })
  creator: Creator;

  @Column({ name: "creator_id", type: "uuid" })
  creatorId: string;

  @Column({ name: "media_type", type: "enum", enum: CreatorStoryMediaType })
  mediaType: CreatorStoryMediaType;

  @Column({ name: "media_url", type: "varchar", length: 500 })
  mediaUrl: string;

  @Column({ type: "text", nullable: true })
  caption: string | null;

  @Column({
    type: "enum",
    enum: CreatorStoryStatus,
    default: CreatorStoryStatus.APPROVED,
  })
  status: CreatorStoryStatus;

  @Column({
    type: "enum",
    enum: CreatorStoryVisibility,
    default: CreatorStoryVisibility.PUBLIC,
  })
  visibility: CreatorStoryVisibility;

  @Column({ name: "place_id", type: "uuid", nullable: true })
  placeId: string | null;

  @Column({ name: "event_id", type: "uuid", nullable: true })
  eventId: string | null;

  @Column({ name: "trip_id", type: "uuid", nullable: true })
  tripId: string | null;

  @Column({ name: "creator_profile_id", type: "uuid", nullable: true })
  creatorProfileId: string | null;

  @Column({ name: "view_count", type: "int", default: 0 })
  viewCount: number;

  @CreateDateColumn({ name: "created_at" })
  createdAt: Date;

  @UpdateDateColumn({ name: "updated_at" })
  updatedAt: Date;

  @Column({ name: "published_at", type: "timestamptz", nullable: true })
  publishedAt: Date | null;

  @Column({ name: "expires_at", type: "timestamptz", nullable: true })
  expiresAt: Date | null;
}

@Entity("creator_story_views")
@Index(["storyId", "viewerUserId"], { unique: true })
export class CreatorStoryView {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({ name: "story_id", type: "uuid" })
  storyId: string;

  @Column({ name: "viewer_user_id", type: "uuid" })
  viewerUserId: string;

  @CreateDateColumn({ name: "viewed_at" })
  viewedAt: Date;
}

@Entity("creator_story_reports")
@Index(["storyId", "reporterUserId"], { unique: true })
export class CreatorStoryReport {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({ name: "story_id", type: "uuid" })
  storyId: string;

  @Column({ name: "reporter_user_id", type: "uuid" })
  reporterUserId: string;

  @Column({ type: "varchar", length: 500 })
  reason: string;

  @CreateDateColumn({ name: "created_at" })
  createdAt: Date;
}

export type CreatorStoryEntity = CreatorStory;

export const STORY_VISIBILITY_HOURS = 24;
