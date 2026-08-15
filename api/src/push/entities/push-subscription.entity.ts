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

/**
 * A browser's Web Push subscription (Tech Spec §3.2 push notifications —
 * the PWA/web-push flavor; FCM/APNs for a future native app is a separate
 * concern). One row per browser/device the user has enabled notifications
 * on, keyed by the endpoint the browser's push service assigned it.
 */
@Entity("push_subscriptions")
export class PushSubscription {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @ManyToOne(() => User, { onDelete: "CASCADE" })
  @JoinColumn({ name: "user_id" })
  user: User;

  @Index()
  @Column({ name: "user_id" })
  userId: string;

  @Column({ type: "text", unique: true })
  endpoint: string;

  @Column({ type: "varchar", length: 255 })
  p256dh: string;

  @Column({ type: "varchar", length: 255 })
  auth: string;

  @CreateDateColumn({ name: "created_at" })
  createdAt: Date;
}
