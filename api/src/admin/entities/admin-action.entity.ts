import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from "typeorm";
import { User } from "../../users/entities/user.entity";

/**
 * Accountability log for admin-only mutations — "who verified this
 * business, who promoted this admin, who revoked this paid placement."
 * Scoped to the handful of actions that are either genuinely sensitive
 * (admin role changes) or have real business/money stakes (sponsored
 * placements), not every PATCH an admin makes to catalog content — that
 * would be a lot of low-stakes noise for comparatively little
 * accountability value. Write-only from the app's perspective: nothing
 * ever updates or deletes a row here.
 */
@Entity("admin_actions")
export class AdminAction {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @ManyToOne(() => User, { eager: true })
  @JoinColumn({ name: "admin_user_id" })
  adminUser: User;

  @Column({ name: "admin_user_id" })
  adminUserId: string;

  // A short, stable, dot-namespaced identifier — e.g.
  // "place.verification_changed", "admin_team.roles_changed" — not a
  // free-text description, so this stays queryable/filterable as the
  // list of action types grows.
  @Column({ type: "varchar", length: 100 })
  action: string;

  // What the action was performed on, loosely typed on purpose (a place,
  // a business, a user, a sponsored placement, ...) rather than a foreign
  // key to any one table — this log spans several unrelated entities.
  @Column({ name: "target_type", type: "varchar", length: 50 })
  targetType: string;

  @Column({ name: "target_id", type: "uuid", nullable: true })
  targetId: string | null;

  // Free-form context specific to the action (old/new verification
  // status, old/new roles, ...) — never PII beyond what's already visible
  // elsewhere (ids, not e.g. a user's raw email).
  @Column({ type: "jsonb", nullable: true })
  metadata: Record<string, unknown> | null;

  @CreateDateColumn({ name: "created_at" })
  createdAt: Date;
}
