'use client';

import { useState, type FormEvent } from 'react';
import { FlagIcon } from '@heroicons/react/24/outline';
import { useAuth } from '@/hooks/useAuth';
import { reportContent } from '@/lib/reports-api';
import { HttpError } from '@/lib/http';
import type { ReportReason, ReportTargetType } from '@/lib/types';

const REASON_OPTIONS: { value: ReportReason; label: string }[] = [
  { value: 'spam', label: 'Spam' },
  { value: 'inappropriate', label: 'Inappropriate content' },
  { value: 'fake', label: "Fake / doesn't seem real" },
  { value: 'other', label: 'Other' },
];

// Small "report this" affordance for reviews and events (the two
// free-text fields any logged-in user can post without an ownership
// check, so the two most likely to attract spam/abuse). Signed out
// visitors see nothing — reporting requires an account so the API can
// enforce one report per user per target. Reports feed the admin
// moderation queue's "Flagged content" section once enough independent
// users flag the same thing (see api/README.md).
export function ReportButton({ targetType, targetId }: { targetType: ReportTargetType; targetId: string }) {
  const { user, token } = useAuth();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<ReportReason>('spam');
  const [details, setDetails] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reported, setReported] = useState(false);

  if (!user) return null;

  if (reported) {
    return <span className="text-xs text-slate-400 dark:text-slate-500">Reported — thanks for flagging this.</span>;
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!token) return;
    setSubmitting(true);
    setError(null);
    try {
      await reportContent(token, { targetType, targetId, reason, details: details.trim() || undefined });
      setReported(true);
      setOpen(false);
    } catch (err) {
      setError(err instanceof HttpError ? err.message : 'Something went wrong. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex items-center gap-1 text-xs text-slate-400 dark:text-slate-500 underline-offset-2 hover:text-flag-700 hover:underline"
      >
        <FlagIcon aria-hidden className="h-3 w-3" />
        Report
      </button>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-col gap-2 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800 p-2 text-xs"
    >
      <select
        value={reason}
        onChange={(e) => setReason(e.target.value as ReportReason)}
        className="rounded border border-slate-300 dark:border-slate-700 px-2 py-1 outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
      >
        {REASON_OPTIONS.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
      <textarea
        value={details}
        onChange={(e) => setDetails(e.target.value)}
        maxLength={500}
        rows={2}
        placeholder="Add details (optional)"
        className="rounded border border-slate-300 dark:border-slate-700 px-2 py-1 outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
      />
      {error && (
        <p role="alert" className="text-flag-700">
          {error}
        </p>
      )}
      <div className="flex items-center gap-2">
        <button
          type="submit"
          disabled={submitting}
          className="rounded-full bg-flag-600 px-3 py-1 font-semibold text-white hover:bg-flag-700 disabled:opacity-60"
        >
          {submitting ? 'Submitting…' : 'Submit report'}
        </button>
        <button type="button" onClick={() => setOpen(false)} className="text-slate-500 dark:text-slate-400 hover:underline">
          Cancel
        </button>
      </div>
    </form>
  );
}
