'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import {
  acceptInvitationByToken,
  declineInvitationByToken,
  getInvitationPreview,
} from '@/lib/invitations-api';
import { HttpError } from '@/lib/http';
import type { InvitationPreview } from '@/lib/types';

// The invite-link landing page (Section 2/5/9): works whether or not the
// visitor is signed in, and never shows real trip content (stops,
// participant contact info) — just enough to decide whether to accept.
export default function InvitePage() {
  const { token } = useParams<{ token: string }>();
  const router = useRouter();
  const { user, token: authToken, ready } = useAuth();
  const [preview, setPreview] = useState<InvitationPreview | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [responding, setResponding] = useState<'accept' | 'decline' | null>(null);
  const [respondError, setRespondError] = useState<string | null>(null);
  const [declined, setDeclined] = useState(false);

  useEffect(() => {
    getInvitationPreview(token)
      .then(setPreview)
      .catch((err) =>
        setLoadError(err instanceof HttpError ? err.message : 'This invitation link could not be found.'),
      );
  }, [token]);

  async function handleAccept() {
    if (!authToken) return;
    setResponding('accept');
    setRespondError(null);
    try {
      const trip = await acceptInvitationByToken(authToken, token);
      router.push(`/trips/${trip.id}`);
    } catch (err) {
      setRespondError(err instanceof HttpError ? err.message : 'Could not accept this invitation.');
      setResponding(null);
    }
  }

  async function handleDecline() {
    if (!authToken) return;
    setResponding('decline');
    setRespondError(null);
    try {
      await declineInvitationByToken(authToken, token);
      setDeclined(true);
    } catch (err) {
      setRespondError(err instanceof HttpError ? err.message : 'Could not decline this invitation.');
    } finally {
      setResponding(null);
    }
  }

  if (loadError) {
    return (
      <main className="mx-auto flex max-w-sm flex-col gap-4 px-4 py-16 text-center">
        <p className="rounded-lg bg-flag-500/10 px-3 py-2 text-sm text-flag-700 dark:text-flag-300">{loadError}</p>
        <Link href="/" className="text-sm font-medium text-brand-700 hover:underline dark:text-brand-300">
          Go to LIBERIA360
        </Link>
      </main>
    );
  }

  if (!preview) {
    return (
      <main className="mx-auto flex max-w-sm flex-col gap-4 px-4 py-16 text-center">
        <p className="text-sm text-slate-500 dark:text-slate-400">Loading invitation…</p>
      </main>
    );
  }

  const resolved = preview.status !== 'pending' && preview.status !== 'viewed';

  return (
    <main className="mx-auto flex max-w-sm flex-col gap-6 px-4 py-10">
      <div className="flex flex-col gap-2 text-center">
        <p className="text-xs font-semibold uppercase tracking-wide text-brand-700 dark:text-brand-300">You&apos;ve been invited!</p>
        <h1 className="text-xl font-bold text-slate-900 dark:text-slate-50">
          {preview.organizerName} invited you to join {preview.tripTitle}
        </h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">{preview.overview}</p>
      </div>

      <dl className="flex flex-col gap-2 rounded-xl border border-slate-200 p-4 text-sm dark:border-slate-800">
        <Row label="Trip" value={preview.tripTitle} />
        <Row label="Destination" value={preview.destinationSummary} />
        <Row label="Duration" value={`${preview.durationDays} day${preview.durationDays === 1 ? '' : 's'}`} />
        <Row label="Organizer" value={preview.organizerName} />
        {preview.otherParticipantNames.length > 0 && (
          <Row label="Also going" value={preview.otherParticipantNames.join(', ')} />
        )}
        <Row label="Invited" value={preview.invitedEmail} />
      </dl>

      <div className="rounded-xl bg-slate-50 p-3 text-xs text-slate-500 dark:bg-slate-900 dark:text-slate-400">
        Once you join, you&apos;ll be able to view the itinerary, see who else is going, add and edit stops, and get updates on this trip.
      </div>

      {declined ? (
        <p className="text-center text-sm text-slate-500 dark:text-slate-400">You declined this invitation.</p>
      ) : preview.status === 'accepted' ? (
        <p className="text-center text-sm text-emerald-700 dark:text-emerald-400">This invitation has already been accepted.</p>
      ) : preview.status === 'declined' ? (
        <p className="text-center text-sm text-slate-500 dark:text-slate-400">This invitation was declined.</p>
      ) : preview.status === 'expired' ? (
        <p className="text-center text-sm text-slate-500 dark:text-slate-400">This invitation has expired — ask the organizer to resend it.</p>
      ) : !ready ? null : user && authToken ? (
        <div className="flex flex-col gap-2">
          {respondError && (
            <p role="alert" className="rounded-lg bg-flag-500/10 px-3 py-2 text-xs text-flag-700 dark:text-flag-300">
              {respondError}
            </p>
          )}
          <div className="flex gap-2">
            <button
              type="button"
              disabled={responding !== null}
              onClick={handleAccept}
              className="flex-1 rounded-full bg-brand-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-800 disabled:opacity-60"
            >
              {responding === 'accept' ? 'Joining…' : 'Accept invitation'}
            </button>
            <button
              type="button"
              disabled={responding !== null}
              onClick={handleDecline}
              className="rounded-full border border-slate-300 px-4 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-60 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              {responding === 'decline' ? 'Declining…' : 'Decline'}
            </button>
          </div>
        </div>
      ) : (
        <SignedOutActions token={token} preview={preview} />
      )}

      {!resolved && !declined && user && authToken && preview.invitedEmail.toLowerCase() !== user.email.toLowerCase() && (
        <p className="text-center text-xs text-slate-400 dark:text-slate-400">
          This invitation was sent to {preview.invitedEmail} — you&apos;re signed in as {user.email}.
        </p>
      )}
    </main>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="shrink-0 text-slate-400 dark:text-slate-500">{label}</dt>
      <dd className="truncate text-right font-medium text-slate-700 dark:text-slate-200">{value}</dd>
    </div>
  );
}

function SignedOutActions({ token, preview }: { token: string; preview: InvitationPreview }) {
  const next = `/invite/${token}`;
  if (preview.requiresAccount) {
    return (
      <div className="flex flex-col gap-2">
        <Link
          href={`/signup?invite=${token}&email=${encodeURIComponent(preview.invitedEmail)}`}
          className="rounded-full bg-brand-700 px-4 py-2.5 text-center text-sm font-semibold text-white hover:bg-brand-800"
        >
          Create account & join
        </Link>
        <p className="text-center text-xs text-slate-400 dark:text-slate-400">
          Already have an account?{' '}
          <Link href={`/login?next=${encodeURIComponent(next)}`} className="font-medium text-brand-700 hover:underline dark:text-brand-300">
            Log in
          </Link>
        </p>
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-2">
      <Link
        href={`/login?next=${encodeURIComponent(next)}`}
        className="rounded-full bg-brand-700 px-4 py-2.5 text-center text-sm font-semibold text-white hover:bg-brand-800"
      >
        Log in to accept
      </Link>
      <p className="text-center text-xs text-slate-400 dark:text-slate-400">
        New here?{' '}
        <Link
          href={`/signup?invite=${token}&email=${encodeURIComponent(preview.invitedEmail)}`}
          className="font-medium text-brand-700 hover:underline dark:text-brand-300"
        >
          Create an account
        </Link>
      </p>
    </div>
  );
}
