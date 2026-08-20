// The permission model behind "Role-Based Administration": every
// sensitive action in the admin panel is named as a Capability, and a
// Capability resolves to a required role tier. Today that tier is one of
// the two real roles the backend actually enforces (isAdmin / isSuperAdmin
// — see AdminGuard/SuperAdminGuard) — this file is deliberately *not* a
// dynamic, database-driven permissions engine, because there is nothing
// to drive it with yet (one admin tier, one super-admin tier). What it
// does give the rest of the app: a single named, typed vocabulary for
// "who can do this" that both the sidebar and every action button read
// from, instead of scattered `user?.isSuperAdmin` checks that can drift
// out of sync with each other. Adding a real third role later is a change
// to the RoleTier type and this map, not a rewrite of every page.
//
// The actual security boundary is still, and only, the backend guards —
// this is what decides what the UI *offers*, matching what the API will
// actually *allow*.

export type RoleTier = "admin" | "superAdmin";

export type Capability =
  // Content — catalog CRUD and moderation
  | "content.view"
  | "content.create"
  | "content.edit"
  | "content.delete"
  | "content.moderate"
  | "content.export"
  // Analytics
  | "analytics.view"
  | "analytics.export"
  // Users & Roles
  | "users.view"
  | "users.manage"
  // Security
  | "security.view"
  | "security.manage"
  | "audit.view"
  // Settings / System — nothing is actually configurable here yet (see
  // the Settings section's placeholder pages), but the capability exists
  // so the moment something real is built, it already has a permission.
  | "settings.manage"
  | "system.view";

const SUPER_ADMIN_ONLY: ReadonlySet<Capability> = new Set<Capability>([
  "content.delete",
  "users.view",
  "users.manage",
  "security.view",
  "security.manage",
  "audit.view",
  "settings.manage",
  "system.view",
]);

export function capabilityTier(capability: Capability): RoleTier {
  return SUPER_ADMIN_ONLY.has(capability) ? "superAdmin" : "admin";
}

export interface CapabilityUser {
  isAdmin?: boolean;
  isSuperAdmin?: boolean;
}

export function hasCapability(
  user: CapabilityUser | null | undefined,
  capability: Capability,
): boolean {
  if (!user) return false;
  if (capabilityTier(capability) === "superAdmin") return Boolean(user.isSuperAdmin);
  return Boolean(user.isAdmin || user.isSuperAdmin);
}

// The eight action verbs the spec calls for (View/Create/Edit/Delete/
// Publish/Approve/Export/Manage), mapped onto what each concretely means
// for this app today — used by the Roles & Permissions reference page so
// "what can each role do" is documented from the same source of truth the
// nav/buttons actually check, not a separately-maintained table that can
// drift.
export const CAPABILITY_LABELS: Record<Capability, string> = {
  "content.view": "View catalog content (places, categories, events, counties)",
  "content.create": "Create catalog content",
  "content.edit": "Edit catalog content",
  "content.delete": "Delete catalog content",
  "content.moderate": "Approve/verify listings, remove flagged reviews & events",
  "content.export": "Export content/report data",
  "analytics.view": "View analytics & B2B reports",
  "analytics.export": "Export analytics data",
  "users.view": "View the full user list",
  "users.manage": "Grant/revoke admin and super admin access",
  "security.view": "View security overview, login activity, sessions",
  "security.manage": "Revoke sessions, manage security policy",
  "audit.view": "View the admin audit log",
  "settings.manage": "Manage application settings",
  "system.view": "View system/operations status",
};
