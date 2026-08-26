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
 * internal) before a User ever leaves the API. */
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
