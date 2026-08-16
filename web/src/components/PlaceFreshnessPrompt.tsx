'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { getMyFreshnessReport, reportFreshness } from '@/lib/freshness-api';
import type { FreshnessResponse, PlaceFreshnessReport } from '@/lib/types';

// Waze-style "is this still here?" crowdsourced signal — a catalog this
// size can't be manually re-verified by admins alone. Deliberately
// low-friction (one tap, no form) and silent for logged-out visitors
// rather than one more "log in to..." nag on an already busy page.
// Enough independent "no longer here" reports surface the place in the
// admin moderation queue (see api/src/admin/admin.service.ts).
export function PlaceFreshnessPrompt({ placeId }: { placeId: string }) {
  const { user, token, ready } = useAuth();
  const [existing, setExisting] = useState<PlaceFreshnessReport | null | undefined>(undefined);
  const [submitting, setSubmitting] = useState<FreshnessResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    getMyFreshnessReport(token, placeId)
      .then(setExisting)
      .catch(() => setExisting(null));
  }, [token, placeId]);

  async function handleSubmit(response: FreshnessResponse) {
    if (!token) return;
    setSubmitting(response);
    setError(null);
    try {
      const report = await reportFreshness(token, { placeId, response });
      setExisting(report);
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setSubmitting(null);
    }
  }

  if (!ready || !user) return null;

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm">
      {existing === undefined ? (
        <span className="text-slate-400">Checking…</span>
      ) : existing ? (
        <>
          <span className="text-slate-600">
            {existing.response === 'still_here'
              ? '✓ You confirmed this place is still here.'
              : 'You reported this place is no longer here.'}
          </span>
          <button
            type="button"
            onClick={() => setExisting(null)}
            className="font-medium text-brand-700 hover:underline"
          >
            Change
          </button>
        </>
      ) : (
        <>
          <span className="text-slate-700">Is this place still here?</span>
          <button
            type="button"
            disabled={submitting !== null}
            onClick={() => handleSubmit('still_here')}
            className="rounded-full border border-slate-300 px-3 py-1 text-xs font-medium text-slate-700 hover:border-brand-500 disabled:opacity-60"
          >
            {submitting === 'still_here' ? '…' : 'Yes'}
          </button>
          <button
            type="button"
            disabled={submitting !== null}
            onClick={() => handleSubmit('no_longer_here')}
            className="rounded-full border border-slate-300 px-3 py-1 text-xs font-medium text-slate-700 hover:border-flag-500 disabled:opacity-60"
          >
            {submitting === 'no_longer_here' ? '…' : 'No'}
          </button>
        </>
      )}
      {error && <span className="text-flag-700">{error}</span>}
    </div>
  );
}
