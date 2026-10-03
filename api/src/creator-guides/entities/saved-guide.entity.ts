import {
  CreateDateColumn,
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
} from "typeorm";
import { User } from "../../users/entities/user.entity";
import { CreatorGuide } from "./creator-guide.entity";

@Entity("saved_guides")
@Unique(["userId", "guideId"])
export class SavedGuide {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @ManyToOne(() => User, { onDelete: "CASCADE" })
  @JoinColumn({ name: "user_id" })
  user: User;

  @Index()
  @Column({ name: "user_id" })
  userId: string;

  @ManyToOne(() => CreatorGuide, { onDelete: "CASCADE" })
  @JoinColumn({ name: "guide_id" })
  guide: CreatorGuide;

  @Column({ name: "guide_id" })
  guideId: string;

  @CreateDateColumn({ name: "created_at", type: "timestamptz" })
  createdAt: Date;
}
