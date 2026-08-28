import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from "typeorm";
import { User } from "../../users/entities/user.entity";
import { CreatorPost } from "./creator-post.entity";

@Entity("creator_post_likes")
@Unique(["postId", "userId"])
export class CreatorPostLike {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @ManyToOne(() => CreatorPost, { onDelete: "CASCADE" })
  @JoinColumn({ name: "post_id" })
  post: CreatorPost;

  @Index()
  @Column({ name: "post_id" })
  postId: string;

  @ManyToOne(() => User, { onDelete: "CASCADE" })
  @JoinColumn({ name: "user_id" })
  user: User;

  @Index()
  @Column({ name: "user_id" })
  userId: string;

  @CreateDateColumn({ name: "created_at" })
  createdAt: Date;
}

@Entity("creator_post_saves")
@Unique(["postId", "userId"])
export class CreatorPostSave {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @ManyToOne(() => CreatorPost, { onDelete: "CASCADE" })
  @JoinColumn({ name: "post_id" })
  post: CreatorPost;

  @Index()
  @Column({ name: "post_id" })
  postId: string;

  @ManyToOne(() => User, { onDelete: "CASCADE" })
  @JoinColumn({ name: "user_id" })
  user: User;

  @Index()
  @Column({ name: "user_id" })
  userId: string;

  @CreateDateColumn({ name: "created_at" })
  createdAt: Date;
}

@Entity("creator_post_comments")
export class CreatorPostComment {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @ManyToOne(() => CreatorPost, { onDelete: "CASCADE" })
  @JoinColumn({ name: "post_id" })
  post: CreatorPost;

  @Index()
  @Column({ name: "post_id" })
  postId: string;

  @ManyToOne(() => User, { onDelete: "CASCADE" })
  @JoinColumn({ name: "user_id" })
  user: User;

  @Index()
  @Column({ name: "user_id" })
  userId: string;

  @ManyToOne(() => CreatorPostComment, { onDelete: "CASCADE", nullable: true })
  @JoinColumn({ name: "parent_id" })
  parent: CreatorPostComment | null;

  @Index()
  @Column({ name: "parent_id", type: "uuid", nullable: true })
  parentId: string | null;

  @Column({ type: "text" })
  body: string;

  @Column({ name: "like_count", type: "int", default: 0 })
  likeCount: number;

  @CreateDateColumn({ name: "created_at" })
  createdAt: Date;

  @UpdateDateColumn({ name: "updated_at" })
  updatedAt: Date;
}

@Entity("creator_post_comment_likes")
@Unique(["commentId", "userId"])
export class CreatorPostCommentLike {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @ManyToOne(() => CreatorPostComment, { onDelete: "CASCADE" })
  @JoinColumn({ name: "comment_id" })
  comment: CreatorPostComment;

  @Index()
  @Column({ name: "comment_id" })
  commentId: string;

  @ManyToOne(() => User, { onDelete: "CASCADE" })
  @JoinColumn({ name: "user_id" })
  user: User;

  @Index()
  @Column({ name: "user_id" })
  userId: string;

  @CreateDateColumn({ name: "created_at" })
  createdAt: Date;
}
