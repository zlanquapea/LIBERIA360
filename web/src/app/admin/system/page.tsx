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
  ShieldCheckIcon,
  XCircleIcon,
} from '@heroicons/react/24/outline';
import { SuperAdminGate } from '@/components/SuperAdminGate';
import { useAuth } from '@/hooks/useAuth';
import { getSystemStatus, sendTestEmail } from '@/lib/admin-api';
import { HttpError } from '@/lib/http';
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

  const reload = () => {
    if (!token) return;
    getSystemStatus(token).then(setStatus);
  };

  useEffect(reload, [token]);

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
    { label: 'Admin login IP allowlist', on: status.integrations.adminLoginIpAllowlist, icon: ShieldCheckIcon },
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
                <Icon aria-hidden className="h-4 w-4 text-slate-400 dark:text-slate-400" />
                {label}
              </span>
              <span
                className={`flex items-center gap-1 text-xs font-semibold ${
                  on ? 'text-emerald-700 dark:text-emerald-400' : 'text-slate-400 dark:text-slate-400'
                }`}
              >
                {on && <CheckCircleIcon aria-hidden className="h-3.5 w-3.5" />}
                {on ? 'Configured' : 'Not configured'}
              </span>
            </li>
          ))}
        </ul>
      </Panel>

      <EmailDeliveryPanel token={token} mail={status.mail} onSent={reload} />
    </div>
  );
}

// Closes the exact gap behind "it says Sent but nothing arrives": whether
// SMTP creds are even present, what happened the last time this process
// actually tried to send (any send — registration, password reset, or a
// test), and a one-click way to confirm delivery right now instead of
// digging through server logs.
function EmailDeliveryPanel({
  token,
  mail,
  onSent,
}: {
  token: string | null;
  mail: SystemStatus['mail'];
  onSent: () => void;
}) {
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<{ success: boolean; error: string | null } | null>(null);

  async function handleSendTest() {
    if (!token) return;
    setSending(true);
    setResult(null);
    try {
      const outcome = await sendTestEmail(token);
      setResult(outcome);
      onSent(); // refresh status so lastAttempt reflects this send immediately
    } catch (err) {
      setResult({ success: false, error: err instanceof HttpError ? err.message : 'Something went wrong.' });
    } finally {
      setSending(false);
    }
  }

  return (
    <Panel title="Email delivery">
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-2">
          <span className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-200">
            <EnvelopeIcon aria-hidden className="h-4 w-4 text-slate-400 dark:text-slate-400" />
            SMTP credentials
          </span>
          <span
            className={`flex items-center gap-1 text-xs font-semibold ${
              mail.configured ? 'text-emerald-700 dark:text-emerald-400' : 'text-slate-400 dark:text-slate-400'
            }`}
          >
            {mail.configured && <CheckCircleIcon aria-hidden className="h-3.5 w-3.5" />}
            {mail.configured ? 'Configured' : 'Not configured'}
          </span>
        </div>

        {!mail.configured && (
          <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:bg-amber-950/30 dark:text-amber-300">
            No SMTP credentials are set — every email (verification, password reset) is only ever logged on the
            server, never actually delivered. Set SMTP_HOST/SMTP_USER/SMTP_PASSWORD (see api/README.md&apos;s Email
            section) to turn on real delivery.
          </p>
        )}

        {mail.lastAttempt && (
          <div
            className={`flex flex-col gap-1 rounded-lg border p-3 text-xs ${
              mail.lastAttempt.success
                ? 'border-emerald-200 bg-emerald-50 dark:border-emerald-900 dark:bg-emerald-950/20'
                : 'border-flag-300 bg-flag-500/10 dark:border-flag-600'
            }`}
          >
            <p className="flex items-center gap-1.5 font-semibold">
              {mail.lastAttempt.success ? (
                <CheckCircleIcon aria-hidden className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
              ) : (
                <XCircleIcon aria-hidden className="h-3.5 w-3.5 text-flag-600 dark:text-flag-400" />
              )}
              <span className={mail.lastAttempt.success ? 'text-emerald-800 dark:text-emerald-300' : 'text-flag-700 dark:text-flag-300'}>
                Last attempt: {mail.lastAttempt.success ? 'delivered' : 'failed'}
              </span>
            </p>
            <p className="text-slate-600 dark:text-slate-300">
              &ldquo;{mail.lastAttempt.subject}&rdquo; to {mail.lastAttempt.to} —{' '}
              {new Date(mail.lastAttempt.at).toLocaleString()}
            </p>
            {mail.lastAttempt.error && (
              <p className="font-mono text-flag-700 dark:text-flag-300">{mail.lastAttempt.error}</p>
            )}
          </div>
        )}

        <div className="flex flex-col gap-2">
          <button
            type="button"
            onClick={handleSendTest}
            disabled={sending || !mail.configured}
            className="self-start rounded-full bg-brand-700 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-800 disabled:opacity-60"
          >
            {sending ? 'Sending…' : 'Send test email to myself'}
          </button>
          {!mail.configured && (
            <p className="text-xs text-slate-400 dark:text-slate-400">Configure SMTP credentials first to enable this.</p>
          )}
          {result && (
            <p
              role="status"
              className={`text-xs font-medium ${
                result.success ? 'text-emerald-700 dark:text-emerald-400' : 'text-flag-700 dark:text-flag-300'
              }`}
            >
              {result.success ? '✓ Delivered — check your inbox.' : `✕ ${result.error}`}
            </p>
          )}
        </div>
      </div>
    </Panel>
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
      <Icon aria-hidden className={`h-5 w-5 ${tone === 'ok' ? 'text-emerald-600 dark:text-emerald-300' : 'text-brand-600 dark:text-brand-300'}`} />
      <p className="mt-1 truncate text-lg font-bold text-slate-900 dark:text-slate-50">{value}</p>
      <p className="text-xs text-slate-500 dark:text-slate-400">{label}</p>
    </div>
  );
}
