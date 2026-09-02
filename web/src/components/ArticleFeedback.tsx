'use client';

import { useState } from 'react';
import { HandThumbDownIcon, HandThumbUpIcon } from '@heroicons/react/24/outline';
import { submitArticleFeedback } from '@/lib/help-center-api';

// "Was this article helpful?" — anonymous, one-tap, no login required
// (see ArticleFeedback entity's doc comment on the backend for why votes
// aren't deduped server-side). A localStorage flag just keeps the buttons
// from re-firing on this device after a vote — a UX nicety, not something
// the server enforces or relies on.
export function ArticleFeedback({ articleId }: { articleId: string }) {
  const storageKey = `l360-article-feedback-${articleId}`;
  const [voted, setVoted] = useState<boolean | null>(() => {
    if (typeof window === 'undefined') return null;
    try {
      const stored = window.localStorage.getItem(storageKey);
      return stored === 'yes' ? true : stored === 'no' ? false : null;
    } catch {
      return null;
    }
  });
  const [submitting, setSubmitting] = useState(false);

  async function vote(helpful: boolean) {
    if (submitting || voted !== null) return;
    setSubmitting(true);
    try {
      await submitArticleFeedback(articleId, helpful);
      setVoted(helpful);
      try {
        window.localStorage.setItem(storageKey, helpful ? 'yes' : 'no');
      } catch {
        // Best-effort only — a private window or blocked storage just
        // means the buttons could fire again next visit, which is fine.
      }
    } catch {
      // Silently ignore — this is a lightweight signal, not something
      // worth interrupting the reader over.
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex flex-col items-start gap-2 border-t border-slate-200 pt-4 dark:border-slate-800">
      <p className="text-sm font-medium text-slate-700 dark:text-slate-200">Was this article helpful?</p>
      {voted !== null ? (
        <p className="text-sm text-emerald-700 dark:text-emerald-300">Thanks for the feedback!</p>
      ) : (
        <div className="flex gap-2">
          <button
            type="button"
            disabled={submitting}
            onClick={() => vote(true)}
            className="button-secondary min-h-9 px-4 py-1.5 text-xs"
          >
            <HandThumbUpIcon aria-hidden className="h-4 w-4" />
            Yes
          </button>
          <button
            type="button"
            disabled={submitting}
            onClick={() => vote(false)}
            className="button-secondary min-h-9 px-4 py-1.5 text-xs"
          >
            <HandThumbDownIcon aria-hidden className="h-4 w-4" />
            No
          </button>
        </div>
      )}
    </div>
  );
}
