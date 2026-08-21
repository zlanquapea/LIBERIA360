'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { getBookingMessages, sendBookingMessage } from '@/lib/booking-messages-api';
import { HttpError } from '@/lib/http';
import type { BookingMessage } from '@/lib/types';

// In-platform note thread on a single booking, between the guest and the
// business owner — the same conversation a `wa.me` link would carry off
// to WhatsApp, but kept here: visible to both sides on this page, and not
// lost the moment someone clears their WhatsApp history. Collapsed by
// default (a plain "Messages" toggle) so a booking list with many rows
// doesn't turn into a wall of chat threads.
export default function BookingMessageThread({ bookingId }: { bookingId: string }) {
  const { user, token } = useAuth();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<BookingMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !token) return;
    let cancelled = false;
    setLoading(true);
    getBookingMessages(token, bookingId)
      .then((data) => {
        if (!cancelled) setMessages(data);
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof HttpError ? err.message : 'Could not load messages.');
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, token, bookingId]);

  async function send() {
    const body = draft.trim();
    if (!body || !token) return;
    setSending(true);
    setError(null);
    try {
      const message = await sendBookingMessage(token, bookingId, body);
      setMessages((prev) => [...prev, message]);
      setDraft('');
    } catch (err) {
      setError(err instanceof HttpError ? err.message : 'Message could not be sent.');
    } finally {
      setSending(false);
    }
  }

  if (!token) return null;

  return (
    <div className="mt-2 border-t border-slate-100 dark:border-slate-800 pt-2">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="text-xs font-medium text-brand-700 dark:text-brand-300 hover:underline"
      >
        {open ? 'Hide messages' : messages.length > 0 ? `Messages (${messages.length})` : 'Messages'}
      </button>

      {open && (
        <div className="mt-2 flex flex-col gap-2">
          {loading ? (
            <p className="text-xs text-slate-500 dark:text-slate-400">Loading…</p>
          ) : messages.length === 0 ? (
            <p className="text-xs text-slate-500 dark:text-slate-400">No messages yet.</p>
          ) : (
            <ul className="flex flex-col gap-1.5">
              {messages.map((message) => {
                const mine = message.senderUserId === user?.id;
                return (
                  <li
                    key={message.id}
                    className={`max-w-[85%] rounded-lg px-2.5 py-1.5 text-sm ${
                      mine ? 'ml-auto bg-brand-700 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-100'
                    }`}
                  >
                    {!mine && (
                      <p className="text-[11px] font-semibold opacity-80">
                        {message.sender?.name ?? 'Unknown'}
                      </p>
                    )}
                    <p>{message.body}</p>
                  </li>
                );
              })}
            </ul>
          )}

          {error && <p className="text-xs text-flag-700 dark:text-flag-300">{error}</p>}

          <div className="flex gap-2">
            <input
              type="text"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  send();
                }
              }}
              placeholder="Write a message…"
              maxLength={2000}
              className="flex-1 rounded-lg border border-slate-300 dark:border-slate-700 px-3 py-1.5 text-sm outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
            />
            <button
              type="button"
              disabled={sending || !draft.trim()}
              onClick={send}
              className="rounded-full bg-brand-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-800 disabled:opacity-60"
            >
              {sending ? 'Sending…' : 'Send'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
