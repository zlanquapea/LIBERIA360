'use client';

import { useState } from 'react';
import { FingerPrintIcon } from '@heroicons/react/24/outline';
import { SuperAdminGate } from '@/components/SuperAdminGate';
import { useAuth } from '@/hooks/useAuth';
import { revokeUserSessions, searchTeamMember } from '@/lib/admin-api';
import { HttpError } from '@/lib/http';
import type { AuthUser } from '@/lib/types';
import { AdminPageHeader } from '@/components/admin-ui';

// Security > Sessions & Devices — force-end every active session on an
// account immediately, no password needed. Split out of the old combined
// Security page into its own route.
export default function SessionsPage() {
  return (
    <SuperAdminGate>
      <RevokeSessions />
    </SuperAdminGate>
  );
}

function RevokeSessions() {
  const { token } = useAuth();
  const [email, setEmail] = useState('');
  const [found, setFound] = useState<AuthUser | null>(null);
  const [searching, setSearching] = useState(false);
  const [revoking, setRevoking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function search() {
    if (!token) return;
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
    if (!found || !token) return;
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
    <div className="flex flex-col gap-6">
      <AdminPageHeader title="Sessions & Devices" description="Force-end every active session on an account." />

      <section className="flex flex-col gap-3 rounded-xl border border-slate-200 p-4 dark:border-slate-800">
        <div className="flex items-center gap-2">
          <FingerPrintIcon aria-hidden className="h-5 w-5 text-brand-600 dark:text-brand-300" />
          <h2 className="font-semibold text-slate-800 dark:text-slate-100">Force sign-out</h2>
        </div>
        <p className="text-xs text-slate-500 dark:text-slate-400">
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
            className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 dark:border-slate-700"
          />
          <button
            type="button"
            disabled={searching || !email.trim()}
            onClick={search}
            className="rounded-full border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:border-brand-500 disabled:opacity-60 dark:border-slate-700 dark:text-slate-200"
          >
            {searching ? 'Looking up…' : 'Find'}
          </button>
        </div>
        {error && <p className="text-sm text-flag-700 dark:text-flag-300">{error}</p>}
        {found && (
          <div className="flex items-center justify-between gap-2 rounded-lg border border-slate-200 p-3 dark:border-slate-800">
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-slate-900 dark:text-slate-50">{found.name}</p>
              <p className="truncate text-xs text-slate-500 dark:text-slate-400">{found.email}</p>
            </div>
            {done ? (
              <span className="shrink-0 text-xs font-medium text-emerald-600 dark:text-emerald-300">Sessions revoked</span>
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
    </div>
  );
}
