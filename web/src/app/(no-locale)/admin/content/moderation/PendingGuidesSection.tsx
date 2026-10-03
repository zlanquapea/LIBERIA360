'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { getPendingGuides, reviewGuide } from '@/lib/creator-guides-api';
import { HttpError } from '@/lib/http';
import type { CreatorGuide } from '@/lib/types';

// Creator guides waiting for review. A guide only goes live once
// approved here; declining requires a note the creator will see.
export function PendingGuidesSection() {
  const { token } = useAuth();
  const [guides, setGuides] = useState<CreatorGuide[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  function reload() {
    if (!token) return;
    getPendingGuides(token)
      .then(setGuides)
      .catch(() => setError('Could not load guides.'));
  }
  useEffect(reload, [token]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <section id="guides" className="flex flex-col gap-3">
      <h2 className="flex items-center gap-2 font-semibold text-slate-800 dark:text-slate-100">
        Creator guides
        {guides && guides.length > 0 && (
          <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800 dark:bg-amber-900/40 dark:text-amber-200">
            {guides.length}
          </span>
        )}
      </h2>
      {error && <p className="text-sm text-flag-700">{error}</p>}
      {guides && guides.length === 0 && <p className="text-sm text-slate-500 dark:text-slate-400">No guides waiting for review.</p>}
      <ul className="flex flex-col gap-3">
        {guides?.map((g) => <PendingGuide key={g.id} guide={g} onDone={reload} />)}
      </ul>
    </section>
  );
}

function PendingGuide({ guide, onDone }: { guide: CreatorGuide; onDone: () => void }) {
  const { token } = useAuth();
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function decide(approve: boolean) {
    if (!token) return;
    if (!approve && !reason.trim()) {
      setError('Add a note so the creator knows what to change.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await reviewGuide(token, guide.id, approve, reason.trim() || undefined);
      onDone();
    } catch (err) {
      setError(err instanceof HttpError ? err.message : 'Something went wrong.');
      setBusy(false);
    }
  }

  return (
    <li className="flex flex-col gap-2 rounded-xl border border-slate-200 p-4 dark:border-slate-800">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="font-semibold text-slate-900 dark:text-slate-50">{guide.title}</p>
        <Link href={`/creators/${guide.creator.username}`} className="text-sm text-brand-700 hover:underline">
          by {guide.creator.name}
        </Link>
      </div>
      <p className="whitespace-pre-line text-sm text-slate-700 dark:text-slate-300">{guide.summary}</p>
      <ol className="list-decimal ps-5 text-sm text-slate-700 dark:text-slate-300">
        {guide.stops.map((s) => (
          <li key={s.place.id}>
            Day {s.day}: <Link href={`/places/${s.place.slug}`} className="underline">{s.place.name}</Link>
            {s.note && <span className="text-slate-500"> — {s.note}</span>}
          </li>
        ))}
      </ol>
      <p className="text-xs text-slate-500 dark:text-slate-400">
        Cover: {guide.coverImage ? <a href={guide.coverImage} target="_blank" rel="noreferrer" className="underline">view</a> : 'none'} · Video:{' '}
        {guide.videoUrl ? <a href={guide.videoUrl} target="_blank" rel="noreferrer" className="underline">{guide.videoUrl}</a> : 'none'} · Media permission:{' '}
        {guide.mediaPermissionConfirmedAt ? 'confirmed by creator' : 'not needed'}
      </p>
      <textarea
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        rows={2}
        maxLength={1000}
        placeholder="Note to the creator (required to decline)"
        aria-label={`Review note for ${guide.title}`}
        className="rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900"
      />
      {error && <p className="text-sm text-flag-700">{error}</p>}
      <div className="flex gap-2">
        <button type="button" disabled={busy} onClick={() => decide(true)} className="rounded-full bg-brand-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">
          Approve and publish
        </button>
        <button type="button" disabled={busy} onClick={() => decide(false)} className="rounded-full border border-flag-500 px-4 py-2 text-sm font-semibold text-flag-700 disabled:opacity-60">
          Decline
        </button>
      </div>
    </li>
  );
}
