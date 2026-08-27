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
import { CreatorPostMediaType, CreatorPostStatus } from "./creator-post.enums";

@Entity("creator_posts")
export class CreatorPost {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @ManyToOne(() => Creator, { onDelete: "CASCADE" })
  @JoinColumn({ name: "creator_id" })
  creator: Creator;

  @Index()
  @Column({ name: "creator_id" })
  creatorId: string;

  @Column({ name: "media_type", type: "enum", enum: CreatorPostMediaType })
  mediaType: CreatorPostMediaType;

  @Column({ name: "media_url", type: "varchar", length: 500 })
  mediaUrl: string;

  @Column({ type: "text", nullable: true })
  caption: string | null;

  @Index()
  @Column({
    type: "enum",
    enum: CreatorPostStatus,
    default: CreatorPostStatus.PUBLISHED,
  })
  status: CreatorPostStatus;

  @Column({ name: "like_count", type: "int", default: 0 })
  likeCount: number;

  @Column({ name: "comment_count", type: "int", default: 0 })
  commentCount: number;

  @Column({ name: "save_count", type: "int", default: 0 })
  saveCount: number;

  @Column({ name: "share_count", type: "int", default: 0 })
  shareCount: number;

  @CreateDateColumn({ name: "created_at" })
  createdAt: Date;

  @UpdateDateColumn({ name: "updated_at" })
  updatedAt: Date;
}
