import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from "typeorm";
import { User } from "../../users/entities/user.entity";
import { Creator } from "./creator.entity";

@Entity("creator_follows")
@Index(
  "IDX_creator_follows_creator_id_user_id_unique",
  ["creatorId", "userId"],
  { unique: true },
)
@Index("IDX_creator_follows_user_id", ["userId"])
@Index("IDX_creator_follows_creator_id", ["creatorId"])
export class CreatorFollow {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @ManyToOne(() => Creator, { onDelete: "CASCADE" })
  @JoinColumn({ name: "creator_id" })
  creator: Creator;

  @Column({ name: "creator_id" })
  creatorId: string;

  @ManyToOne(() => User, { onDelete: "CASCADE" })
  @JoinColumn({ name: "user_id" })
  user: User;

  @Column({ name: "user_id" })
  userId: string;

  @CreateDateColumn({ name: "created_at" })
  createdAt: Date;
}
