'use client';

import Link from 'next/link';
import {
  PhoneIcon,
  ChatBubbleLeftRightIcon,
  GlobeAltIcon,
  ClockIcon,
  PaperAirplaneIcon,
} from '@heroicons/react/24/outline';
import { directionsLink, whatsappLink } from '@/lib/contact';
import { formatCost } from '@/lib/format';
import { ContactLink } from './ContactLink';
import { SaveButton } from './SaveButton';
import { ReportButton } from './ReportButton';
import type { Business, Place } from '@/lib/types';

// Product review readout (Aug 22, 2026), "Turn place pages into action
// pages": the practical facts a visitor actually needs — phone, website,
// hours, price, directions — used to be scattered across sections below
// the fold, several not shown at all (Place.website/openingHours weren't
// rendered anywhere). This panel surfaces them all together right under
// the title, with one unmistakable primary action instead of a wall of
// equally-weighted buttons.
//
// A claimed Business's own contact/hours/price take priority over the
// Place's — the owner actively maintains those, the Place's copy of the
// same fields is often just whatever was true when the place was first
// cataloged.
export function PlaceKeyFacts({ place, business }: { place: Place; business: Business | null }) {
  const phone = business?.phone ?? place.contactPhone;
  const whatsapp = business?.whatsapp ?? place.whatsapp;
  const website = business?.website ?? place.website;
  const hours = business?.openingHours ?? place.openingHours;
  const priceLabel = formatKeyFactsPrice(place, business);
  const isClaimed = business != null;

  // Priority order for the one action that gets the prominent treatment —
  // WhatsApp and phone convert best for a real human on the other end;
  // Directions is the fallback every place has (lat/lng is required data),
  // so it's never a dead end even when nothing else is on file.
  type Primary = 'whatsapp' | 'call' | 'website' | 'directions';
  const primary: Primary = whatsapp ? 'whatsapp' : phone ? 'call' : website ? 'website' : 'directions';

  const primaryClass =
    'inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-semibold transition-colors';
  const secondaryClass =
    'inline-flex items-center gap-1.5 rounded-full border border-slate-300 dark:border-slate-700 px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-200 transition-colors hover:border-brand-500 hover:bg-brand-50 dark:hover:bg-brand-950/30';

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-slate-200 dark:border-slate-800 p-3">
      <div className="flex flex-wrap gap-2">
        {whatsapp && (
          <ContactLink
            placeId={place.id}
            href={whatsappLink(whatsapp)}
            target="_blank"
            rel="noopener noreferrer"
            className={primary === 'whatsapp' ? `${primaryClass} bg-emerald-600 text-white hover:bg-emerald-700` : secondaryClass}
          >
            <ChatBubbleLeftRightIcon aria-hidden className="h-4 w-4" />
            WhatsApp
          </ContactLink>
        )}
        {phone && (
          <ContactLink
            placeId={place.id}
            href={`tel:${phone}`}
            className={primary === 'call' ? `${primaryClass} bg-brand-700 text-white hover:bg-brand-800` : secondaryClass}
          >
            <PhoneIcon aria-hidden className="h-4 w-4" />
            Call
          </ContactLink>
        )}
        {website && (
          <ContactLink
            placeId={place.id}
            href={website}
            target="_blank"
            rel="noopener noreferrer"
            className={primary === 'website' ? `${primaryClass} bg-brand-700 text-white hover:bg-brand-800` : secondaryClass}
          >
            <GlobeAltIcon aria-hidden className="h-4 w-4" />
            Website
          </ContactLink>
        )}
        <a
          href={directionsLink(place.latitude, place.longitude)}
          target="_blank"
          rel="noopener noreferrer"
          className={primary === 'directions' ? `${primaryClass} bg-brand-700 text-white hover:bg-brand-800` : secondaryClass}
        >
          <PaperAirplaneIcon aria-hidden className="h-4 w-4 -rotate-45" />
          Directions
        </a>
        <SaveButton slug={place.slug} placeId={place.id} />
      </div>

      <dl className="grid grid-cols-1 gap-2 text-sm sm:grid-cols-2">
        <div className="flex items-start gap-1.5">
          <ClockIcon aria-hidden className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
          {hours ? (
            <dd className="text-slate-700 dark:text-slate-200">{hours}</dd>
          ) : (
            <MissingFact label="Hours not listed" isClaimed={isClaimed} business={business} />
          )}
        </div>
        <div className="flex items-start gap-1.5">
          <dt className="sr-only">Price</dt>
          {priceLabel ? (
            <dd className="text-slate-700 dark:text-slate-200">{priceLabel}</dd>
          ) : (
            <MissingFact label="Price not listed" isClaimed={isClaimed} business={business} />
          )}
        </div>
      </dl>

      {!phone && !whatsapp && !website && (
        <div className="border-t border-slate-100 pt-2 text-sm dark:border-slate-800">
          <MissingFact label="No verified contact on file yet" isClaimed={isClaimed} business={business} />
        </div>
      )}
    </div>
  );
}

// A missing fact never dead-ends on a bare "Not listed" — either point at
// the concrete action that would fix it (claim the place, or flag it to
// the owner who already claimed it) or, at minimum, set the expectation
// that the visitor should confirm by contacting directly.
function MissingFact({ label, isClaimed, business }: { label: string; isClaimed: boolean; business: Business | null }) {
  return (
    <span className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-slate-500 dark:text-slate-400">
      <span>{label}.</span>
      {isClaimed && business ? (
        <ReportButton targetType="business" targetId={business.id} label="Suggest an update" />
      ) : (
        <>
          <span>Own this place?</span>
          <Link href="#claim" className="font-medium text-brand-700 dark:text-brand-300 hover:underline">
            Claim it
          </Link>
          <span>or call ahead to verify.</span>
        </>
      )}
    </span>
  );
}

function formatKeyFactsPrice(place: Place, business: Business | null): string | null {
  if (business?.priceRangeMin != null || business?.priceRangeMax != null) {
    const min = formatCost(business.priceRangeMin);
    const max = business.priceRangeMax != null ? formatCost(business.priceRangeMax) : null;
    return max ? `${min} – ${max}` : min;
  }
  if (place.estimatedCostEntry != null) {
    return `${formatCost(place.estimatedCostEntry)} entry`;
  }
  return null;
}
