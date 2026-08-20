'use client';

import type { ComponentType, SVGProps } from 'react';
import { CheckCircleIcon, ComputerDesktopIcon, XCircleIcon } from '@heroicons/react/24/outline';
import { parseUserAgent } from '@/lib/user-agent';
import type { LoginActivity } from '@/lib/types';

// Shared between Security Overview, Login & Authentication, and Security
// Alerts — three different slices of the same login-activity data, not
// three separately-built tables.

export function StatCard({
  label,
  value,
  icon: Icon,
  tone,
}: {
  label: string;
  value: number | string;
  icon: ComponentType<SVGProps<SVGSVGElement>>;
  tone?: 'warning';
}) {
  return (
    <div
      className={`rounded-xl border p-3 shadow-card ${tone === 'warning' ? 'border-amber-300 bg-amber-50 dark:border-amber-700 dark:bg-amber-900/30' : 'border-slate-200 dark:border-slate-800'}`}
    >
      <Icon aria-hidden className={`h-5 w-5 ${tone === 'warning' ? 'text-amber-600 dark:text-amber-400' : 'text-brand-600'}`} />
      <p className="mt-1 text-2xl font-bold tabular-nums text-slate-900 dark:text-slate-50">{value}</p>
      <p className="text-xs text-slate-500 dark:text-slate-400">{label}</p>
    </div>
  );
}

export function LoginActivityRow({ entry }: { entry: LoginActivity }) {
  return (
    <li
      className={`flex flex-col gap-1 rounded-xl border p-3 text-sm ${
        entry.success ? 'border-slate-200 dark:border-slate-800' : 'border-flag-200 bg-flag-50/40'
      }`}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="flex items-center gap-1.5 font-medium text-slate-900 dark:text-slate-50">
          {entry.success ? (
            <CheckCircleIcon aria-hidden className="h-4 w-4 text-emerald-600" />
          ) : (
            <XCircleIcon aria-hidden className="h-4 w-4 text-flag-600" />
          )}
          {entry.emailAttempted}
          {entry.user?.isSuperAdmin && (
            <span className="rounded-full bg-gold-400/20 px-1.5 py-0.5 text-[10px] font-semibold text-gold-600">
              Super Admin
            </span>
          )}
          {entry.user?.isAdmin && !entry.user.isSuperAdmin && (
            <span className="rounded-full bg-brand-700/10 px-1.5 py-0.5 text-[10px] font-semibold text-brand-700 dark:text-brand-300">
              Admin
            </span>
          )}
        </p>
        <span className="text-xs text-slate-400 dark:text-slate-500">{new Date(entry.createdAt).toLocaleString()}</span>
      </div>
      <p className="text-xs text-slate-500 dark:text-slate-400">
        {entry.success
          ? 'Signed in'
          : entry.reason === 'invalid_2fa_code'
            ? 'Wrong 2FA code'
            : 'Wrong password / unknown email'}
      </p>
      <p className="flex items-center gap-1 text-xs text-slate-400 dark:text-slate-500">
        <ComputerDesktopIcon aria-hidden className="h-3.5 w-3.5" />
        {parseUserAgent(entry.userAgent)}
        {entry.ipAddress && <> · {entry.ipAddress}</>}
      </p>
    </li>
  );
}
