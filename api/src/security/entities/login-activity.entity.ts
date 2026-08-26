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

// Short, stable, dot-namespaced — same convention as AdminAction.action —
// so this stays filterable as the list of outcomes grows, rather than a
// free-text message.
export type LoginActivityReason =
  "success" | "invalid_credentials" | "invalid_2fa_code" | "ip_not_allowlisted";

/**
 * Every completed login attempt — password-only, or the final 2FA step for
 * an account that has it enabled — success or failure. This is the "who
 * signed in, from where, on what device" oversight trail (distinct from
 * AdminAction, which logs *mutations* an already-authenticated admin
 * makes, not the sign-in event itself) and the raw material for basic
 * brute-force detection: a burst of `invalid_credentials` rows against one
 * email or from one IP is the signal a super admin's Security page
 * surfaces.
 *
 * Deliberately does NOT log the intermediate "password correct, 2FA still
 * pending" moment from POST /auth/login — only the flow's actual outcome
 * (a session issued, or a final rejection). A 2FA-gated login therefore
 * produces exactly one row, from POST /auth/2fa/verify, not two.
 *
 * Write-only from the app's perspective, same as AdminAction — nothing
 * ever updates or deletes a row here.
 */
@Entity("login_activity")
export class LoginActivity {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  // Nullable — a failed attempt against an email with no account still
  // needs to be recorded (that's exactly the account-enumeration/
  // brute-force case a super admin cares about), but there's no user row
  // to reference.
  @ManyToOne(() => User, { eager: true, nullable: true })
  @JoinColumn({ name: "user_id" })
  user: User | null;

  @Column({ name: "user_id", type: "uuid", nullable: true })
  userId: string | null;

  // The email the attempt was made against, independent of whether it
  // resolved to a real account — always captured, since "someone is
  // guessing passwords for admin@..." is exactly the case `userId` alone
  // can't show for a wrong-email attempt.
  @Index()
  @Column({ name: "email_attempted", type: "varchar", length: 255 })
  emailAttempted: string;

  @Column({ type: "boolean" })
  success: boolean;

  @Column({ type: "varchar", length: 40 })
  reason: LoginActivityReason;

  @Column({ name: "ip_address", type: "varchar", length: 64, nullable: true })
  ipAddress: string | null;

  @Column({ name: "user_agent", type: "text", nullable: true })
  userAgent: string | null;

  @Index()
  @CreateDateColumn({ name: "created_at" })
  createdAt: Date;
}
