'use client';

import { useEffect, useState } from 'react';
import type { ComponentType, SVGProps } from 'react';
import {
  ShieldExclamationIcon,
  ShieldCheckIcon,
  GlobeAltIcon,
  FingerPrintIcon,
  ComputerDesktopIcon,
  CheckCircleIcon,
  XCircleIcon,
} from '@heroicons/react/24/outline';
import { SuperAdminGate } from '@/components/SuperAdminGate';
import { useAuth } from '@/hooks/useAuth';
import { getLoginActivity, getSecurityOverview, revokeUserSessions, searchTeamMember } from '@/lib/admin-api';
import { parseUserAgent } from '@/lib/user-agent';
import { HttpError } from '@/lib/http';
import type { AuthUser, LoginActivity, PaginatedLoginActivity, SecurityOverview } from '@/lib/types';

// Security — super admin only. Brute-force signal (failed logins, how
// many distinct IPs they're spread across), how well-protected the admin
// team itself is (2FA adoption), a raw sign-in history with device info,
// and the ability to force-end any account's sessions immediately — the
// "security concern of the application" oversight tools a super admin
// otherwise has no page for at all.
export default function AdminSecurityPage() {
  return (
    <SuperAdminGate>
      <SecurityDashboard />
    </SuperAdminGate>
  );
}

function SecurityDashboard() {
  const { token } = useAuth();
  const [overview, setOverview] = useState<SecurityOverview | null>(null);
  const [activity, setActivity] = useState<PaginatedLoginActivity | null>(null);
  const [onlyFailed, setOnlyFailed] = useState(false);
  const [page, setPage] = useState(1);

  function reloadOverview() {
    if (!token) return;
    getSecurityOverview(token).then(setOverview);
  }

  useEffect(reloadOverview, [token]);

  useEffect(() => {
    if (!token) return;
    getLoginActivity(token, { page, onlyFailed }).then(setActivity);
  }, [token, page, onlyFailed]);

  if (!token) return null;

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-xl font-bold text-slate-900">Security</h1>
        <p className="text-sm text-slate-500">
          Sign-in activity, brute-force signal, and account session control.
        </p>
      </div>

      {overview && <OverviewCards overview={overview} />}

      <RevokeSessions token={token} />

      <section className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-semibold text-slate-800">Login activity</h2>
          <label className="flex items-center gap-1.5 text-xs font-medium text-slate-600">
            <input
              type="checkbox"
              checked={onlyFailed}
              onChange={(e) => {
                setOnlyFailed(e.target.checked);
                setPage(1);
              }}
              className="rounded border-slate-300 text-brand-600 focus:ring-brand-500"
            />
            Failed attempts only
          </label>
        </div>

        {!activity ? (
          <p className="text-sm text-slate-500">Loading…</p>
        ) : activity.data.length === 0 ? (
          <p className="rounded-xl border border-dashed border-slate-300 px-4 py-8 text-center text-sm text-slate-500">
            Nothing recorded yet.
          </p>
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
              className="rounded-full border border-slate-300 px-3 py-1.5 font-medium text-slate-700 hover:border-brand-500 disabled:opacity-40"
            >
              ← Previous
            </button>
            <span className="text-slate-500">
              Page {activity.meta.page} of {activity.meta.totalPages}
            </span>
            <button
              type="button"
              disabled={page >= activity.meta.totalPages}
              onClick={() => setPage((p) => p + 1)}
              className="rounded-full border border-slate-300 px-3 py-1.5 font-medium text-slate-700 hover:border-brand-500 disabled:opacity-40"
            >
              Next →
            </button>
          </div>
        )}
      </section>
    </div>
  );
}

function OverviewCards({ overview }: { overview: SecurityOverview }) {
  const adoptionPct =
    overview.adminTwoFactorAdoption.total > 0
      ? Math.round((overview.adminTwoFactorAdoption.enabled / overview.adminTwoFactorAdoption.total) * 100)
      : 0;

  return (
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
  );
}

