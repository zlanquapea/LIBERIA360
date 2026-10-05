'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { MicrophoneIcon, PaperAirplaneIcon } from '@heroicons/react/24/outline';
import {
  getConsultationMessages,
  sendConsultationMessage,
  sendVoiceNote,
  voiceNoteUrl,
  type ConsultationMessage,
} from '@/lib/consultations-api';
import { clock } from '@/lib/consultations';
import { VoiceRecorder } from './VoiceRecorder';

const time = (iso: string) => new Date(iso).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });

/** The consultation conversation: text and voice notes, both sides. */
export function ConsultationChat({
  consultationId,
  open,
  otherName,
  emptyHint,
}: {
  consultationId: string;
  open: boolean;
  otherName: string;
  emptyHint: string;
}) {
  const [messages, setMessages] = useState<ConsultationMessage[] | null>(null);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const endRef = useRef<HTMLDivElement>(null);

  const load = useCallback(() => {
    getConsultationMessages(consultationId)
      .then(setMessages)
      .catch((e) => setError(e instanceof Error ? e.message : 'Could not load messages.'));
  }, [consultationId]);

  useEffect(() => {
    load();
    if (!open) return;
    const t = setInterval(load, 10000);
    return () => clearInterval(t);
  }, [load, open]);

  useEffect(() => {
    endRef.current?.scrollIntoView?.({ block: 'nearest' });
  }, [messages?.length]);

  async function send() {
    const body = draft.trim();
    if (!body) return;
    setSending(true);
    setError('');
    try {
      const saved = await sendConsultationMessage(consultationId, body);
      setMessages((m) => [...(m ?? []), saved]);
      setDraft('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Message not sent.');
    } finally {
      setSending(false);
    }
  }

  async function sendVoice(blob: Blob, seconds: number) {
    const saved = await sendVoiceNote(consultationId, blob, seconds);
    setMessages((m) => [...(m ?? []), saved]);
  }

  return (
    <section aria-label="Consultation messages" className="flex flex-col gap-3 rounded-[2rem] border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900/60">
      <div className="flex max-h-[28rem] min-h-40 flex-col gap-2 overflow-y-auto">
        {messages === null ? (
          <p className="text-sm text-slate-500">Loading…</p>
        ) : messages.length === 0 ? (
          <p className="m-auto max-w-xs text-center text-sm text-slate-500 dark:text-slate-400">{emptyHint}</p>
        ) : (
          messages.map((m) => (
            <div key={m.id} className={`flex flex-col ${m.mine ? 'items-end' : 'items-start'}`}>
              {m.voice ? (
                <div
                  className={`flex max-w-[90%] items-center gap-2 rounded-2xl px-3 py-2 ${
                    m.mine ? 'bg-brand-700 text-white' : 'bg-white text-slate-800 shadow-sm dark:bg-slate-800 dark:text-slate-100'
                  }`}
                >
                  <MicrophoneIcon aria-hidden className="h-4 w-4 shrink-0" />
                  <audio controls preload="none" src={voiceNoteUrl(m.id)} className="h-9 w-52 max-w-full" aria-label={`Voice note, ${clock(m.voice.seconds ?? 0)}`} />
                  <span className="text-xs tabular-nums opacity-80">{clock(m.voice.seconds ?? 0)}</span>
                </div>
              ) : (
                <span
                  className={`max-w-[85%] whitespace-pre-line rounded-2xl px-3 py-2 text-sm [overflow-wrap:anywhere] ${
                    m.mine ? 'bg-brand-700 text-white' : 'bg-white text-slate-800 shadow-sm dark:bg-slate-800 dark:text-slate-100'
                  }`}
                >
                  {m.body}
                </span>
              )}
              <span className="mt-0.5 text-[11px] text-slate-400">
                {m.mine ? 'You' : otherName} · {time(m.createdAt)}
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
      {open ? (
        <div className="flex items-end gap-2">
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
          {draft.trim() ? (
            <button
              type="button"
              onClick={() => void send()}
              disabled={sending}
              aria-label="Send message"
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-brand-700 text-white disabled:opacity-50"
            >
              <PaperAirplaneIcon aria-hidden className="h-5 w-5" />
            </button>
          ) : (
            <VoiceRecorder onSend={sendVoice} />
          )}
        </div>
      ) : (
        <p className="text-center text-xs text-slate-500 dark:text-slate-400">This consultation is closed.</p>
      )}
    </section>
  );
}
