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

  // Denormalized counters (like `viewCount` above) so the tray/list
  // endpoints never need a COUNT(*) join across every active story just
  // to show a badge — kept in sync by CreatorStoriesService's
  // toggleReaction/addComment/removeComment.
  @Column({ name: "reaction_count", type: "int", default: 0 })
  reactionCount: number;

  @Column({ name: "comment_count", type: "int", default: 0 })
  commentCount: number;

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

// Fixed quick-tap set (Instagram/Snapchat-style story reactions) rather
// than a free-text emoji field — keeps the reaction bar a known, always-
// renderable list of buttons instead of an open-ended picker, and keeps
// `reactionCount` groupable by a small enum on the read side.
export const STORY_REACTION_EMOJIS = [
  "❤️",
  "😂",
  "😮",
  "😢",
  "👏",
  "🔥",
] as const;
export type StoryReactionEmoji = (typeof STORY_REACTION_EMOJIS)[number];

// One row per (story, user) — tapping a new emoji swaps this row's emoji
// rather than adding a second one, same "one reaction per person" rule
// Instagram/Facebook stories use. `reactionCount` on CreatorStory counts
// *people*, not emoji picks, so swapping emoji never changes it.
@Entity("creator_story_reactions")
@Index(["storyId", "userId"], { unique: true })
export class CreatorStoryReaction {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({ name: "story_id", type: "uuid" })
  storyId: string;

  @Column({ name: "user_id", type: "uuid" })
  userId: string;

  @Column({ type: "varchar", length: 8 })
  emoji: string;

  @CreateDateColumn({ name: "created_at" })
  createdAt: Date;

  @UpdateDateColumn({ name: "updated_at" })
  updatedAt: Date;
}

// Flat (no threading/likes, unlike CreatorPostComment) — a story is gone
// in 24h, so a full reply-thread + per-comment-like model is more
// machinery than that lifetime justifies. Visible to anyone who can view
// the story (same public/followers rule as the story itself), same as
// post comments are visible to anyone who can see the post.
@Entity("creator_story_comments")
@Index(["storyId", "createdAt"])
export class CreatorStoryComment {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({ name: "story_id", type: "uuid" })
  storyId: string;

  @Column({ name: "user_id", type: "uuid" })
  userId: string;

  @Column({ type: "text" })
  body: string;

  @CreateDateColumn({ name: "created_at" })
  createdAt: Date;
}

export type CreatorStoryEntity = CreatorStory;

export const STORY_VISIBILITY_HOURS = 24;
