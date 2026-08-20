'use client';

import { useEffect, useState } from 'react';
import {
  BoltIcon,
  CheckCircleIcon,
  CircleStackIcon,
  CloudIcon,
  EnvelopeIcon,
  ExclamationCircleIcon,
  ServerIcon,
} from '@heroicons/react/24/outline';
import { SuperAdminGate } from '@/components/SuperAdminGate';
import { useAuth } from '@/hooks/useAuth';
import { getSystemStatus } from '@/lib/admin-api';
import type { SystemStatus } from '@/lib/types';
import { AdminPageHeader, LoadingState, Panel } from '@/components/admin-ui';

function formatUptime(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (hours === 0) return `${minutes}m`;
  return `${hours}h ${minutes}m`;
}

// System / Operations — real runtime state (see AdminSystemService's doc
// comment), not a mock: which storage backend and integrations are
// actually configured right now. No secrets, hostnames, or credentials
// are ever returned — just whether each one is on.
export default function SystemStatusPage() {
  return (
    <SuperAdminGate>
      <SystemStatusPanel />
    </SuperAdminGate>
  );
}

function SystemStatusPanel() {
  const { token } = useAuth();
  const [status, setStatus] = useState<SystemStatus | null>(null);

  useEffect(() => {
    if (!token) return;
    getSystemStatus(token).then(setStatus);
  }, [token]);

  if (!status) {
    return (
      <div className="flex flex-col gap-6">
        <AdminPageHeader title="System / Operations" description="Runtime status and integration health." />
        <LoadingState />
      </div>
    );
  }

  const integrations: { label: string; on: boolean; icon: typeof EnvelopeIcon }[] = [
    { label: 'Transactional email', on: status.integrations.email, icon: EnvelopeIcon },
    { label: 'Push notifications', on: status.integrations.pushNotifications, icon: BoltIcon },
    { label: 'Crash reporting', on: status.integrations.crashReporting, icon: ExclamationCircleIcon },
  ];

  return (
    <div className="flex flex-col gap-6">
      <AdminPageHeader title="System / Operations" description="Runtime status and integration health." />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatusCard icon={ServerIcon} label="Environment" value={status.environment} />
        <StatusCard icon={ServerIcon} label="API uptime" value={formatUptime(status.apiUptimeSeconds)} />
        <StatusCard icon={CloudIcon} label="Storage driver" value={status.storageDriver} />
        <StatusCard
          icon={CircleStackIcon}
          label="Database SSL"
          value={status.databaseSslEnabled ? 'On' : 'Off'}
          tone={status.databaseSslEnabled ? 'ok' : undefined}
        />
      </div>

      <Panel title="Integrations">
        <ul className="flex flex-col gap-2">
          {integrations.map(({ label, on, icon: Icon }) => (
            <li key={label} className="flex items-center justify-between gap-2 rounded-lg border border-slate-200 p-3 dark:border-slate-800">
              <span className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-200">
                <Icon aria-hidden className="h-4 w-4 text-slate-400 dark:text-slate-500" />
                {label}
              </span>
              <span
                className={`flex items-center gap-1 text-xs font-semibold ${
                  on ? 'text-emerald-700 dark:text-emerald-400' : 'text-slate-400 dark:text-slate-500'
                }`}
              >
                {on && <CheckCircleIcon aria-hidden className="h-3.5 w-3.5" />}
                {on ? 'Configured' : 'Not configured'}
              </span>
            </li>
          ))}
        </ul>
      </Panel>
    </div>
  );
}

function StatusCard({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: typeof ServerIcon;
  label: string;
  value: string;
  tone?: 'ok';
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-card dark:border-slate-800 dark:bg-slate-900">
      <Icon aria-hidden className={`h-5 w-5 ${tone === 'ok' ? 'text-emerald-600' : 'text-brand-600'}`} />
      <p className="mt-1 truncate text-lg font-bold text-slate-900 dark:text-slate-50">{value}</p>
      <p className="text-xs text-slate-500 dark:text-slate-400">{label}</p>
    </div>
  );
}
