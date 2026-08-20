'use client';

import Link from 'next/link';
import { CAPABILITY_LABELS, capabilityTier, type Capability } from '@/lib/capabilities';
import { AdminPageHeader, Panel } from '@/components/admin-ui';

// Users & Roles > Roles & Permissions (also linked from Security > Access
// Control) — a reference, not an editor. There are two real role tiers
// today (Admin, Super Admin — enforced by AdminGuard/SuperAdminGuard on
// the API, the only thing that actually matters), so a page that *looks*
// like a roles-management UI but doesn't actually create/edit roles would
// be showing controls that do nothing. This instead documents, from the
// exact same capabilities.ts map the sidebar and every gated button in
// this app read from, what each tier can actually do — so "what can Admin
// do vs. Super Admin" has one real, current answer instead of drifting
// out of sync with a separately-maintained doc.
export default function RolesPage() {
  const capabilities = Object.keys(CAPABILITY_LABELS) as Capability[];
  const adminCapabilities = capabilities.filter((c) => capabilityTier(c) === 'admin');
  const superAdminOnly = capabilities.filter((c) => capabilityTier(c) === 'superAdmin');

  return (
    <div className="flex flex-col gap-6">
      <AdminPageHeader
        title="Roles & Permissions"
        description="What each role tier can actually do, read from the same source the rest of the admin panel enforces against."
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="Admin">
          <p className="mb-2 text-xs text-slate-500 dark:text-slate-400">
            Every capability below, on every account with admin access — Super Admin included, since it&apos;s the
            higher tier, not a separate one.
          </p>
          <ul className="flex flex-col gap-1.5">
            {adminCapabilities.map((c) => (
              <li key={c} className="text-sm text-slate-700 dark:text-slate-200">
                {CAPABILITY_LABELS[c]}
              </li>
            ))}
          </ul>
        </Panel>

        <Panel title="Super Admin only">
          <p className="mb-2 text-xs text-slate-500 dark:text-slate-400">
            Everything Admin can do, plus the platform-oversight actions below — granting/revoking access, security,
            and audit visibility aren&apos;t handed to every admin by default.
          </p>
          <ul className="flex flex-col gap-1.5">
            {superAdminOnly.map((c) => (
              <li key={c} className="text-sm text-slate-700 dark:text-slate-200">
                {CAPABILITY_LABELS[c]}
              </li>
            ))}
          </ul>
        </Panel>
      </div>

      <div className="rounded-xl border border-dashed border-slate-300 px-4 py-4 text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
        Custom, per-admin roles (e.g. a &quot;Content Editor&quot; who can&apos;t touch bookings) aren&apos;t built
        yet — today&apos;s two tiers are enforced directly by the API (
        <code className="rounded bg-slate-100 px-1 py-0.5 text-xs dark:bg-slate-800">AdminGuard</code> /{' '}
        <code className="rounded bg-slate-100 px-1 py-0.5 text-xs dark:bg-slate-800">SuperAdminGuard</code>), not a
        database-driven permission engine. Manage who holds which tier from{' '}
        <Link href="/admin/team" className="font-medium text-brand-700 hover:underline dark:text-brand-300">
          Administrators
        </Link>
        .
      </div>
    </div>
  );
}
