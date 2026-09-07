'use client';

import { useEffect, useState } from 'react';
import { GlobeAltIcon, ShieldExclamationIcon } from '@heroicons/react/24/outline';
import { SuperAdminGate } from '@/components/SuperAdminGate';
import { useAuth } from '@/hooks/useAuth';
import { getLoginActivity, getSecurityOverview } from '@/lib/admin-api';
import type { PaginatedLoginActivity, SecurityOverview } from '@/lib/types';
import { AdminPageHeader, EmptyState, LoadingState } from '@/components/admin-ui';
import { LoginActivityRow, StatCard } from '../security-shared';

// Security > Security Alerts — the brute-force / account-enumeration
// view: failed sign-in attempts only, newest first, with the same 1h/24h
// counts from Overview for context. Distinct from Login & Authentication,
// which shows everything (success included).
export default function SecurityAlertsPage() {
  return (
    <SuperAdminGate>
      <AlertsFeed />
    </SuperAdminGate>
  );
}

function AlertsFeed() {
  const { token } = useAuth();
  const [overview, setOverview] = useState<SecurityOverview | null>(null);
  const [activity, setActivity] = useState<PaginatedLoginActivity | null>(null);
  const [page, setPage] = useState(1);

  useEffect(() => {
    if (!token) return;
    getSecurityOverview(token).then(setOverview);
  }, [token]);

  useEffect(() => {
    if (!token) return;
    getLoginActivity(token, { page, onlyFailed: true }).then(setActivity);
  }, [token, page]);

  return (
    <div className="flex flex-col gap-6">
      <AdminPageHeader title="Security Alerts" description="Failed sign-in attempts — newest first." />

      {overview && (
        <section className="grid grid-cols-2 gap-3 sm:grid-cols-3">
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
        </section>
      )}

      {!activity ? (
        <LoadingState />
      ) : activity.data.length === 0 ? (
        <EmptyState title="No failed sign-in attempts recorded." />
      ) : (
        <ul className="flex flex-col gap-2">
          {activity.data.map((entry) => (
            <LoginActivityRow key={entry.id} entry={entry} />
          ))}
        </ul>
      )}

      {activity && activity.meta.totalPages > 1 && (
        <div className="flex items-center justify-between text-sm">
          <button
            type="button"
            disabled={page <= 1}
            onClick={() => setPage((p) => p - 1)}
            className="rounded-full border border-slate-300 px-3 py-1.5 font-medium text-slate-700 hover:border-brand-500 disabled:opacity-40 dark:border-slate-700 dark:text-slate-200"
          >
            ← Previous
          </button>
          <span className="text-slate-500 dark:text-slate-400">
            Page {activity.meta.page} of {activity.meta.totalPages}
          </span>
          <button
            type="button"
            disabled={page >= activity.meta.totalPages}
            onClick={() => setPage((p) => p + 1)}
            className="rounded-full border border-slate-300 px-3 py-1.5 font-medium text-slate-700 hover:border-brand-500 disabled:opacity-40 dark:border-slate-700 dark:text-slate-200"
          >
            Next →
          </button>
        </div>
      )}
    </div>
  );
}
