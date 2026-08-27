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

  @Column({ type: "text" })
  body: string;

  @CreateDateColumn({ name: "created_at" })
  createdAt: Date;

  @UpdateDateColumn({ name: "updated_at" })
  updatedAt: Date;
}
