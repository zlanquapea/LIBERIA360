'use client';

import { useEffect, useRef, useState } from 'react';
import { ChatBubbleLeftRightIcon, PaperAirplaneIcon } from '@heroicons/react/24/outline';
import { useAuth } from '@/hooks/useAuth';
import {
  getFoodOrderMessages,
  markFoodOrderMessagesRead,
  sendFoodOrderMessage,
} from '@/lib/food-order-messages-api';
import { HttpError } from '@/lib/http';
import { MessageStatus } from './MessageStatus';
import type { FoodOrderMessage } from '@/lib/types';

// Same 5-second poll BookingMessageThread uses — no websocket/push infra
// in this app yet, so a light poll is the pragmatic stand-in for "the
// other side replied" or "they just read my message".
const POLL_INTERVAL_MS = 5000;

// A message still in flight — appended immediately on send so composing
// feels instant, then replaced by the real, persisted FoodOrderMessage
// once the API confirms it. Same UX as BookingMessageThread's PendingMessage.
interface PendingMessage {
  localId: string;
  body: string;
}

// In-platform note thread on a single food order, between the buyer and
// the restaurant owner. A deliberately simpler sibling of
// BookingMessageThread — no edit/delete, since an order's conversation is
// short-lived (see FoodOrderMessage's doc comment on the backend) — but
// the same readAt-based "Sending / Delivered / Viewed" receipt convention.
export default function FoodOrderMessageThread({ orderId }: { orderId: string }) {
  const { user, token } = useAuth();
  const [messages, setMessages] = useState<FoodOrderMessage[]>([]);
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
        const data = await getFoodOrderMessages(token as string, orderId);
        if (cancelled) return;
        setMessages(data);
        hasUnreadFromOther.current = data.some((m) => m.senderUserId !== user?.id && !m.readAt);
        if (hasUnreadFromOther.current) {
          markFoodOrderMessagesRead(token as string, orderId).catch(() => undefined);
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
  }, [token, orderId, user?.id]);

  async function send() {
    const body = draft.trim();
    if (!body || !token) return;
    const localId = `pending-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    setPending((prev) => [...prev, { localId, body }]);
    setDraft('');
    setSending(true);
    setError(null);
    try {
      const message = await sendFoodOrderMessage(token, orderId, body);
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
                  {mine && (
                    <div className="mt-0.5 pr-1 text-[11px] text-slate-400 dark:text-slate-500">
                      <MessageStatus viewed={Boolean(message.readAt)} />
                    </div>
                  )}
                </li>
              );
            })}
            {pending.map((p) => (
              <li key={p.localId} className="flex flex-col items-end">
                <div className="max-w-[85%] rounded-2xl rounded-br-sm bg-brand-700/70 px-3 py-1.5 text-sm text-white shadow-sm">
                  <p>{p.body}</p>
                </div>
                <div className="mt-0.5 pr-1 text-[11px] text-slate-400 dark:text-slate-500">
                  <MessageStatus sending />
                </div>
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
