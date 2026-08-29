'use client';

import { useState } from 'react';
import { resolveImageUrl } from '@/lib/images';
import { formatCarCategory, formatCarFuelType, formatCarTransmission, formatCost } from '@/lib/format';
import { SafeImage } from './SafeImage';
import type { CarListing } from '@/lib/types';

// Full, untruncated listing contents for an admin to read before
// approving — every photo (not just images[0]), the complete
// description, every spec, and every contact method — mirrors
// AdvertisementFullDetails exactly. Collapsed by default so the compact
// pending-queue/list row isn't already this dense; an admin opens it
// deliberately before deciding. A specific car's condition/price/photos
// carry enough real-money and safety stakes that approving one sight
// unseen (which is what the compact row alone would mean) shouldn't be
// possible.
export function CarListingFullDetails({ listing }: { listing: CarListing }) {
  const [open, setOpen] = useState(false);

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="text-xs font-semibold text-brand-700 dark:text-brand-300 hover:underline"
      >
        {open ? 'Hide full details' : 'Read full listing before deciding →'}
      </button>
      {open && (
        <div className="mt-2 flex flex-col gap-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-3">
          {listing.images.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {listing.images.map((img) => (
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
          {listing.description && (
            <p className="whitespace-pre-wrap text-sm text-slate-700 dark:text-slate-200">{listing.description}</p>
          )}
          <dl className="grid grid-cols-1 gap-x-4 gap-y-1 text-xs text-slate-500 dark:text-slate-400 sm:grid-cols-2">
            <div>
              <dt className="inline font-semibold">Vehicle: </dt>
              <dd className="inline">
                {listing.year} {listing.make} {listing.model} · {formatCarCategory(listing.category)}
              </dd>
            </div>
            <div>
              <dt className="inline font-semibold">Transmission / fuel: </dt>
              <dd className="inline">
                {formatCarTransmission(listing.transmission)} · {formatCarFuelType(listing.fuelType)}
              </dd>
            </div>
            <div>
              <dt className="inline font-semibold">Seats: </dt>
              <dd className="inline">{listing.seats}</dd>
            </div>
            <div>
              <dt className="inline font-semibold">Price per day: </dt>
              <dd className="inline">{formatCost(listing.pricePerDay)}</dd>
            </div>
            <div>
              <dt className="inline font-semibold">Minimum rental: </dt>
              <dd className="inline">
                {listing.minRentalDays} day{listing.minRentalDays === 1 ? '' : 's'}
              </dd>
            </div>
            {listing.securityDeposit != null && (
              <div>
                <dt className="inline font-semibold">Security deposit: </dt>
                <dd className="inline">{formatCost(listing.securityDeposit)}</dd>
              </div>
            )}
            <div>
              <dt className="inline font-semibold">Driver: </dt>
              <dd className="inline">
                {listing.withDriverAvailable
                  ? `Available${listing.driverFeePerDay != null ? ` (+${formatCost(listing.driverFeePerDay)}/day)` : ''}`
                  : 'Self-drive only'}
              </dd>
            </div>
            {listing.pickupLocation && (
              <div>
                <dt className="inline font-semibold">Pickup: </dt>
                <dd className="inline">{listing.pickupLocation}</dd>
              </div>
            )}
            {listing.county && (
              <div>
                <dt className="inline font-semibold">County: </dt>
                <dd className="inline">{listing.county.name}</dd>
              </div>
            )}
            <div>
              <dt className="inline font-semibold">Listed by: </dt>
              <dd className="inline">
                {listing.business?.name ?? listing.owner?.name ?? 'Unknown'}
                {listing.business && listing.owner && ` (${listing.owner.name})`}
              </dd>
            </div>
            {listing.contactPhone && (
              <div>
                <dt className="inline font-semibold">Phone: </dt>
                <dd className="inline">{listing.contactPhone}</dd>
              </div>
            )}
            {listing.contactWhatsapp && (
              <div>
                <dt className="inline font-semibold">WhatsApp: </dt>
                <dd className="inline">{listing.contactWhatsapp}</dd>
              </div>
            )}
          </dl>
          {listing.features.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {listing.features.map((feature) => (
                <span
                  key={feature}
                  className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600 dark:bg-slate-800 dark:text-slate-300"
                >
                  {feature}
                </span>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
