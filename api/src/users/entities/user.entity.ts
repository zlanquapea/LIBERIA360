import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from "typeorm";
import { County } from "../../counties/entities/county.entity";
import { AuthProvider, TravelerType } from "./user.enums";

/** Phase 2 account (Tech Spec §5 User + §3.2). */
@Entity("users")
export class User {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({ type: "varchar", length: 150 })
  name: string;

  @Column({ type: "varchar", length: 255, unique: true })
  email: string;

  // Only the email/password provider is implemented, so this is required in
  // practice; nullable at the DB level so a future OAuth-only account
  // (Google/Apple) doesn't need a fabricated password.
  @Column({
    name: "password_hash",
    type: "varchar",
    length: 255,
    nullable: true,
  })
  passwordHash: string | null;

  @Column({ type: "varchar", length: 40, nullable: true })
  phone: string | null;

  @Column({
    name: "auth_provider",
    type: "enum",
    enum: AuthProvider,
    default: AuthProvider.EMAIL,
  })
  authProvider: AuthProvider;

  @ManyToOne(() => County, { eager: true, nullable: true })
  @JoinColumn({ name: "home_county_id" })
  homeCounty: County | null;

  @Column({ name: "home_county_id", nullable: true })
  homeCountyId: string | null;

  // Admin flag backing the verification-badge workflow (Tech Spec §7/§8).
  @Column({ name: "is_admin", type: "boolean", default: false })
  isAdmin: boolean;

  // Two-tier admin (Tech Spec §7/§8): a super admin can grant/revoke admin
  // access on other accounts (see AdminTeamService) and gets first claim on
  // anything platform-sensitive as that surfaces later (pricing, payouts).
  // A super admin is conceptually also an admin — SuperAdminGuard doesn't
  // additionally require isAdmin, but every admin.controller.ts endpoint
  // checks isAdmin, which the team-management flow always sets alongside
  // isSuperAdmin — see AdminTeamService.setRoles.
  @Column({ name: "is_super_admin", type: "boolean", default: false })
  isSuperAdmin: boolean;

  // Optional, editable after signup (PATCH /auth/me) — see TravelerType's
  // doc comment for why this exists.
  @Column({
    name: "traveler_type",
    type: "enum",
    enum: TravelerType,
    nullable: true,
  })
  travelerType: TravelerType | null;

  // Reuses Category.slug as its vocabulary — the same tags the Trip
  // Planner already uses (Tech Spec §4.3), captured once at signup so it
  // can pre-fill trip generation and (later) personalize what's surfaced
  // on Home, instead of being asked again every time.
  @Column({ type: "text", array: true, default: () => "'{}'" })
  interests: string[];

  // AES-256-GCM encrypted (see auth/two-factor-crypto.ts) — never stored
  // or returned as plaintext. Null until the user starts 2FA setup.
  @Column({ name: "two_factor_secret", type: "text", nullable: true })
  twoFactorSecret: string | null;

  // True only once setup has been confirmed with a valid code — a secret
  // can exist mid-setup without this being true yet, so login only branches
  // on this flag, never on twoFactorSecret being non-null.
  @Column({ name: "two_factor_enabled", type: "boolean", default: false })
  twoFactorEnabled: boolean;

  // bcrypt hashes of one-time recovery codes (same treatment as
  // passwords) — plaintext codes are shown to the user once, at
  // generation time, and never stored.
  @Column({
    name: "two_factor_recovery_codes",
    type: "text",
    array: true,
    nullable: true,
  })
  twoFactorRecoveryCodes: string[] | null;

  // Bumped on password change, "sign out of all other devices", and
  // account deletion — every issued JWT carries the tokenVersion it was
  // signed with, and JwtStrategy rejects a token whose version doesn't
  // match the current one. This is what makes a JWT actually revocable
  // without a server-side token blacklist: the existing "re-fetch the
  // user on every request" behavior already does the DB round-trip this
  // needs, so it's one integer comparison, not new infrastructure.
  @Column({ name: "token_version", type: "int", default: 0 })
  tokenVersion: number;

  // Never blocks access to the app (most Phase 1-3 features work the same
  // either way) — this only exists so a typo'd signup email is visible
  // and recoverable, and to build toward a future where email delivery
  // (booking confirmations, etc.) needs a real, checked address.
  @Column({ name: "email_verified", type: "boolean", default: false })
  emailVerified: boolean;

  // SHA-256 of the verification token, never the token itself — same
  // "don't store the credential in a form usable if the DB leaks"
  // reasoning as password/recovery-code hashing, just a cheap fast hash
  // instead of bcrypt since this is a high-entropy random token being
  // looked up by exact match, not a low-entropy secret being brute-forced.
  @Column({
    name: "email_verification_token_hash",
    type: "text",
    nullable: true,
  })
  emailVerificationTokenHash: string | null;

  @Column({
    name: "email_verification_token_expires_at",
    type: "timestamptz",
    nullable: true,
  })
  emailVerificationTokenExpiresAt: Date | null;

  @Column({ name: "password_reset_token_hash", type: "text", nullable: true })
  passwordResetTokenHash: string | null;

  @Column({
    name: "password_reset_token_expires_at",
    type: "timestamptz",
    nullable: true,
  })
  passwordResetTokenExpiresAt: Date | null;

  // Set on account deletion (DELETE /auth/me) — the row is anonymized in
  // place (name, email, phone cleared/randomized; passwordHash nulled so
  // login is impossible) rather than hard-deleted, so a deleted user's
  // reviews, bookings, and messages don't silently vanish out from under
  // the businesses/other travelers who depend on that history — the same
  // "anonymize, don't erase" approach most platforms with cross-user
  // content use. `name` becomes "Deleted user", which is why no separate
  // "is this user deleted" check is needed on most display paths — the
  // anonymized row already reads correctly everywhere `user.name` does.
  @Column({ name: "deleted_at", type: "timestamptz", nullable: true })
  deletedAt: Date | null;

  @CreateDateColumn({ name: "created_at" })
  createdAt: Date;

  @UpdateDateColumn({ name: "updated_at" })
  updatedAt: Date;
}
