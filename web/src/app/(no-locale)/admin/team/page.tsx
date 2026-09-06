'use client';

import { useEffect, useState } from 'react';
import { StarIcon } from '@heroicons/react/24/solid';
import { UserPlusIcon, MagnifyingGlassIcon, EnvelopeIcon, ClockIcon } from '@heroicons/react/24/outline';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { SuperAdminGate } from '@/components/SuperAdminGate';
import { LoadingState } from '@/components/admin-ui';
import { useAuth } from '@/hooks/useAuth';
import { createAdmin, getTeamRoster, resendTeamInvite, searchTeamMember, setTeamRoles } from '@/lib/admin-api';
import { HttpError } from '@/lib/http';
import type { AuthUser } from '@/lib/types';

// Team & Access (super admin only — Tech Spec §7/§8) — before this, the
// only way to grant admin access was a raw SQL UPDATE (see
// api/README.md's Phase 3 section), which isn't something a super admin
// could hand off to anyone else. This is the full CRUD surface for it:
// Create a brand-new account or promote an existing one, Read the roster,
// Update roles, and Delete (revoke) access — all from one panel.
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
      <div>
        <h1 className="text-xl font-bold text-slate-900 dark:text-slate-50">Team &amp; Access</h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Create admin accounts, promote existing users, and manage everyone&apos;s access in one place.
        </p>
      </div>

      <AddToTeamPanel token={token} currentUserId={currentUser?.id} onChanged={reload} />

      <section className="flex flex-col gap-3">
        <h2 className="font-semibold text-slate-800 dark:text-slate-100">
          Current team {roster && <span className="font-normal text-slate-400 dark:text-slate-500">({roster.length})</span>}
        </h2>
        {!roster ? (
          <LoadingState />
        ) : roster.length === 0 ? (
          <p className="text-sm text-slate-500 dark:text-slate-400">No admins yet — that shouldn&apos;t be possible if you&apos;re seeing this page.</p>
        ) : (
          <TeamRosterList roster={roster} token={token} currentUserId={currentUser?.id} onChanged={reload} />
        )}
      </section>
    </div>
  );
}

