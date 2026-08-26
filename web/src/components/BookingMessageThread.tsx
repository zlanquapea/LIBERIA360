'use client';

import { useEffect, useRef, useState } from 'react';
import { ChatBubbleLeftRightIcon, PaperAirplaneIcon } from '@heroicons/react/24/outline';
import { MdAccessTime, MdDone, MdDoneAll } from 'react-icons/md';
import { useAuth } from '@/hooks/useAuth';
import { getBookingMessages, markBookingMessagesRead, sendBookingMessage } from '@/lib/booking-messages-api';
import { HttpError } from '@/lib/http';
import type { BookingMessage } from '@/lib/types';

// How often to re-poll the thread while it's open, so a read receipt
// (or the other side's reply) shows up without the viewer having to
// close and reopen the booking. No websocket/push infra in this app yet
// (see PWA's web-push module, which is for browser notifications, not
// in-app realtime) — a light poll is the pragmatic stand-in.
const POLL_INTERVAL_MS = 5000;

// A message still in flight — appended to the thread immediately on send
// (product feedback, Aug 2026: "they should be able to see the status,
// sent, deliver and view") so composing feels instant, then replaced by
// the real, persisted BookingMessage once the API confirms it.
interface PendingMessage {
  localId: string;
  body: string;
}

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
  const [pending, setPending] = useState<PendingMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const hasUnreadFromOther = useRef(false);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;

    async function load(initial: boolean) {
      if (initial) setLoading(true);
      try {
        const data = await getBookingMessages(token as string, bookingId);
        if (cancelled) return;
        setMessages(data);
        hasUnreadFromOther.current = data.some((m) => m.senderUserId !== user?.id && !m.readAt);
        if (hasUnreadFromOther.current) {
          // Fire-and-forget: this is the "viewing the thread" signal, not
          // something the reader needs to wait on or see fail.
          markBookingMessagesRead(token as string, bookingId).catch(() => undefined);
        }
      } catch (err) {
        if (!cancelled && initial) {
          setError(err instanceof HttpError ? err.message : 'Could not load messages.');
        }
      } finally {
        if (!cancelled && initial) setLoading(false);
      }
    }

    load(true);
    const interval = setInterval(() => load(false), POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [token, bookingId, user?.id]);

  async function send() {
    const body = draft.trim();
    if (!body || !token) return;
    const localId = `pending-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    setPending((prev) => [...prev, { localId, body }]);
    setDraft('');
    setSending(true);
    setError(null);
    try {
      const message = await sendBookingMessage(token, bookingId, body);
      setMessages((prev) => [...prev, message]);
      setPending((prev) => prev.filter((p) => p.localId !== localId));
    } catch (err) {
      setPending((prev) => prev.filter((p) => p.localId !== localId));
      setDraft(body); // don't make them retype it
      setError(err instanceof HttpError ? err.message : 'Message could not be sent.');
    } finally {
      setSending(false);
    }
  }

  if (!token) return null;

  const isEmpty = messages.length === 0 && pending.length === 0;

  return (
    <div className="flex flex-col gap-3">
      <p className="flex items-center gap-1.5 text-sm font-semibold text-slate-700 dark:text-slate-200">
        <ChatBubbleLeftRightIcon aria-hidden className="h-4 w-4 text-brand-600 dark:text-brand-300" />
        Conversation
      </p>

      <div className="flex min-h-[4rem] flex-col gap-2 rounded-xl bg-slate-50 dark:bg-slate-800/40 p-3">
        {loading ? (
          <p className="text-xs text-slate-500 dark:text-slate-400">Loading…</p>
        ) : isEmpty ? (
          <p className="text-xs text-slate-500 dark:text-slate-400">No messages yet — say hello 👋</p>
        ) : (
          <ul className="flex flex-col gap-1.5">
            {messages.map((message) => {
              const mine = message.senderUserId === user?.id;
              return (
                <li key={message.id} className={`flex flex-col ${mine ? 'items-end' : 'items-start'}`}>
                  <div
                    className={`max-w-[85%] rounded-2xl px-3 py-1.5 text-sm shadow-sm ${
                      mine
                        ? 'rounded-br-sm bg-brand-700 text-white'
                        : 'rounded-bl-sm bg-white text-slate-800 dark:bg-slate-800 dark:text-slate-100'
                    }`}
                  >
                    {!mine && (
                      <p className="text-[11px] font-semibold opacity-70">{message.sender?.name ?? 'Unknown'}</p>
                    )}
                    <p>{message.body}</p>
                  </div>
                  {mine && <MessageStatus viewed={Boolean(message.readAt)} />}
                </li>
              );
            })}
            {pending.map((p) => (
              <li key={p.localId} className="flex flex-col items-end">
                <div className="max-w-[85%] rounded-2xl rounded-br-sm bg-brand-700/70 px-3 py-1.5 text-sm text-white shadow-sm">
                  <p>{p.body}</p>
                </div>
                <MessageStatus sending />
              </li>
            ))}
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

// The little "Sending… / Delivered / Viewed" ladder under your own bubble
// — same idea as any chat app's checkmarks, just spelled out in words too
// since a single vs. double check isn't obvious out of context.
function MessageStatus({ sending, viewed }: { sending?: boolean; viewed?: boolean }) {
  if (sending) {
    return (
      <span className="mt-0.5 flex items-center gap-1 pr-1 text-[11px] text-slate-400 dark:text-slate-500">
        <MdAccessTime aria-hidden className="h-3 w-3" />
        Sending…
      </span>
    );
  }
  return (
    <span
      className={`mt-0.5 flex items-center gap-1 pr-1 text-[11px] ${
        viewed ? 'text-brand-600 dark:text-brand-300' : 'text-slate-400 dark:text-slate-500'
      }`}
    >
      {viewed ? <MdDoneAll aria-hidden className="h-3.5 w-3.5" /> : <MdDone aria-hidden className="h-3.5 w-3.5" />}
      {viewed ? 'Viewed' : 'Delivered'}
    </span>
  );
}
