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

  @CreateDateColumn({ name: "created_at" })
  createdAt: Date;

  @UpdateDateColumn({ name: "updated_at" })
  updatedAt: Date;
}
