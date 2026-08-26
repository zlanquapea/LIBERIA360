'use client';

import { useState } from 'react';
import { resolveImageUrl } from '@/lib/images';
import { SafeImage } from './SafeImage';
import type { Advertisement } from '@/lib/types';

// Full, untruncated ad contents for an admin to read before approving —
// every photo (not just images[0]), the complete description (not
// line-clamp-2), and every contact method as plain text. Collapsed by
// default so the compact moderation queue/list isn't already this dense;
// an admin opens it deliberately before deciding. This is explicitly a
// harm-reduction step — approving without ever having seen the full ad
// content shouldn't be possible — not just a UX nicety.
export function AdvertisementFullDetails({ ad }: { ad: Advertisement }) {
  const [open, setOpen] = useState(false);

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="text-xs font-semibold text-brand-700 dark:text-brand-300 hover:underline"
      >
        {open ? 'Hide full details' : 'Read full ad before deciding →'}
      </button>
      {open && (
        <div className="mt-2 flex flex-col gap-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-3">
          {ad.images.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {ad.images.map((img) => (
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
          <p className="whitespace-pre-wrap text-sm text-slate-700 dark:text-slate-200">{ad.description}</p>
          <dl className="grid grid-cols-1 gap-x-4 gap-y-1 text-xs text-slate-500 dark:text-slate-400 sm:grid-cols-2">
            {ad.priceLabel && (
              <div>
                <dt className="inline font-semibold">Price: </dt>
                <dd className="inline">{ad.priceLabel}</dd>
              </div>
            )}
            {ad.contactPhone && (
              <div>
                <dt className="inline font-semibold">Phone: </dt>
                <dd className="inline">{ad.contactPhone}</dd>
              </div>
            )}
            {ad.contactWhatsapp && (
              <div>
                <dt className="inline font-semibold">WhatsApp: </dt>
                <dd className="inline">{ad.contactWhatsapp}</dd>
              </div>
            )}
            {ad.contactEmail && (
              <div>
                <dt className="inline font-semibold">Email: </dt>
                <dd className="inline">{ad.contactEmail}</dd>
              </div>
            )}
            {ad.externalLink && (
              <div className="sm:col-span-2">
                <dt className="inline font-semibold">Link: </dt>
                <dd className="inline break-all">{ad.externalLink}</dd>
              </div>
            )}
          </dl>
        </div>
      )}
    </div>
  );
}
