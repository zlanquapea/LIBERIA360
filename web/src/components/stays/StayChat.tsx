'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { PaperAirplaneIcon } from '@heroicons/react/24/outline';
import {
  getReservationMessages,
  sendReservationMessage,
  type ReservationMessage,
} from '@/lib/stays-api';

const time = (iso: string) =>
  new Date(iso).toLocaleString(undefined, { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });

/** The guest and the front desk talking about one stay. */
export function StayChat({
  reservationId,
  otherName,
  emptyHint,
  canWrite = true,
}: {
  reservationId: string;
  otherName: string;
  emptyHint: string;
  canWrite?: boolean;
}) {
  const [messages, setMessages] = useState<ReservationMessage[] | null>(null);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const endRef = useRef<HTMLDivElement>(null);

  const load = useCallback(() => {
    getReservationMessages(reservationId)
      .then(setMessages)
      .catch((e) => setError(e instanceof Error ? e.message : 'Could not load messages.'));
  }, [reservationId]);

  useEffect(() => {
    load();
    const t = setInterval(load, 15000);
    return () => clearInterval(t);
  }, [load]);

  useEffect(() => {
    endRef.current?.scrollIntoView?.({ block: 'nearest' });
  }, [messages?.length]);

  async function send() {
    const body = draft.trim();
    if (!body) return;
    setSending(true);
    setError('');
    try {
      const saved = await sendReservationMessage(reservationId, body);
      setMessages((m) => [...(m ?? []), saved]);
      setDraft('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Message not sent.');
    } finally {
      setSending(false);
    }
  }

  return (
    <section
      aria-label="Messages"
      className="flex flex-col gap-3 rounded-[2rem] border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900/60"
    >
      <div className="flex max-h-80 min-h-28 flex-col gap-2 overflow-y-auto">
        {messages === null ? (
          <p className="text-sm text-slate-500">Loading…</p>
        ) : messages.length === 0 ? (
          <p className="m-auto max-w-xs text-center text-sm text-slate-500 dark:text-slate-400">{emptyHint}</p>
        ) : (
          messages.map((m) => (
            <div key={m.id} className={`flex flex-col ${m.mine ? 'items-end' : 'items-start'}`}>
              <span
                className={`max-w-[85%] whitespace-pre-line rounded-2xl px-3 py-2 text-sm [overflow-wrap:anywhere] ${
                  m.mine ? 'bg-brand-700 text-white' : 'bg-white text-slate-800 shadow-sm dark:bg-slate-800 dark:text-slate-100'
                }`}
              >
                {m.body}
              </span>
              <span className="mt-0.5 text-[11px] text-slate-400">
                {m.mine ? 'You' : otherName} · {time(m.createdAt)}
                {m.mine && m.readAt ? ' · Seen' : ''}
              </span>
            </div>
          ))
        )}
        <div ref={endRef} />
      </div>
      {error && (
        <p role="alert" className="text-sm text-red-700 dark:text-red-300">
          {error}
        </p>
      )}
      {canWrite && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void send();
          }}
          className="flex items-end gap-2"
        >
          <label className="min-w-0 flex-1">
            <span className="sr-only">Message</span>
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              rows={1}
              maxLength={2000}
              placeholder="Write a message"
              className="w-full resize-none rounded-2xl border border-slate-300 bg-white p-3 text-sm outline-none focus:border-brand-600 dark:border-slate-700 dark:bg-slate-800"
            />
          </label>
          <button
            type="submit"
            disabled={sending || !draft.trim()}
            aria-label="Send message"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-brand-700 text-white disabled:opacity-40"
          >
            <PaperAirplaneIcon aria-hidden className="h-5 w-5" />
          </button>
        </form>
      )}
    </section>
  );
}
