'use client';

import { useEffect, useRef, useState } from 'react';
import { MicrophoneIcon, PaperAirplaneIcon, StopIcon, TrashIcon } from '@heroicons/react/24/solid';
import { clock } from '@/lib/consultations';

const MAX_SECONDS = 180;

function pickMimeType() {
  if (typeof MediaRecorder === 'undefined') return null;
  for (const type of ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus', 'audio/mp4']) {
    if (MediaRecorder.isTypeSupported?.(type)) return type;
  }
  return '';
}

/**
 * Hold a short voice note (up to 3 minutes): record, listen back, then send
 * or throw away. Voice notes suit patients who'd rather explain than type.
 */
export function VoiceRecorder({
  onSend,
  disabled,
}: {
  onSend: (blob: Blob, seconds: number) => Promise<void>;
  disabled?: boolean;
}) {
  const [state, setState] = useState<'idle' | 'recording' | 'review' | 'sending'>('idle');
  const [seconds, setSeconds] = useState(0);
  const [clip, setClip] = useState<{ blob: Blob; url: string } | null>(null);
  const [error, setError] = useState('');
  const recorder = useRef<MediaRecorder | null>(null);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const started = useRef(0);

  useEffect(
    () => () => {
      if (timer.current) clearInterval(timer.current);
      recorder.current?.stream.getTracks().forEach((t) => t.stop());
    },
    [],
  );
  useEffect(() => () => {
    if (clip) URL.revokeObjectURL(clip.url);
  }, [clip]);

  async function start() {
    setError('');
    const mimeType = pickMimeType();
    if (mimeType === null || !navigator.mediaDevices?.getUserMedia) {
      setError("This browser can't record voice notes. Type your message instead.");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const rec = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      const chunks: Blob[] = [];
      rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);
      rec.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunks, { type: rec.mimeType || 'audio/webm' });
        setClip({ blob, url: URL.createObjectURL(blob) });
        setState('review');
      };
      recorder.current = rec;
      started.current = Date.now();
      setSeconds(0);
      rec.start();
      setState('recording');
      timer.current = setInterval(() => {
        const s = (Date.now() - started.current) / 1000;
        setSeconds(s);
        if (s >= MAX_SECONDS) stop();
      }, 250);
    } catch {
      setError('Allow the microphone to record a voice note.');
    }
  }

  function stop() {
    if (timer.current) clearInterval(timer.current);
    timer.current = null;
    if (recorder.current?.state === 'recording') recorder.current.stop();
  }

  async function send() {
    if (!clip) return;
    setState('sending');
    try {
      await onSend(clip.blob, Math.max(1, seconds));
      setClip(null);
      setState('idle');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Voice note not sent.');
      setState('review');
    }
  }

  return (
    <div className="flex flex-col gap-2">
      {state === 'idle' && (
        <button
          type="button"
          onClick={() => void start()}
          disabled={disabled}
          aria-label="Record a voice note"
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-slate-100 text-brand-800 hover:bg-brand-50 disabled:opacity-50 dark:bg-slate-800 dark:text-brand-200"
        >
          <MicrophoneIcon aria-hidden className="h-5 w-5" />
        </button>
      )}
      {state === 'recording' && (
        <div className="flex items-center gap-3 rounded-full bg-red-50 py-1.5 pe-1.5 ps-4 text-sm font-semibold text-red-800 dark:bg-red-950/40 dark:text-red-200">
          <span aria-hidden className="h-2.5 w-2.5 animate-pulse rounded-full bg-red-600" />
          <span className="tabular-nums" aria-live="polite">
            Recording {clock(seconds)} / {clock(MAX_SECONDS)}
          </span>
          <button
            type="button"
            onClick={stop}
            aria-label="Stop recording"
            className="flex h-9 w-9 items-center justify-center rounded-full bg-red-600 text-white"
          >
            <StopIcon aria-hidden className="h-4 w-4" />
          </button>
        </div>
      )}
      {(state === 'review' || state === 'sending') && clip && (
        <div className="flex flex-wrap items-center gap-2 rounded-2xl bg-slate-50 p-2 dark:bg-slate-800/60">
          <audio controls src={clip.url} className="h-10 min-w-0 flex-1" />
          <button
            type="button"
            onClick={() => {
              setClip(null);
              setState('idle');
            }}
            aria-label="Discard voice note"
            className="flex h-10 w-10 items-center justify-center rounded-full text-slate-500 hover:bg-red-50 hover:text-red-600"
          >
            <TrashIcon aria-hidden className="h-5 w-5" />
          </button>
          <button
            type="button"
            onClick={() => void send()}
            disabled={state === 'sending'}
            aria-label="Send voice note"
            className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-700 text-white disabled:opacity-60"
          >
            <PaperAirplaneIcon aria-hidden className="h-5 w-5" />
          </button>
        </div>
      )}
      {error && (
        <p role="alert" className="text-sm text-red-700 dark:text-red-300">
          {error}
        </p>
      )}
    </div>
  );
}
