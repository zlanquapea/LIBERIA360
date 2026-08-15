'use client';

import { useEffect, useState } from 'react';
import { SuperAdminGate } from '@/components/SuperAdminGate';
import { useAuth } from '@/hooks/useAuth';
import { getTeamRoster, searchTeamMember, setTeamRoles } from '@/lib/admin-api';
import { HttpError } from '@/lib/http';
import type { AuthUser } from '@/lib/types';

// Team & Access (super admin only — Tech Spec §7/§8) — before this, the
// only way to grant admin access was a raw SQL UPDATE (see
// api/README.md's Phase 3 section), which isn't something a super admin
// could hand off to anyone else. This is the first self-service path:
// look a user up by email, then grant/revoke Admin and Super Admin.
export default function AdminTeamPage() {
  return (
    <SuperAdminGate>
      <TeamDashboard />
    </SuperAdminGate>
  );
}

function TeamDashboard() {
  const { user: currentUser, token } = useAuth();
  const [roster, setRoster] = useState<AuthUser[] | null>(null);

  function reload() {
    if (!token) return;
    getTeamRoster(token).then(setRoster);
  }

  useEffect(reload, [token]);

  if (!token) return null;

  return (
    <div className="flex flex-col gap-8">
      <h1 className="text-xl font-bold text-slate-900">Team &amp; Access</h1>

      <SearchAndPromote token={token} currentUserId={currentUser?.id} onChanged={reload} />

      <section className="flex flex-col gap-3">
        <h2 className="font-semibold text-slate-800">Current team</h2>
        {!roster ? (
          <p className="text-sm text-slate-500">Loading…</p>
        ) : roster.length === 0 ? (
          <p className="text-sm text-slate-500">No admins yet — that shouldn&apos;t be possible if you&apos;re seeing this page.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {roster.map((member) => (
              <TeamMemberRow
                key={member.id}
                token={token}
                member={member}
                isSelf={member.id === currentUser?.id}
                onChanged={reload}
              />
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function RoleBadge({ isSuperAdmin }: { isSuperAdmin: boolean }) {
  return (
    <span
      className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
        isSuperAdmin ? 'bg-gold-400/20 text-gold-600' : 'bg-brand-700/10 text-brand-700'
      }`}
    >
      {isSuperAdmin ? '⭐ Super Admin' : 'Admin'}
    </span>
  );
}

function SearchAndPromote({
  token,
  currentUserId,
  onChanged,
}: {
  token: string;
  currentUserId: string | undefined;
  onChanged: () => void;
}) {
  const [email, setEmail] = useState('');
  const [found, setFound] = useState<AuthUser | null>(null);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);

  async function search() {
    setSearching(true);
    setSearchError(null);
    setFound(null);
    try {
      setFound(await searchTeamMember(token, email.trim()));
    } catch (err) {
      setSearchError(
        err instanceof HttpError && err.status === 404
          ? 'No account found with that email — they need to sign up first.'
          : 'Something went wrong. Please try again.',
      );
    } finally {
      setSearching(false);
    }
  }

  return (
    <section className="flex flex-col gap-3">
      <h2 className="font-semibold text-slate-800">Grant access</h2>
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
      {searchError && <p className="text-sm text-flag-700">{searchError}</p>}
      {found && (
        <TeamMemberRow
          token={token}
          member={found}
          isSelf={found.id === currentUserId}
          onChanged={() => {
            onChanged();
            setFound(null);
            setEmail('');
          }}
        />
      )}
    </section>
  );
}

function TeamMemberRow({
  token,
  member,
  isSelf,
  onChanged,
}: {
  token: string;
  member: AuthUser;
  isSelf: boolean;
  onChanged: () => void;
}) {
  const [submitting, setSubmitting] = useState<'admin' | 'superAdmin' | 'revoke' | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function apply(isAdmin: boolean, isSuperAdmin: boolean, which: 'admin' | 'superAdmin' | 'revoke') {
    setSubmitting(which);
    setError(null);
    try {
      await setTeamRoles(token, member.id, { isAdmin, isSuperAdmin });
      onChanged();
    } catch (err) {
      setError(err instanceof HttpError ? err.message : 'Something went wrong. Please try again.');
      setSubmitting(null);
    }
  }

  return (
    <li className="flex flex-col gap-2 rounded-xl border border-slate-200 p-3">
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate font-medium text-slate-900">
            {member.name} {isSelf && <span className="text-xs font-normal text-slate-400">(you)</span>}
          </p>
          <p className="truncate text-xs text-slate-500">{member.email}</p>
        </div>
        <RoleBadge isSuperAdmin={member.isSuperAdmin} />
      </div>
      <div className="flex flex-wrap gap-2">
        {!member.isAdmin && (
          <button
            type="button"
            disabled={submitting !== null}
            onClick={() => apply(true, false, 'admin')}
            className="rounded-full bg-brand-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-800 disabled:opacity-60"
          >
            {submitting === 'admin' ? 'Granting…' : 'Grant Admin'}
          </button>
        )}
        {!member.isSuperAdmin && (
          <button
            type="button"
            disabled={submitting !== null}
            onClick={() => apply(true, true, 'superAdmin')}
            className="rounded-full bg-gold-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-gold-600 disabled:opacity-60"
          >
            {submitting === 'superAdmin' ? 'Granting…' : 'Grant Super Admin'}
          </button>
        )}
        {(member.isAdmin || member.isSuperAdmin) && (
          <button
            type="button"
            disabled={submitting !== null}
            onClick={() => apply(false, false, 'revoke')}
            title={isSelf && member.isSuperAdmin ? "You can't remove your own super admin access here" : undefined}
            className="rounded-full border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:border-flag-500 hover:text-flag-700 disabled:opacity-60"
          >
            {submitting === 'revoke' ? 'Revoking…' : 'Revoke all access'}
          </button>
        )}
      </div>
      {error && <p className="text-xs text-flag-700">{error}</p>}
    </li>
  );
}
