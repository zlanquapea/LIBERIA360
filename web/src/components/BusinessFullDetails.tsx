'use client';

import { useState } from 'react';
import { resolveImageUrl } from '@/lib/images';
import { formatBusinessType, formatCost } from '@/lib/format';
import { SafeImage } from './SafeImage';
import type { Business } from '@/lib/types';

// Full, untruncated claim/profile contents for an admin to read before
// approving a business — every photo, the complete description, every
// contact method, services, and pricing — mirrors AdvertisementFullDetails
// exactly. Collapsed by default so the compact pending-queue/list row
// isn't already this dense; an admin opens it deliberately before
// deciding. Approving a business claim sight unseen (which is what the
// compact row alone would mean — just a name, type, and owner) shouldn't
// be possible.
export function BusinessFullDetails({ business }: { business: Business }) {
  const [open, setOpen] = useState(false);

  const hasPriceRange = business.priceRangeMin != null || business.priceRangeMax != null;
  const priceRange = hasPriceRange
    ? `${formatCost(business.priceRangeMin)}${business.priceRangeMax != null ? ` – ${formatCost(business.priceRangeMax)}` : ''}`
    : null;

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="text-xs font-semibold text-brand-700 dark:text-brand-300 hover:underline"
      >
        {open ? 'Hide full details' : 'Read full profile before deciding →'}
      </button>
      {open && (
        <div className="mt-2 flex flex-col gap-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-3">
          {(business.logoImage || business.images.length > 0) && (
            <div className="flex flex-wrap gap-2">
              {business.logoImage && (
                <div className="flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-slate-300 bg-slate-100 dark:border-slate-600 dark:bg-slate-800">
                  <SafeImage
                    src={resolveImageUrl(business.logoImage)}
                    alt="Logo"
                    className="h-full w-full object-contain"
                    fallback={<div aria-hidden className="h-24 w-24 bg-slate-200 dark:bg-slate-700" />}
                  />
                </div>
              )}
              {business.images.map((img) => (
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
          {business.description && (
            <p className="whitespace-pre-wrap text-sm text-slate-700 dark:text-slate-200">{business.description}</p>
          )}
          <dl className="grid grid-cols-1 gap-x-4 gap-y-1 text-xs text-slate-500 dark:text-slate-400 sm:grid-cols-2">
            <div>
              <dt className="inline font-semibold">Type: </dt>
              <dd className="inline">{formatBusinessType(business.type)}</dd>
            </div>
            <div>
              <dt className="inline font-semibold">Location: </dt>
              <dd className="inline">
                {business.linkedPlace.city}, {business.linkedPlace.county.name}
              </dd>
            </div>
            {business.phone && (
              <div>
                <dt className="inline font-semibold">Phone: </dt>
                <dd className="inline">{business.phone}</dd>
              </div>
            )}
            {business.whatsapp && (
              <div>
                <dt className="inline font-semibold">WhatsApp: </dt>
                <dd className="inline">{business.whatsapp}</dd>
              </div>
            )}
            {business.email && (
              <div>
                <dt className="inline font-semibold">Email: </dt>
                <dd className="inline">{business.email}</dd>
              </div>
            )}
            {business.website && (
              <div className="sm:col-span-2">
                <dt className="inline font-semibold">Website: </dt>
                <dd className="inline break-all">{business.website}</dd>
              </div>
            )}
            {business.openingHours && (
              <div>
                <dt className="inline font-semibold">Hours: </dt>
                <dd className="inline">{business.openingHours}</dd>
              </div>
            )}
            {priceRange && (
              <div>
                <dt className="inline font-semibold">Price range: </dt>
                <dd className="inline">{priceRange}</dd>
              </div>
            )}
            {business.socialLinks.length > 0 && (
              <div className="sm:col-span-2">
                <dt className="inline font-semibold">Social: </dt>
                <dd className="inline break-all">{business.socialLinks.join(', ')}</dd>
              </div>
            )}
          </dl>
          {business.servicesOffered.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {business.servicesOffered.map((service) => (
                <span
                  key={service}
                  className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600 dark:bg-slate-800 dark:text-slate-300"
                >
                  {service}
                </span>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
