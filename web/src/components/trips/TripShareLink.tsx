'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { LinkIcon } from '@heroicons/react/24/outline';
import { createShareLink, revokeShareLink } from '@/lib/itinerary-api';
import { HttpError } from '@/lib/http';

// A view-only link to the plan. The owner turns it on, copies it, and can
// replace or turn it off at any time; collaborators can copy an active
// link. Opening it shows the plan only — no people, chat or invitations.
export function TripShareLink({
  itineraryId,
  shareToken,
  isOwner,
  token,
  onChange,
}: {
  itineraryId: string;
  shareToken: string | null;
  isOwner: boolean;
  token: string | null;
  onChange: () => void;
}) {
  const t = useTranslations('trips');
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (!shareToken && !isOwner) return null;
  const url = shareToken && typeof window !== 'undefined' ? `${window.location.origin}/trips/shared/${shareToken}` : null;

  async function run(action: () => Promise<unknown>) {
    if (!token) return;
    setBusy(true);
    setError(null);
    try {
      await action();
      onChange();
    } catch (err) {
      setError(err instanceof HttpError ? err.message : t('shareLinkError'));
    } finally {
      setBusy(false);
    }
  }

  async function copy() {
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard blocked: the link stays selectable in the field.
    }
  }

  return (
    <section aria-labelledby="share-link" className="flex flex-col gap-2 rounded-2xl border border-slate-200 p-4 dark:border-slate-800">
      <h2 id="share-link" className="flex items-center gap-2 font-semibold text-slate-900 dark:text-slate-50">
        <LinkIcon aria-hidden className="h-5 w-5" />
        {t('shareLinkTitle')}
      </h2>
      <p className="text-sm text-slate-600 dark:text-slate-300">{t('shareLinkBody')}</p>
      {url ? (
        <>
          <div className="flex gap-2">
            <input
              readOnly
              value={url}
              aria-label={t('shareLinkTitle')}
              onFocus={(e) => e.currentTarget.select()}
              className="min-h-11 min-w-0 flex-1 rounded-xl border border-slate-300 bg-slate-50 px-3 text-sm text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
            />
            <button type="button" onClick={copy} className="min-h-11 shrink-0 rounded-full bg-brand-700 px-4 text-sm font-semibold text-white hover:bg-brand-800">
              {copied ? t('copied') : t('copyLink')}
            </button>
          </div>
          {isOwner && (
            <div className="flex flex-wrap gap-3 text-sm">
              <button type="button" disabled={busy} onClick={() => run(() => createShareLink(token!, itineraryId))} className="font-semibold text-brand-700 hover:underline disabled:opacity-60 dark:text-brand-300">
                {t('replaceLink')}
              </button>
              <button type="button" disabled={busy} onClick={() => run(() => revokeShareLink(token!, itineraryId))} className="font-semibold text-flag-700 hover:underline disabled:opacity-60 dark:text-flag-300">
                {t('turnOffLink')}
              </button>
            </div>
          )}
        </>
      ) : (
        <button
          type="button"
          disabled={busy}
          onClick={() => run(() => createShareLink(token!, itineraryId))}
          className="min-h-11 self-start rounded-full border border-brand-700 px-4 text-sm font-semibold text-brand-800 hover:bg-brand-50 disabled:opacity-60 dark:border-brand-400 dark:text-brand-200 dark:hover:bg-brand-950/30"
        >
          {t('createLink')}
        </button>
      )}
      {error && (
        <p role="alert" className="text-sm text-flag-700 dark:text-flag-300">
          {error}
        </p>
      )}
    </section>
  );
}
