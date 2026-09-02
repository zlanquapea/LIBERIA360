'use client';

import { useEffect, useState } from 'react';
import { ClockIcon, ComputerDesktopIcon } from '@heroicons/react/24/outline';
import { SuperAdminGate } from '@/components/SuperAdminGate';
import { LoadingState } from '@/components/admin-ui';
import { useAuth } from '@/hooks/useAuth';
import { getAuditLog } from '@/lib/admin-api';
import { parseUserAgent } from '@/lib/user-agent';
import type { AdminAction, PaginatedAdminActions } from '@/lib/types';

// Audit trail (Tech Spec §7/§8, super admin only) — "who did this and
// from what." The API has recorded this since the content-moderation
// work (admin_actions table), but until now there was no page to read
// it from — GET /admin/audit-log had zero frontend consumer.
export default function AdminAuditLogPage() {
  return (
    <SuperAdminGate>
      <AuditLog />
    </SuperAdminGate>
  );
}

// A short, readable label for each dot-namespaced action string
// (AdminAction.action) — falls back to the raw string for anything not
// listed here, so a new action type added later still renders, just
// less prettily, instead of breaking.
const ACTION_LABELS: Record<string, string> = {
  'place.verification_changed': 'Changed place verification',
  'business.verification_changed': 'Changed business verification',
  'admin_team.roles_changed': 'Changed admin roles',
  'sponsored_placement.created': 'Created sponsored placement',
  'sponsored_placement.revoked': 'Revoked sponsored placement',
  'event.removed': 'Removed event',
  'review.removed': 'Removed review',
  'user.sessions_revoked': 'Revoked user sessions',
};

function AuditLog() {
  const { token } = useAuth();
  const [page, setPage] = useState(1);
  const [result, setResult] = useState<PaginatedAdminActions | null>(null);

  useEffect(() => {
    if (!token) return;
    getAuditLog(token, page).then(setResult);
  }, [token, page]);

  if (!token) return null;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-bold text-slate-900 dark:text-slate-50">Audit Log</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Every verification change, role change, sponsored-placement create/revoke, content removal, and forced
          session revocation — who did it, when, and from what device.
        </p>
      </div>

      {!result ? (
        <LoadingState />
      ) : result.data.length === 0 ? (
        <p className="rounded-xl border border-dashed border-slate-300 dark:border-slate-700 px-4 py-8 text-center text-sm text-slate-500 dark:text-slate-400">
          Nothing recorded yet.
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {result.data.map((entry) => (
            <AuditLogRow key={entry.id} entry={entry} />
          ))}
        </ul>
      )}

      {result && result.meta.totalPages > 1 && (
        <div className="flex items-center justify-between text-sm">
          <button
            type="button"
            disabled={page <= 1}
            onClick={() => setPage((p) => p - 1)}
            className="rounded-full border border-slate-300 dark:border-slate-700 px-3 py-1.5 font-medium text-slate-700 dark:text-slate-200 hover:border-brand-500 disabled:opacity-40"
          >
            ← Previous
          </button>
          <span className="text-slate-500 dark:text-slate-400">
            Page {result.meta.page} of {result.meta.totalPages}
          </span>
          <button
            type="button"
            disabled={page >= result.meta.totalPages}
            onClick={() => setPage((p) => p + 1)}
            className="rounded-full border border-slate-300 dark:border-slate-700 px-3 py-1.5 font-medium text-slate-700 dark:text-slate-200 hover:border-brand-500 disabled:opacity-40"
          >
            Next →
          </button>
        </div>
      )}
    </div>
  );
}

function AuditLogRow({ entry }: { entry: AdminAction }) {
  return (
    <li className="flex flex-col gap-1 rounded-xl border border-slate-200 dark:border-slate-800 p-3 text-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="font-medium text-slate-900 dark:text-slate-50">{ACTION_LABELS[entry.action] ?? entry.action}</p>
        <span className="flex items-center gap-1 text-xs text-slate-400 dark:text-slate-400">
          <ClockIcon aria-hidden className="h-3.5 w-3.5" />
          {new Date(entry.createdAt).toLocaleString()}
        </span>
      </div>
      <p className="text-xs text-slate-500 dark:text-slate-400">
        by {entry.adminUser.name} ({entry.adminUser.email})
        {entry.targetType && entry.targetId && (
          <>
            {' '}
            · {entry.targetType} <code className="text-slate-400 dark:text-slate-400">{entry.targetId.slice(0, 8)}</code>
          </>
        )}
      </p>
      <p className="flex items-center gap-1 text-xs text-slate-400 dark:text-slate-400">
        <ComputerDesktopIcon aria-hidden className="h-3.5 w-3.5" />
        {parseUserAgent(entry.userAgent)}
        {entry.ipAddress && <> · {entry.ipAddress}</>}
      </p>
      {entry.metadata && Object.keys(entry.metadata).length > 0 && (
        <pre className="mt-1 overflow-x-auto rounded-lg bg-slate-50 dark:bg-slate-800 p-2 text-xs text-slate-600 dark:text-slate-300">
          {JSON.stringify(entry.metadata, null, 2)}
        </pre>
      )}
    </li>
  );
}
