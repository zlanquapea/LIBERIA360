'use client';

import { useState } from 'react';
import { XMarkIcon } from '@heroicons/react/24/outline';
import { transferTicket } from '@/lib/event-ticket-api';
import { HttpError } from '@/lib/http';
import type { MyTicketsResponse } from '@/lib/types';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// "Buy two, send one" (the AFCON-style ticket transfer feature): the
// current holder of an active, unused ticket sends it to anyone by email
// — deliberately just one plain email field, unlike InvitePeopleModal's
// "search platform users" picker, since there's exactly one way to
// address a ticket transfer either way. The recipient doesn't need a
// LIBERIA360 account yet (Sep 5, 2026 — see the backend's TicketTransfer
// doc comment): they'll get an emailed link either to view/accept
// directly, or to create an account first, whichever applies.
export function SendTicketModal({
  token,
  instanceId,
  eventName,
  ticketTypeName,
  onClose,
  onSent,
}: {
  token: string;
  instanceId: string;
  eventName: string;
  ticketTypeName: string;
  onClose: () => void;
  onSent: (result: MyTicketsResponse) => void;
}) {
  const [email, setEmail] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function send() {
    const trimmed = email.trim().toLowerCase();
    if (!EMAIL_RE.test(trimmed)) {
      setError('Enter a valid email address.');
      return;
    }
    setSending(true);
    setError(null);
    try {
      const result = await transferTicket(token, instanceId, trimmed);
      onSent(result);
      onClose();
    } catch (err) {
      setError(
        err instanceof HttpError
          ? err.message
          : 'Could not send this ticket. Try again.',
      );
    } finally {
      setSending(false);
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Send this ticket to someone"
      className="fixed inset-0 z-[2000] flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      <div
        className="flex w-full max-w-md flex-col gap-4 rounded-2xl bg-white p-5 shadow-xl dark:bg-slate-900"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-slate-900 dark:text-slate-50">Send this ticket</h2>
          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            className="rounded-full p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-300"
          >
            <XMarkIcon aria-hidden className="h-5 w-5" />
          </button>
        </div>

        <p className="text-sm text-slate-600 dark:text-slate-300">
          Send your <strong>{ticketTypeName}</strong> ticket to <strong>{eventName}</strong> to
          someone else by email. Once they accept, it becomes their ticket — with its own QR pass
          — and stops working for you.
        </p>

        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-slate-700 dark:text-slate-200">
            Their email
          </span>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                send();
              }
            }}
            placeholder="name@example.com"
            autoFocus
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 dark:border-slate-700 dark:bg-slate-800"
          />
          <span className="text-xs text-slate-400 dark:text-slate-400">
            No LIBERIA360 account yet? They&apos;ll get a link to create one and claim it.
          </span>
        </label>

        {error && (
          <p role="alert" className="text-xs text-flag-700 dark:text-flag-300">
            {error}
          </p>
        )}

        <div className="mt-1 flex items-center justify-end gap-2 border-t border-slate-100 pt-4 dark:border-slate-800">
          <button
            type="button"
            onClick={onClose}
            disabled={sending}
            className="rounded-full px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 disabled:opacity-60 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={send}
            disabled={sending || !email.trim()}
            className="rounded-full bg-brand-700 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-800 disabled:opacity-60"
          >
            {sending ? 'Sending…' : 'Send ticket'}
          </button>
        </div>
      </div>
    </div>
  );
}
