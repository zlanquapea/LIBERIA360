'use client';

import { useState } from 'react';
import { resolveImageUrl } from '@/lib/images';
import { SafeImage } from './SafeImage';
import type { BusinessContent } from '@/lib/types';

function formatDate(iso: string | null): string | null {
  if (!iso) return null;
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

// Full, untruncated content for an admin to read before approving —
// every photo (not just images[0]), the complete body (not line-clamp-2),
// and the validity window/link — mirrors AdvertisementFullDetails
// exactly. Collapsed by default so the compact pending-queue row isn't
// already this dense; an admin opens it deliberately before deciding.
export function BusinessContentFullDetails({ content }: { content: BusinessContent }) {
  const [open, setOpen] = useState(false);
  const validFrom = formatDate(content.validFrom);
  const validUntil = formatDate(content.validUntil);

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="text-xs font-semibold text-brand-700 dark:text-brand-300 hover:underline"
      >
        {open ? 'Hide full details' : 'Read full content before deciding →'}
      </button>
      {open && (
        <div className="mt-2 flex flex-col gap-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-3">
          {content.images.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {content.images.map((img) => (
                <div
                  key={img}
                  className="flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-slate-100 dark:bg-slate-800"
                >
                  <SafeImage
                    src={resolveImageUrl(img)}
                    alt=""
                    className="h-full w-full object-contain"
                    fallback={<div aria-hidden className="h-24 w-24 bg-slate-200 dark:bg-slate-700" />}
                  />
                </div>
              ))}
            </div>
          )}
          <p className="whitespace-pre-wrap text-sm text-slate-700 dark:text-slate-200">{content.body}</p>
          {(validFrom || validUntil || content.externalLink) && (
            <dl className="grid grid-cols-1 gap-x-4 gap-y-1 text-xs text-slate-500 dark:text-slate-400 sm:grid-cols-2">
              {(validFrom || validUntil) && (
                <div>
                  <dt className="inline font-semibold">Valid: </dt>
                  <dd className="inline">
                    {validFrom ?? 'now'} – {validUntil ?? 'no end date'}
                  </dd>
                </div>
              )}
              {content.externalLink && (
                <div className="sm:col-span-2">
                  <dt className="inline font-semibold">Link: </dt>
                  <dd className="inline break-all">{content.externalLink}</dd>
                </div>
              )}
            </dl>
          )}
        </div>
      )}
    </div>
  );
}
