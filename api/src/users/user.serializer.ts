import { User } from "./entities/user.entity";

export interface PublicUser {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  authProvider: string;
  homeCounty: User["homeCounty"];
  isAdmin: boolean;
  isSuperAdmin: boolean;
  travelerType: User["travelerType"];
  interests: string[];
  twoFactorEnabled: boolean;
  emailVerified: boolean;
  createdAt: Date;
  /** True for an account created via AdminTeamService.createAdmin that
   * hasn't set a password yet — the only path that creates a User with
   * passwordHash: null today (registration and OAuth both require one).
   * Not sensitive: just "can this account log in yet", used to show a
   * pending-invite state on the Team & Access roster. */
  pendingActivation: boolean;
}

/** Strips passwordHash, twoFactorSecret, twoFactorRecoveryCodes,
 * tokenVersion, verification/reset token hashes (and anything else
 * internal) before a User ever leaves the API.
 *
 * Despite the name, this is NOT safe to hand to an anonymous visitor —
 * it still carries email, isAdmin/isSuperAdmin, twoFactorEnabled, phone,
 * and more. It's for a viewer who's already cleared some access check of
 * their own: the account's own owner, an admin-guarded route, or a
 * counterparty in an already-authenticated 1:1 context (a booking, a
 * message thread, a trip's own collaborators). Security audit (Sep 4,
 * 2026): a handful of genuinely public, unauthenticated endpoints
 * (`GET /advertisements/active` among others) were passing an owner/
 * creator/author straight through this function, so any visitor — no
 * account required — could read an admin's email and confirm their
 * super-admin status and whether they had 2FA enabled just by finding
 * something that account happened to own or write. Use
 * `toPublicProfile` below for any endpoint reachable without
 * authentication. */
export function toPublicUser(user: User): PublicUser {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    phone: user.phone,
    authProvider: user.authProvider,
    homeCounty: user.homeCounty,
    isAdmin: user.isAdmin,
    isSuperAdmin: user.isSuperAdmin,
    travelerType: user.travelerType,
    interests: user.interests,
    twoFactorEnabled: user.twoFactorEnabled,
    emailVerified: user.emailVerified,
    createdAt: user.createdAt,
    pendingActivation: user.passwordHash === null,
  };
}

export interface PublicProfile {
  id: string;
  name: string;
}

/** The actually-public shape: just enough to attribute a place, business,
 * ad, listing, review, or trip to whoever owns/wrote it — a name to show
 * next to "Organized by" or "Owner" — with nothing an anonymous visitor
 * could use to profile the account (no email, no admin/super-admin flag,
 * no 2FA status, no phone). Use this, not `toPublicUser`, in any
 * controller method that isn't behind `@UseGuards(JwtAuthGuard)` (or
 * stronger) — see `toPublicUser`'s doc comment for why. */
export function toPublicProfile(user: User): PublicProfile {
  return { id: user.id, name: user.name };
}

export interface InvitableUser {
  id: string;
  name: string;
  maskedEmail: string;
}

/** "j***@example.com" — enough for someone to recognize their own friend
 * in a search result (or tell two "John Doe"s apart) without a search box
 * anywhere in the app becoming a way to harvest full email addresses.
 * Used only for the trip-invitation people picker (Section 9: "Do not
 * reveal unnecessary account information when searching for users"). */
export function maskEmail(email: string): string {
  const [local, domain] = email.split("@");
  if (!domain) return email;
  const visible = local.slice(0, Math.min(2, local.length));
  const hidden = "*".repeat(Math.max(local.length - visible.length, 1));
  return `${visible}${hidden}@${domain}`;
}

export function toInvitableUser(user: User): InvitableUser {
  return { id: user.id, name: user.name, maskedEmail: maskEmail(user.email) };
}
