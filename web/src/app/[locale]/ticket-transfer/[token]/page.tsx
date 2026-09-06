'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import {
  acceptTicketTransferByToken,
  declineTicketTransferByToken,
  getTicketTransferPreview,
} from '@/lib/event-ticket-api';
import { HttpError } from '@/lib/http';
import type { TicketTransferPreview } from '@/lib/types';

function formatDate(value: string) {
  return new Date(value).toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

// The emailed ticket-transfer link's landing page ("buy two, send one") —
// works whether or not the visitor is signed in yet, mirroring
// /invite/[token] exactly (Sep 5, 2026: a transfer no longer requires the
// recipient to already have an account — see the backend's TicketTransfer
// doc comment for why): `requiresAccount` decides whether a signed-out
// visitor gets a "create account" path alongside "log in", same as
// InvitationPage's SignedOutActions.
export default function TicketTransferPage() {
  const { token } = useParams<{ token: string }>();
  const router = useRouter();
  const { user, token: authToken, ready } = useAuth();
  const [preview, setPreview] = useState<TicketTransferPreview | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [responding, setResponding] = useState<'accept' | 'decline' | null>(null);
  const [respondError, setRespondError] = useState<string | null>(null);
  const [declined, setDeclined] = useState(false);

  useEffect(() => {
    getTicketTransferPreview(token)
      .then(setPreview)
      .catch((err) =>
        setLoadError(err instanceof HttpError ? err.message : 'This transfer link could not be found.'),
      );
  }, [token]);

  async function handleAccept() {
    if (!authToken) return;
    setResponding('accept');
    setRespondError(null);
    try {
      await acceptTicketTransferByToken(authToken, token);
      router.push('/account/my-tickets');
    } catch (err) {
      setRespondError(err instanceof HttpError ? err.message : 'Could not accept this ticket.');
      setResponding(null);
    }
  }

  async function handleDecline() {
    if (!authToken) return;
    setResponding('decline');
    setRespondError(null);
    try {
      await declineTicketTransferByToken(authToken, token);
      setDeclined(true);
    } catch (err) {
      setRespondError(err instanceof HttpError ? err.message : 'Could not decline this ticket.');
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
        <p className="text-sm text-slate-500 dark:text-slate-400">Loading ticket transfer…</p>
      </main>
    );
  }

  const resolved = preview.status !== 'pending' || preview.expired;

  return (
    <main className="mx-auto flex max-w-sm flex-col gap-6 px-4 py-10">
      <div className="flex flex-col gap-2 text-center">
        <p className="text-xs font-semibold uppercase tracking-wide text-brand-700 dark:text-brand-300">
          You&apos;ve been sent a ticket!
        </p>
        <h1 className="text-xl font-bold text-slate-900 dark:text-slate-50">
          {preview.fromUserName} sent you a ticket to {preview.eventName}
        </h1>
      </div>

      <dl className="flex flex-col gap-2 rounded-xl border border-slate-200 p-4 text-sm dark:border-slate-800">
        <Row label="Event" value={preview.eventName} />
        <Row label="Date" value={formatDate(preview.eventStartDate)} />
        <Row label="Ticket type" value={preview.ticketTypeName} />
        <Row label="Ticket ID" value={preview.ticketNumber} />
        <Row label="Sent by" value={preview.fromUserName} />
      </dl>

      <div className="rounded-xl bg-slate-50 p-3 text-xs text-slate-500 dark:bg-slate-900 dark:text-slate-400">
        Accept it and it&apos;s yours — with its own QR pass in My Tickets. It stops working for{' '}
        {preview.fromUserName} the moment you do.
      </div>

      {declined ? (
        <p className="text-center text-sm text-slate-500 dark:text-slate-400">You declined this ticket.</p>
      ) : preview.status === 'accepted' ? (
        <p className="text-center text-sm text-emerald-700 dark:text-emerald-400">This ticket has already been accepted.</p>
      ) : preview.status === 'declined' ? (
        <p className="text-center text-sm text-slate-500 dark:text-slate-400">This ticket transfer was declined.</p>
      ) : preview.status === 'cancelled' ? (
        <p className="text-center text-sm text-slate-500 dark:text-slate-400">This ticket transfer was cancelled by the sender.</p>
      ) : preview.expired ? (
        <p className="text-center text-sm text-slate-500 dark:text-slate-400">This transfer link has expired — ask {preview.fromUserName} to send it again.</p>
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
              {responding === 'accept' ? 'Accepting…' : 'Accept ticket'}
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

      {!resolved && !declined && user && authToken && preview.toEmail.toLowerCase() !== user.email.toLowerCase() && (
        <p className="text-center text-xs text-slate-400 dark:text-slate-400">
          This ticket was sent to {preview.toEmail} — you&apos;re signed in as {user.email}.
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

// Mirrors /invite/[token]'s SignedOutActions exactly: requiresAccount
// decides whether "create an account" is offered alongside "log in".
function SignedOutActions({ token, preview }: { token: string; preview: TicketTransferPreview }) {
  const next = `/ticket-transfer/${token}`;
  if (preview.requiresAccount) {
    return (
      <div className="flex flex-col gap-2">
        <Link
          href={`/signup?ticketTransfer=${token}&email=${encodeURIComponent(preview.toEmail)}`}
          className="rounded-full bg-brand-700 px-4 py-2.5 text-center text-sm font-semibold text-white hover:bg-brand-800"
        >
          Create account & claim ticket
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
        This ticket was sent to {preview.toEmail} — log in with that account to accept it.
      </p>
    </div>
  );
}
