'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { ShieldExclamationIcon, ShieldCheckIcon, GlobeAltIcon, ArrowRightIcon } from '@heroicons/react/24/outline';
import { SuperAdminGate } from '@/components/SuperAdminGate';
import { useAuth } from '@/hooks/useAuth';
import { getSecurityOverview } from '@/lib/admin-api';
import type { SecurityOverview } from '@/lib/types';
import { AdminPageHeader } from '@/components/admin-ui';
import { StatCard } from './security-shared';

// Security > Security Overview — the landing summary; the working pages
// (full sign-in history, forced sign-out, the raw failed-login feed) live
// on their own routes now (Login & Authentication / Sessions & Devices /
// Security Alerts) so this stays a fast "is everything okay" read,
// matching the rest of the redesign's Overview-then-drill-down pattern.
export default function AdminSecurityPage() {
  return (
    <SuperAdminGate>
      <SecurityOverviewDashboard />
    </SuperAdminGate>
  );
}

function SecurityOverviewDashboard() {
  const { token } = useAuth();
  const [overview, setOverview] = useState<SecurityOverview | null>(null);

  useEffect(() => {
    if (!token) return;
    getSecurityOverview(token).then(setOverview);
  }, [token]);

  const adoptionPct =
    overview && overview.adminTwoFactorAdoption.total > 0
      ? Math.round((overview.adminTwoFactorAdoption.enabled / overview.adminTwoFactorAdoption.total) * 100)
      : 0;

  return (
    <div className="flex flex-col gap-8">
      <AdminPageHeader
        title="Security Overview"
        description="Sign-in health at a glance — drill into the sections below for the full picture."
      />

      {overview && (
        <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatCard
            label="Failed logins (1h)"
            value={overview.failedLoginsLast1h}
            icon={ShieldExclamationIcon}
            tone={overview.failedLoginsLast1h > 5 ? 'warning' : undefined}
          />
          <StatCard
            label="Failed logins (24h)"
            value={overview.failedLoginsLast24h}
            icon={ShieldExclamationIcon}
            tone={overview.failedLoginsLast24h > 20 ? 'warning' : undefined}
          />
          <StatCard label="Distinct failing IPs (24h)" value={overview.distinctFailingIpsLast24h} icon={GlobeAltIcon} />
          <StatCard
            label={`Admin 2FA adoption (${overview.adminTwoFactorAdoption.enabled}/${overview.adminTwoFactorAdoption.total})`}
            value={`${adoptionPct}%`}
            icon={ShieldCheckIcon}
            tone={adoptionPct < 100 ? 'warning' : undefined}
          />
        </section>
      )}

      <div className="grid gap-3 sm:grid-cols-3">
        <SectionLink
          href="/admin/security/login"
          label="Login & Authentication"
          description="Full sign-in history, success and failure, with device info."
        />
        <SectionLink
          href="/admin/security/sessions"
          label="Sessions & Devices"
          description="Force-end every active session on an account."
        />
        <SectionLink
          href="/admin/security/alerts"
          label="Security Alerts"
          description="Just the failed attempts — the brute-force / account-enumeration view."
        />
      </div>
    </div>
  );
}

function SectionLink({ href, label, description }: { href: string; label: string; description: string }) {
  return (
    <Link
      href={href}
      className="group flex items-start justify-between gap-2 rounded-xl border border-slate-200 bg-white p-4 shadow-card transition-all hover:-translate-y-0.5 hover:border-brand-300 hover:shadow-card-hover dark:border-slate-800 dark:bg-slate-900"
    >
      <div className="flex-1">
        <p className="font-semibold text-slate-900 dark:text-slate-50">{label}</p>
        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{description}</p>
      </div>
      <ArrowRightIcon
        aria-hidden
        className="mt-1 h-4 w-4 shrink-0 text-slate-400 transition-transform group-hover:translate-x-0.5 group-hover:text-brand-700 dark:group-hover:text-brand-300 dark:hover:text-brand-300"
      />
    </Link>
  );
}