function RoleBadge({ isSuperAdmin }: { isSuperAdmin: boolean }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ${
        isSuperAdmin ? 'bg-gold-400/20 text-gold-600' : 'bg-brand-700/10 text-brand-700 dark:text-brand-300'
      }`}
    >
      {isSuperAdmin && <StarIcon aria-hidden className="h-3 w-3" />}
      {isSuperAdmin ? 'Super Admin' : 'Admin'}
    </span>
  );
}

// createAdmin's invites start with no password (see PublicUser.pendingActivation)
// — this badge is the only thing that tells "granted access, already
// signed in" apart from "invited, hasn't set a password yet" on the roster.
function PendingBadge() {
  return (
    <span
      title="Hasn't set a password yet — the invite email is still their only way in."
      className="inline-flex items-center gap-1 rounded-full bg-slate-500/10 px-2 py-0.5 text-xs font-semibold text-slate-600 dark:text-slate-300"
    >
      <ClockIcon aria-hidden className="h-3 w-3" />
      Pending
    </span>
  );
}

// The Create half of the CRUD panel: a tab switcher between minting a
// brand-new account (the capability this task adds) and the original
// find-and-promote flow for someone who already registered on their own.
function AddToTeamPanel({
  token,
  currentUserId,
  onChanged,
}: {
  token: string;
  currentUserId: string | undefined;
  onChanged: () => void;
}) {
  const [tab, setTab] = useState<'new' | 'existing'>('new');

  return (
    <section className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
      <div className="flex flex-col gap-1">
        <h2 className="font-semibold text-slate-800 dark:text-slate-100">Add to the team</h2>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Invite someone brand new, or grant access to a user who already has an account.
        </p>
      </div>

      <div className="flex gap-1 rounded-full bg-slate-100 p-1 text-sm dark:bg-slate-800" role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'new'}
          onClick={() => setTab('new')}
          className={`flex flex-1 items-center justify-center gap-1.5 rounded-full px-3 py-1.5 font-medium transition-colors ${
            tab === 'new'
              ? 'bg-white text-brand-700 shadow-sm dark:bg-slate-700 dark:text-brand-300'
              : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
          }`}
        >
          <UserPlusIcon aria-hidden className="h-4 w-4" />
          New person
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'existing'}
          onClick={() => setTab('existing')}
          className={`flex flex-1 items-center justify-center gap-1.5 rounded-full px-3 py-1.5 font-medium transition-colors ${
            tab === 'existing'
              ? 'bg-white text-brand-700 shadow-sm dark:bg-slate-700 dark:text-brand-300'
              : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
          }`}
        >
          <MagnifyingGlassIcon aria-hidden className="h-4 w-4" />
          Existing user
        </button>
      </div>

      {tab === 'new' ? (
        <CreateAdminForm token={token} onCreated={onChanged} />
      ) : (
        <SearchAndPromote token={token} currentUserId={currentUserId} onChanged={onChanged} />
      )}
    </section>
  );
}

function CreateAdminForm({ token, onCreated }: { token: string; onCreated: () => void }) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [invited, setInvited] = useState<AuthUser | null>(null);

  async function submit() {
    setSubmitting(true);
    setError(null);
    try {
      const created = await createAdmin(token, { name: name.trim(), email: email.trim(), isSuperAdmin });
      setInvited(created);
      setName('');
      setEmail('');
      setIsSuperAdmin(false);
      onCreated();
    } catch (err) {
      setError(err instanceof HttpError ? err.message : 'Something went wrong. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  if (invited) {
    return (
      <div className="flex flex-col gap-3 rounded-xl border border-brand-700/20 bg-brand-700/5 p-4">
        <div className="flex items-start gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-700/10 text-brand-700 dark:text-brand-300">
            <EnvelopeIcon aria-hidden className="h-5 w-5" />
          </span>
          <div>
            <p className="font-medium text-slate-900 dark:text-slate-50">Invite sent to {invited.email}</p>
            <p className="mt-0.5 text-sm text-slate-600 dark:text-slate-300">
              {invited.name} can set their password from the link in that email to activate their{' '}
              {invited.isSuperAdmin ? 'Super Admin' : 'Admin'} access. They&apos;ll already show up in the roster below.
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setInvited(null)}
          className="self-start rounded-full border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:border-brand-500 dark:border-slate-700 dark:text-slate-200"
        >
          Invite another person
        </button>
      </div>
    );
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
      className="flex flex-col gap-3"
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-slate-600 dark:text-slate-300">Full name</span>
          <input
            type="text"
            required
            placeholder="Ada Kollie"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 dark:border-slate-700 dark:bg-slate-800"
          />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-slate-600 dark:text-slate-300">Email</span>
          <input
            type="email"
            required
            placeholder="person@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 dark:border-slate-700 dark:bg-slate-800"
          />
        </label>
      </div>

      <div className="flex flex-col gap-1.5">
        <span className="text-xs font-medium text-slate-600 dark:text-slate-300">Access level</span>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setIsSuperAdmin(false)}
            aria-pressed={!isSuperAdmin}
            className={`flex-1 rounded-lg border px-3 py-2 text-left text-sm transition-colors ${
              !isSuperAdmin
                ? 'border-brand-500 bg-brand-700/5 text-brand-700 dark:text-brand-300'
                : 'border-slate-300 text-slate-600 hover:border-slate-400 dark:border-slate-700 dark:text-slate-300'
            }`}
          >
            <span className="block font-semibold">Admin</span>
            <span className="block text-xs opacity-80">Moderation, content, and day-to-day management</span>
          </button>
          <button
            type="button"
            onClick={() => setIsSuperAdmin(true)}
            aria-pressed={isSuperAdmin}
            className={`flex-1 rounded-lg border px-3 py-2 text-left text-sm transition-colors ${
              isSuperAdmin
                ? 'border-gold-500 bg-gold-400/10 text-gold-600 dark:text-gold-400'
                : 'border-slate-300 text-slate-600 hover:border-slate-400 dark:border-slate-700 dark:text-slate-300'
            }`}
          >
            <span className="flex items-center gap-1 font-semibold">
              <StarIcon aria-hidden className="h-3.5 w-3.5" />
              Super Admin
            </span>
            <span className="block text-xs opacity-80">Everything an Admin can do, plus Team &amp; Access itself</span>
          </button>
        </div>
      </div>

      {error && <p className="text-sm text-flag-700 dark:text-flag-300">{error}</p>}

      <button
        type="submit"
        disabled={submitting || !name.trim() || !email.trim()}
        className="self-start rounded-full bg-brand-700 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-800 disabled:opacity-60"
      >
        {submitting ? 'Sending invite…' : 'Create account & send invite'}
      </button>
      <p className="text-xs text-slate-400 dark:text-slate-500">
        They&apos;ll get an email with a link to set their own password — nothing is shared in the clear.
      </p>
    </form>
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
          ? 'No account found with that email — they need to sign up first, or use "New person" instead.'
          : 'Something went wrong. Please try again.',
      );
    } finally {
      setSearching(false);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex gap-2">
        <input
          type="email"
          placeholder="person@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && search()}
          className="flex-1 rounded-lg border border-slate-300 dark:border-slate-700 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
        />
        <button
          type="button"
          disabled={searching || !email.trim()}
          onClick={search}
          className="rounded-full border border-slate-300 dark:border-slate-700 px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-200 hover:border-brand-500 disabled:opacity-60"
        >
          {searching ? 'Looking up…' : 'Find'}
        </button>
      </div>
      {searchError && <p className="text-sm text-flag-700 dark:text-flag-300">{searchError}</p>}
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
    </div>
  );
}

const TEAM_ROSTER_VISIBLE_COUNT = 10;

// Redesign (Sep 3, 2026): the roster has no server-side pagination, and on
// an install with a lot of accounts (or a lot of test/seed data) this was
// rendering every one of them as a full-height card in a single unbroken
// column — one build measured 50+ rows and a page several screens taller
// than the rest of Team & Access combined. Same "show N, then expand"
// pattern used elsewhere in the admin (Flagged content) and on the public
// side (CountyGrid/CategoryGrid) so the roster stays reachable without
// turning this page into mostly scroll.
function TeamRosterList({
  roster,
  token,
  currentUserId,
  onChanged,
}: {
  roster: AuthUser[];
  token: string;
  currentUserId: string | undefined;
  onChanged: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const visible = expanded ? roster : roster.slice(0, TEAM_ROSTER_VISIBLE_COUNT);
  const hasMore = roster.length > TEAM_ROSTER_VISIBLE_COUNT;

  return (
    <div className="flex flex-col gap-3">
      <ul className="flex flex-col gap-2">
        {visible.map((member) => (
          <TeamMemberRow
            key={member.id}
            token={token}
            member={member}
            isSelf={member.id === currentUserId}
            onChanged={onChanged}
          />
        ))}
      </ul>
      {hasMore && (
        <button
          type="button"
          onClick={() => setExpanded((value) => !value)}
          className="self-center rounded-full px-4 py-2 text-sm font-semibold text-brand-700 hover:bg-brand-50 dark:text-brand-300 dark:hover:bg-slate-800"
        >
          {expanded ? 'Show fewer' : `Show all ${roster.length} team members`}
        </button>
      )}
    </div>
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
  const [submitting, setSubmitting] = useState<'admin' | 'superAdmin' | 'revoke' | 'resend' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmingRevoke, setConfirmingRevoke] = useState(false);
  const [resent, setResent] = useState(false);

  async function apply(isAdmin: boolean, isSuperAdmin: boolean, which: 'admin' | 'superAdmin' | 'revoke') {
    setSubmitting(which);
    setError(null);
    try {
      await setTeamRoles(token, member.id, { isAdmin, isSuperAdmin });
      setConfirmingRevoke(false);
      onChanged();
    } catch (err) {
      setError(err instanceof HttpError ? err.message : 'Something went wrong. Please try again.');
      setSubmitting(null);
    }
  }

  async function resend() {
    setSubmitting('resend');
    setError(null);
    try {
      await resendTeamInvite(token, member.id);
      setResent(true);
    } catch (err) {
      setError(err instanceof HttpError ? err.message : 'Something went wrong. Please try again.');
    } finally {
      setSubmitting(null);
    }
  }

  return (
    <li className="flex flex-col gap-2 rounded-xl border border-slate-200 dark:border-slate-800 p-3">
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate font-medium text-slate-900 dark:text-slate-50">
            {member.name} {isSelf && <span className="text-xs font-normal text-slate-400 dark:text-slate-400">(you)</span>}
          </p>
          <p className="truncate text-xs text-slate-500 dark:text-slate-400">{member.email}</p>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          {member.pendingActivation && <PendingBadge />}
          <RoleBadge isSuperAdmin={member.isSuperAdmin} />
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2">
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
        {member.pendingActivation && (
          <button
            type="button"
            disabled={submitting !== null}
            onClick={resend}
            className="rounded-full border border-slate-300 dark:border-slate-700 px-3 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-200 hover:border-brand-500 disabled:opacity-60"
          >
            {submitting === 'resend' ? 'Sending…' : resent ? 'Invite resent ✓' : 'Resend invite'}
          </button>
        )}
        {(member.isAdmin || member.isSuperAdmin) && (
          <button
            type="button"
            disabled={submitting !== null}
            onClick={() => setConfirmingRevoke(true)}
            title={isSelf && member.isSuperAdmin ? "You can't remove your own super admin access here" : undefined}
            className="rounded-full border border-slate-300 dark:border-slate-700 px-3 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-200 hover:border-flag-500 hover:text-flag-700 dark:hover:text-flag-300 disabled:opacity-60"
          >
            {submitting === 'revoke' ? 'Revoking…' : member.pendingActivation ? 'Cancel invite' : 'Revoke all access'}
          </button>
        )}
      </div>
      {error && <p className="text-xs text-flag-700 dark:text-flag-300">{error}</p>}

      <ConfirmDialog
        open={confirmingRevoke}
        title={member.pendingActivation ? `Cancel ${member.name}'s invite?` : `Revoke ${member.name}'s access?`}
        description={
          member.pendingActivation
            ? "They haven't set a password yet, so this fully withdraws the invite. You can invite this email again later — nothing about this is permanent for them."
            : 'This removes their Admin and Super Admin permissions — their account and everything else on it (trips, bookings, saved places) stays exactly as it is.'
        }
        confirmLabel={member.pendingActivation ? 'Cancel invite' : 'Revoke access'}
        loadingLabel={member.pendingActivation ? 'Cancelling…' : 'Revoking…'}
        isLoading={submitting === 'revoke'}
        error={error}
        onConfirm={() => apply(false, false, 'revoke')}
        onCancel={() => setConfirmingRevoke(false)}
      />
    </li>
  );
}