function StatCard({
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
      className={`rounded-xl border p-3 shadow-card ${tone === 'warning' ? 'border-amber-300 bg-amber-50' : 'border-slate-200'}`}
    >
      <Icon aria-hidden className={`h-5 w-5 ${tone === 'warning' ? 'text-amber-600' : 'text-brand-600'}`} />
      <p className="mt-1 text-2xl font-bold tabular-nums text-slate-900">{value}</p>
      <p className="text-xs text-slate-500">{label}</p>
    </div>
  );
}

function LoginActivityRow({ entry }: { entry: LoginActivity }) {
  return (
    <li
      className={`flex flex-col gap-1 rounded-xl border p-3 text-sm ${
        entry.success ? 'border-slate-200' : 'border-flag-200 bg-flag-50/40'
      }`}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="flex items-center gap-1.5 font-medium text-slate-900">
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
            <span className="rounded-full bg-brand-700/10 px-1.5 py-0.5 text-[10px] font-semibold text-brand-700">
              Admin
            </span>
          )}
        </p>
        <span className="text-xs text-slate-400">{new Date(entry.createdAt).toLocaleString()}</span>
      </div>
      <p className="text-xs text-slate-500">
        {entry.success
          ? 'Signed in'
          : entry.reason === 'invalid_2fa_code'
            ? 'Wrong 2FA code'
            : 'Wrong password / unknown email'}
      </p>
      <p className="flex items-center gap-1 text-xs text-slate-400">
        <ComputerDesktopIcon aria-hidden className="h-3.5 w-3.5" />
        {parseUserAgent(entry.userAgent)}
        {entry.ipAddress && <> · {entry.ipAddress}</>}
      </p>
    </li>
  );
}

function RevokeSessions({ token }: { token: string }) {
  const [email, setEmail] = useState('');
  const [found, setFound] = useState<AuthUser | null>(null);
  const [searching, setSearching] = useState(false);
  const [revoking, setRevoking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function search() {
    setSearching(true);
    setError(null);
    setFound(null);
    setDone(false);
    try {
      setFound(await searchTeamMember(token, email.trim()));
    } catch (err) {
      setError(
        err instanceof HttpError && err.status === 404
          ? 'No account found with that email.'
          : 'Something went wrong. Please try again.',
      );
    } finally {
      setSearching(false);
    }
  }

  async function revoke() {
    if (!found) return;
    setRevoking(true);
    setError(null);
    try {
      await revokeUserSessions(token, found.id);
      setDone(true);
    } catch (err) {
      setError(err instanceof HttpError ? err.message : 'Something went wrong. Please try again.');
    } finally {
      setRevoking(false);
    }
  }

  return (
    <section className="flex flex-col gap-3 rounded-xl border border-slate-200 p-4">
      <div className="flex items-center gap-2">
        <FingerPrintIcon aria-hidden className="h-5 w-5 text-brand-600" />
        <h2 className="font-semibold text-slate-800">Force sign-out</h2>
      </div>
      <p className="text-xs text-slate-500">
        Ends every active session on an account immediately — no password needed. Use this for a compromised
        account or a just-demoted admin.
      </p>
      <div className="flex gap-2">
        <input
          type="email"
          placeholder="person@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && search()}
          className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
        />
        <button
          type="button"
          disabled={searching || !email.trim()}
          onClick={search}
          className="rounded-full border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:border-brand-500 disabled:opacity-60"
        >
          {searching ? 'Looking up…' : 'Find'}
        </button>
      </div>
      {error && <p className="text-sm text-flag-700">{error}</p>}
      {found && (
        <div className="flex items-center justify-between gap-2 rounded-lg border border-slate-200 p-3">
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-slate-900">{found.name}</p>
            <p className="truncate text-xs text-slate-500">{found.email}</p>
          </div>
          {done ? (
            <span className="shrink-0 text-xs font-medium text-emerald-600">Sessions revoked</span>
          ) : (
            <button
              type="button"
              disabled={revoking}
              onClick={revoke}
              className="shrink-0 rounded-full bg-flag-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-flag-700 disabled:opacity-60"
            >
              {revoking ? 'Revoking…' : 'Revoke sessions'}
            </button>
          )}
        </div>
      )}
    </section>
  );
}
