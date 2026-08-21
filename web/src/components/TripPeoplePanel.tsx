'use client';

import { useEffect, useState } from 'react';
import { UserPlusIcon } from '@heroicons/react/24/outline';
import { useAuth } from '@/hooks/useAuth';
import { removeCollaborator } from '@/lib/itinerary-api';
import { cancelInvitation, listInvitations, resendInvitation } from '@/lib/invitations-api';
import { getFriendlyErrorMessage, isNotFoundError } from '@/lib/errors';
import { InvitePeopleModal } from './InvitePeopleModal';
import { ConfirmDialog } from './ConfirmDialog';
import type { AuthUser, InvitationDisplayStatus, InvitationSummary } from '@/lib/types';

const STATUS_STYLES: Record<InvitationDisplayStatus, string> = {
  pending: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300',
  viewed: 'bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300',
  accepted: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300',
  declined: 'bg-flag-500/10 text-flag-700 dark:text-flag-300',
  expired: 'bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-500',
};

const STATUS_LABELS: Record<InvitationDisplayStatus, string> = {
  pending: 'Pending',
  viewed: 'Viewed',
  accepted: 'Accepted',
  declined: 'Declined',
  expired: 'Expired',
};

// Trip People/Participants (Section 4/6/7): confirmed collaborators plus
// — for the owner — every open invitation and its status, with resend
// and cancel. Replaces the old TripCollaborators, which could only
// immediately add someone who already had an account.
export function TripPeoplePanel({
  itineraryId,
  collaborators,
  isOwner,
  onChange,
}: {
  itineraryId: string;
  collaborators: AuthUser[];
  isOwner: boolean;
  onChange: () => void;
}) {
  const { user, token } = useAuth();
  const [invitations, setInvitations] = useState<InvitationSummary[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [pendingRemove, setPendingRemove] = useState<AuthUser | null>(null);
  const [removing, setRemoving] = useState(false);
  const [removeError, setRemoveError] = useState<string | null>(null);

  useEffect(() => {
    if (!token || !isOwner) return;
    listInvitations(token, itineraryId)
      .then(setInvitations)
      .catch(() => setInvitations([]));
  }, [token, itineraryId, isOwner]);

  function reloadInvitations() {
    if (!token || !isOwner) return;
    listInvitations(token, itineraryId).then(setInvitations).catch(() => undefined);
  }

  async function confirmRemove() {
    if (!token || !pendingRemove) return;
    setRemoving(true);
    setRemoveError(null);
    try {
      await removeCollaborator(token, itineraryId, pendingRemove.id);
      setPendingRemove(null);
      onChange();
    } catch (err) {
      if (isNotFoundError(err)) {
        // Already off the trip (or the trip itself is gone) — same
        // outcome either way.
        setPendingRemove(null);
        onChange();
      } else {
        setRemoveError(
          getFriendlyErrorMessage(err, { context: { action: 'remove-collaborator', userId: pendingRemove.id } }),
        );
      }
    } finally {
      setRemoving(false);
    }
  }

  async function handleResend(invitationId: string) {
    if (!token) return;
    setBusyId(invitationId);
    setError(null);
    try {
      setInvitations(await resendInvitation(token, itineraryId, invitationId));
    } catch (err) {
      setError(getFriendlyErrorMessage(err, { context: { action: 'resend-invitation', invitationId } }));
    } finally {
      setBusyId(null);
    }
  }

  async function handleCancel(invitationId: string) {
    if (!token) return;
    setBusyId(invitationId);
    setError(null);
    try {
      setInvitations(await cancelInvitation(token, itineraryId, invitationId));
    } catch (err) {
      setError(getFriendlyErrorMessage(err, { context: { action: 'cancel-invitation', invitationId } }));
    } finally {
      setBusyId(null);
    }
  }

  // Accepted invitations are already reflected in `collaborators` — the
  // panel only needs to additionally show open/resolved-but-not-yet-a-
  // member rows, so accepted ones aren't listed twice.
  const openInvitations = invitations.filter((i) => i.status !== 'accepted');

  return (
    <section className="flex flex-col gap-3 rounded-xl border border-slate-200 p-3 dark:border-slate-800">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-slate-700 dark:text-slate-200">Trip participants</p>
        {isOwner && (
          <button
            type="button"
            onClick={() => setShowModal(true)}
            className="flex items-center gap-1 rounded-full bg-brand-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-800"
          >
            <UserPlusIcon aria-hidden className="h-3.5 w-3.5" />
            Invite people
          </button>
        )}
      </div>

      {collaborators.length === 0 ? (
        <p className="text-xs text-slate-500 dark:text-slate-400">Just you so far — invite someone to plan this trip together.</p>
      ) : (
        <ul className="flex flex-wrap gap-2">
          {collaborators.map((c) => (
            <li
              key={c.id}
              className="flex items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700 dark:bg-slate-800 dark:text-slate-200"
            >
              {c.name}
              <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${STATUS_STYLES.accepted}`}>Accepted</span>
              {(isOwner || c.id === user?.id) && (
                <button
                  type="button"
                  onClick={() => setPendingRemove(c)}
                  aria-label={`Remove ${c.name}`}
                  className="text-slate-400 hover:text-flag-700 dark:hover:text-flag-300"
                >
                  ×
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      {isOwner && openInvitations.length > 0 && (
        <ul className="flex flex-col gap-1.5 border-t border-slate-100 pt-3 dark:border-slate-800">
          {openInvitations.map((invitation) => (
            <li
              key={invitation.id}
              className="flex items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-slate-50 dark:hover:bg-slate-800/60"
            >
              <span className="min-w-0 truncate text-slate-700 dark:text-slate-200">
                {invitation.invitee?.name ?? invitation.email}
              </span>
              <span className="flex shrink-0 items-center gap-1.5">
                <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${STATUS_STYLES[invitation.status]}`}>
                  {STATUS_LABELS[invitation.status]}
                </span>
                {!invitation.emailDelivered && invitation.status === 'pending' && (
                  <span
                    title="This invitation's email may not have been delivered"
                    className="rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700 dark:bg-amber-950/40 dark:text-amber-300"
                  >
                    Not delivered
                  </span>
                )}
                {(invitation.status === 'pending' || invitation.status === 'viewed') && (
                  <button
                    type="button"
                    disabled={busyId === invitation.id}
                    onClick={() => handleResend(invitation.id)}
                    className="text-xs font-medium text-brand-700 hover:underline disabled:opacity-50 dark:text-brand-300"
                  >
                    Resend
                  </button>
                )}
                <button
                  type="button"
                  disabled={busyId === invitation.id}
                  onClick={() => handleCancel(invitation.id)}
                  aria-label={`Cancel invitation to ${invitation.email}`}
                  className="text-slate-400 hover:text-flag-700 disabled:opacity-50 dark:hover:text-flag-300"
                >
                  ×
                </button>
              </span>
            </li>
          ))}
        </ul>
      )}

      {error && <p className="text-xs text-flag-700 dark:text-flag-300">{error}</p>}

      {showModal && token && (
        <InvitePeopleModal
          itineraryId={itineraryId}
          token={token}
          onClose={() => setShowModal(false)}
          onInvited={() => {
            reloadInvitations();
            onChange();
          }}
        />
      )}

      <ConfirmDialog
        open={pendingRemove != null}
        title={
          pendingRemove && pendingRemove.id === user?.id
            ? 'Leave this trip?'
            : `Remove ${pendingRemove?.name ?? 'this person'} from this trip?`
        }
        description={
          pendingRemove && pendingRemove.id === user?.id
            ? "You'll lose access to this trip's itinerary unless the owner invites you again."
            : "They'll lose access to this trip's itinerary unless invited again."
        }
        confirmLabel={pendingRemove && pendingRemove.id === user?.id ? 'Leave Trip' : 'Remove'}
        loadingLabel={pendingRemove && pendingRemove.id === user?.id ? 'Leaving…' : 'Removing…'}
        isLoading={removing}
        error={removeError}
        onConfirm={confirmRemove}
        onCancel={() => {
          if (removing) return;
          setPendingRemove(null);
          setRemoveError(null);
        }}
      />
    </section>
  );
}
