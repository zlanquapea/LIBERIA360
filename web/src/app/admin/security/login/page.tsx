'use client';

import { useEffect, useState } from 'react';
import { SuperAdminGate } from '@/components/SuperAdminGate';
import { useAuth } from '@/hooks/useAuth';
import { getLoginActivity } from '@/lib/admin-api';
import type { PaginatedLoginActivity } from '@/lib/types';
import { AdminPageHeader, EmptyState, LoadingState } from '@/components/admin-ui';
import { LoginActivityRow } from '../security-shared';

// Security > Login & Authentication — every completed sign-in attempt,
// success or failure, with device/IP. Split out of the old combined
// Security page so it has its own URL (and its own place in the nav) —
// see Security Alerts for the failures-only view of this same data.
export default function LoginAuthenticationPage() {
  return (
    <SuperAdminGate>
      <LoginActivityList />
    </SuperAdminGate>
  );
}

function LoginActivityList() {
  const { token } = useAuth();
  const [activity, setActivity] = useState<PaginatedLoginActivity | null>(null);
  const [onlyFailed, setOnlyFailed] = useState(false);
  const [page, setPage] = useState(1);

  useEffect(() => {
    if (!token) return;
    getLoginActivity(token, { page, onlyFailed }).then(setActivity);
  }, [token, page, onlyFailed]);

  return (
    <div className="flex flex-col gap-6">
      <AdminPageHeader title="Login & Authentication" description="Full sign-in history across every account." />

      <label className="flex w-fit items-center gap-1.5 text-xs font-medium text-slate-600 dark:text-slate-300">
        <input
          type="checkbox"
          checked={onlyFailed}
          onChange={(e) => {
            setOnlyFailed(e.target.checked);
            setPage(1);
          }}
          className="rounded border-slate-300 text-brand-600 dark:text-brand-300 focus:ring-brand-500 dark:border-slate-700"
        />
        Failed attempts only
      </label>

      {!activity ? (
        <LoadingState />
      ) : activity.data.length === 0 ? (
        <EmptyState title="Nothing recorded yet." />
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
