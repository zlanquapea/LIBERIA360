'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { FlagIcon } from '@heroicons/react/24/outline';
import { useAuth } from '@/hooks/useAuth';
import { reportContent } from '@/lib/reports-api';
import { HttpError } from '@/lib/http';
import type { ReportReason, ReportTargetType } from '@/lib/types';

const REASON_OPTIONS: { value: ReportReason; label: string }[] = [
  { value: 'incorrect_info', label: 'Incorrect or outdated details' },
  { value: 'spam', label: 'Spam' },
  { value: 'inappropriate', label: 'Inappropriate content' },
  { value: 'fake', label: "Fake / doesn't seem real" },
  { value: 'fraudulent', label: 'Fraudulent' },
  { value: 'misleading_offer', label: 'Misleading offer' },
  { value: 'copyright', label: 'Copyright violation' },
  { value: 'other', label: 'Other' },
];

// Small "report this" affordance — originally reviews and events (the two
// free-text fields any logged-in user can post without an ownership
// check), now also businesses (fraudulent/misleading claims a listing
// makes about itself). Signed out visitors see nothing — reporting
// requires an account so the API can enforce one report per user per
// target. Reports feed the admin moderation queue's "Flagged content"
// section once enough independent users flag the same thing (see
// api/README.md).
export function ReportButton({
  targetType,
  targetId,
  label = 'Report',
}: {
  targetType: ReportTargetType;
  targetId: string;
  /** Overrides the trigger button's text — e.g. "Suggest an update" when
   * this is embedded as the recovery action for a missing fact rather than
   * a flag-for-moderation control. Submission behavior is unchanged either
   * way (still lands in the same admin flagged-content queue). */
  label?: string;
}) {
  const { user, token } = useAuth();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  // A place report is almost always "these details are wrong".
  const [reason, setReason] = useState<ReportReason>(targetType === 'place' ? 'incorrect_info' : 'spam');
  const [details, setDetails] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reported, setReported] = useState(false);

  if (!user) {
    // Wrong details are worth hearing about from anyone, so a place's
    // report link stays visible and asks for a log-in first.
    if (targetType !== 'place') return null;
    return (
      <Link
        href={`/login?next=${encodeURIComponent(pathname ?? '/')}`}
        className="flex items-center gap-1 text-xs text-slate-500 underline-offset-2 hover:text-flag-700 hover:underline dark:text-slate-400 dark:hover:text-flag-300"
      >
        <FlagIcon aria-hidden className="h-3 w-3" />
        {label}
      </Link>
    );
  }

  if (reported) {
    return <span className="text-xs text-slate-400 dark:text-slate-400">Thanks — sent to the team.</span>;
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
        className="flex items-center gap-1 text-xs text-slate-400 dark:text-slate-400 underline-offset-2 hover:text-flag-700 dark:hover:text-flag-300 hover:underline"
      >
        <FlagIcon aria-hidden className="h-3 w-3" />
        {label}
      </button>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-col gap-2 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800 p-2 text-xs"
    >
      <select
        aria-label="Report reason"
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
        placeholder={
          targetType === 'place'
            ? 'What’s wrong? e.g. new opening hours, phone no longer works'
            : 'Add details (optional)'
        }
        className="rounded border border-slate-300 dark:border-slate-700 px-2 py-1 outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
      />
      {error && (
        <p role="alert" className="text-flag-700 dark:text-flag-300">
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
