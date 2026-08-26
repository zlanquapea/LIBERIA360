'use client';

import { useEffect, useState } from 'react';
import { ChatBubbleLeftRightIcon, PaperAirplaneIcon } from '@heroicons/react/24/outline';
import { useAuth } from '@/hooks/useAuth';
import { getBookingMessages, sendBookingMessage } from '@/lib/booking-messages-api';
import { HttpError } from '@/lib/http';
import type { BookingMessage } from '@/lib/types';

// In-platform note thread on a single booking, between the guest and the
// business owner — the same conversation a `wa.me` link would carry off
// to WhatsApp, but kept here: visible to both sides, and not lost the
// moment someone clears their WhatsApp history.
//
// Lives inside BookingDetailModal now, not inline in a booking list row
// (product feedback, Aug 2026: "don't put the messaging and the booking on
// that one page to make things long ... when you click on a book you can
// see the messaging there") — since opening this thread is already a
// deliberate click into one booking's detail view, it loads and shows
// itself immediately rather than sitting behind its own second toggle.
export default function BookingMessageThread({ bookingId }: { bookingId: string }) {
  const { user, token } = useAuth();
  const [messages, setMessages] = useState<BookingMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
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
  }, [token, bookingId]);

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
    <div className="flex flex-col gap-3">
      <p className="flex items-center gap-1.5 text-sm font-semibold text-slate-700 dark:text-slate-200">
        <ChatBubbleLeftRightIcon aria-hidden className="h-4 w-4 text-brand-600 dark:text-brand-300" />
        Conversation
      </p>

      <div className="flex min-h-[4rem] flex-col gap-2 rounded-xl bg-slate-50 dark:bg-slate-800/40 p-3">
        {loading ? (
          <p className="text-xs text-slate-500 dark:text-slate-400">Loading…</p>
        ) : messages.length === 0 ? (
          <p className="text-xs text-slate-500 dark:text-slate-400">No messages yet — say hello 👋</p>
        ) : (
          <ul className="flex flex-col gap-1.5">
            {messages.map((message) => {
              const mine = message.senderUserId === user?.id;
              return (
                <li
                  key={message.id}
                  className={`max-w-[85%] rounded-2xl px-3 py-1.5 text-sm shadow-sm ${
                    mine
                      ? 'ml-auto rounded-br-sm bg-brand-700 text-white'
                      : 'rounded-bl-sm bg-white text-slate-800 dark:bg-slate-800 dark:text-slate-100'
                  }`}
                >
                  {!mine && (
                    <p className="text-[11px] font-semibold opacity-70">{message.sender?.name ?? 'Unknown'}</p>
                  )}
                  <p>{message.body}</p>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {error && <p className="text-xs text-flag-700 dark:text-flag-300">{error}</p>}

      <div className="flex items-center gap-2">
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
          className="flex-1 rounded-full border border-slate-300 dark:border-slate-700 px-4 py-2 text-sm outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
        />
        <button
          type="button"
          aria-label="Send message"
          disabled={sending || !draft.trim()}
          onClick={send}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-700 text-white transition-transform hover:bg-brand-800 disabled:opacity-40 disabled:hover:bg-brand-700 enabled:active:scale-90"
        >
          <PaperAirplaneIcon aria-hidden className="h-4 w-4 -rotate-45" />
        </button>
      </div>
    </div>
  );
}
