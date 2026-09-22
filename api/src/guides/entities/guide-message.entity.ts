import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from "typeorm";
import { User } from "../../users/entities/user.entity";
import { GuideProfile } from "./guide-profile.entity";

@Entity("guide_messages")
export class GuideMessage {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @ManyToOne(() => GuideProfile, { onDelete: "CASCADE" })
  @JoinColumn({ name: "guide_id" })
  guide: GuideProfile;

  @Column({ name: "guide_id" })
  guideId: string;

  @ManyToOne(() => User, { eager: true, onDelete: "CASCADE" })
  @JoinColumn({ name: "visitor_id" })
  visitor: User;

  @Column({ name: "visitor_id" })
  visitorId: string;

  @ManyToOne(() => User, { eager: true, onDelete: "CASCADE" })
  @JoinColumn({ name: "sender_id" })
  sender: User;

  @Column({ name: "sender_id" })
  senderId: string;

  @Column({ type: "text" })
  body: string;

  @Column({ name: "read_at", type: "timestamptz", nullable: true })
  readAt: Date | null;

  @CreateDateColumn({ name: "created_at" })
  createdAt: Date;
}
