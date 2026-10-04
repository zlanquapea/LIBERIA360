'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import {
  CalendarDaysIcon,
  ChatBubbleLeftRightIcon,
  ClockIcon,
  GlobeAltIcon,
  PaperAirplaneIcon,
  PhoneIcon,
} from '@heroicons/react/24/outline';
import { useAuth } from '@/hooks/useAuth';
import { getMyBusinesses } from '@/lib/business-api';
import { directionsLink, whatsappLink } from '@/lib/contact';
import { formatCost } from '@/lib/format';
import { LrdHint } from './LrdHint';
import { HoursStatus } from './place/HoursStatus';
import { isOpenAt } from '@/lib/opening-hours';
import { iconForAmenity } from '@/lib/amenities';
import { ContactLink } from './ContactLink';
import { SaveButton } from './SaveButton';
import { MarkVisitedButton } from './MarkVisitedButton';
import { ReportButton } from './ReportButton';
import { StickyBookingBar } from './StickyBookingBar';
import { VerificationBadge } from './VerificationBadge';
import { VerificationTrustInfo } from './VerificationTrustInfo';
import { PlaceProvenance } from './place/PlaceProvenance';
import type { Business, Place } from '@/lib/types';
import { KIND_CAPS, type PlaceKind } from '@/lib/place-kind';

// Place-profile actions and trust facts. This component deliberately keeps
// every button data-backed: directions use the required coordinates, contact
// actions appear only when a verified contact exists, and booking is a
// request-to-book flow for an approved/owner-visible business.
export function PlaceKeyFacts({ place, business, kind = 'destination' }: { place: Place; business: Business | null; kind?: PlaceKind }) {
  const caps = KIND_CAPS[kind];
  // Health and service pages already put Call/Directions/Save first in
  // their header, so this panel keeps only the listing facts there.
  const showActions = kind !== 'health' && kind !== 'service';
  const t = useTranslations('placeDetail');
  const { user, token, ready } = useAuth();
  const [ownBusiness, setOwnBusiness] = useState<Business | null>(null);

  // Match BusinessClaimSection's owner fallback so a business owner sees
  // their own newly claimed data before an admin approval is reflected in the
  // server-side public business lookup.
  useEffect(() => {
    if (business || !ready || !user || !token) return;
    let cancelled = false;
    getMyBusinesses(token).then((list) => {
      if (cancelled) return;
      const mine = list.find((candidate) => candidate.linkedPlaceId === place.id);
      if (mine) setOwnBusiness(mine);
    });
    return () => {
      cancelled = true;
    };
  }, [business, ready, user, token, place.id]);

  const effectiveBusiness = business ?? ownBusiness;
  const phone = effectiveBusiness?.phone ?? place.contactPhone;
  const whatsapp = effectiveBusiness?.whatsapp ?? place.whatsapp;
  const website = effectiveBusiness?.website ?? place.website;
  const hours = effectiveBusiness?.openingHours ?? place.openingHours;
  const priceLabel = formatKeyFactsPrice(place, effectiveBusiness);
  const priceUsd = keyFactsPriceUsd(place, effectiveBusiness);
  const amenities = effectiveBusiness?.servicesOffered ?? [];
  const isClaimed = effectiveBusiness != null;
  const verificationStatus = effectiveBusiness?.verificationStatus ?? place.verificationStatus;
  const verifiedAt = effectiveBusiness ? effectiveBusiness.verifiedAt : place.verifiedAt;

  // A business's free-text hours have no structured equivalent, so only show
  // Open now/Closed now when the displayed hours are the place's structured
  // hours. This avoids asserting a status from data the visitor cannot see.
  const openNow =
    effectiveBusiness?.openingHours == null && place.structuredHours && place.structuredHours.length > 0
      ? isOpenAt(place.structuredHours, new Date())
      : null;

  // Keep directions primary and contact and booking actions compact.
  const actionClass =
    'inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl px-2 py-2 text-sm font-semibold shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-400 focus-visible:ring-offset-2';
  const mutedActionClass =
    `${actionClass} border border-slate-200 bg-white text-slate-700 hover:border-brand-400 hover:bg-brand-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-brand-950/30`;

  return (
    <>
    <section className="flex flex-col gap-5 rounded-[2rem] border border-slate-200 bg-white p-4 shadow-card dark:border-slate-800 dark:bg-slate-900 sm:p-6">
      <h2 className="sr-only">Plan your visit</h2>
        {showActions && (
        <div className="flex flex-col gap-2">
        <a
          href={directionsLink(place.latitude, place.longitude)}
          target="_blank"
          rel="noopener noreferrer"
          className={`${actionClass} min-h-12 bg-brand-800 text-white hover:bg-brand-900`}
        >
          <PaperAirplaneIcon aria-hidden className="h-5 w-5 -rotate-45" />
          Get directions
        </a>
        <div className="grid grid-cols-2 gap-2 sm:auto-cols-fr sm:grid-flow-col sm:grid-cols-none">

        {phone ? (
          <ContactLink
            placeId={place.id}
            href={`tel:${phone}`}
            className={mutedActionClass}
          >
            <PhoneIcon aria-hidden className="h-5 w-5 text-brand-600 dark:text-brand-400" />
            Call
          </ContactLink>
        ) : (
          <a href="#claim" className={mutedActionClass} title="No phone number is listed yet.">
            <PhoneIcon aria-hidden className="h-5 w-5 text-slate-400" />
            Call
          </a>
        )}

        {whatsapp ? (
          <ContactLink
            placeId={place.id}
            href={whatsappLink(whatsapp)}
            target="_blank"
            rel="noopener noreferrer"
            className={mutedActionClass}
          >
            <ChatBubbleLeftRightIcon aria-hidden className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
            WhatsApp
          </ContactLink>
        ) : (
          <a href="#claim" className={mutedActionClass} title="No WhatsApp number is listed yet.">
            <ChatBubbleLeftRightIcon aria-hidden className="h-5 w-5 text-slate-400" />
            WhatsApp
          </a>
        )}

        {caps.booking &&
          (effectiveBusiness ? (
            <Link href={`/businesses/${effectiveBusiness.slug}/book`} className={mutedActionClass}>
              Book
            </Link>
          ) : (
            <Link
              href="#claim"
              className={mutedActionClass}
              title="Booking requests become available when a business claims this listing."
            >
              <CalendarDaysIcon aria-hidden className="h-5 w-5" />
              Book
            </Link>
          ))}



        <SaveButton
          slug={place.slug}
          placeId={place.id}
          className="min-h-11 w-full justify-center rounded-xl border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 shadow-sm hover:border-brand-400 hover:bg-brand-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-brand-950/30"
        />

        {/* A fixed slot: the button only appears once sign-in is known,
            and it mustn't shove the other buttons sideways when it does. */}
        {caps.visited && (
          <div className="min-h-11">
            <MarkVisitedButton placeId={place.id} className={mutedActionClass} />
          </div>
        )}
        </div>
      </div>
        )}

      {website && (
        <ContactLink
          placeId={place.id}
          href={website}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex min-h-10 items-center justify-center gap-2 self-start rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-brand-700 hover:border-brand-400 hover:bg-brand-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 dark:border-slate-700 dark:text-brand-300 dark:hover:bg-brand-950/30"
        >
          <GlobeAltIcon aria-hidden className="h-4 w-4" />
          Visit website
        </ContactLink>
      )}

      <div className="grid gap-4 border-t border-slate-100 pt-4 dark:border-slate-800 sm:grid-cols-[1fr_auto] sm:items-start">
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-semibold text-slate-900 dark:text-slate-50">Listing information</span>
            <VerificationBadge status={verificationStatus} />
          </div>

          {/* Health and service pages show hours in their own header and table. */}
          {showActions && (
          <dl className="grid gap-3 text-sm sm:grid-cols-2">
            <div className="flex items-start gap-2">
              <ClockIcon aria-hidden className="mt-0.5 h-4 w-4 shrink-0 text-sky-500" />
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Hours</dt>
                {hours ? (
                  <dd className="mt-0.5 text-slate-700 dark:text-slate-200">
                    {openNow != null && (
                      <span
                        className={`mr-1.5 inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-bold ${
                          openNow
                            ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300'
                            : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'
                        }`}
                      >
                        {openNow ? 'Open now' : 'Closed now'}
                      </span>
                    )}
                    {hours}
                  </dd>
                ) : place.structuredHours?.length ? (
                  <dd className="mt-1">
                    <HoursStatus hours={place.structuredHours} />
                  </dd>
                ) : (
                  <dd className="mt-0.5">
                    <MissingFact label="Hours not listed" isClaimed={isClaimed} business={effectiveBusiness} />
                  </dd>
                )}
              </div>
            </div>

            <div>
              <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Price guide</dt>
              <dd className="mt-0.5 text-slate-700 dark:text-slate-200">
                {priceLabel ? (
                  <>
                    {priceLabel}
                    {priceUsd && <LrdHint usd={priceUsd.min} usdMax={priceUsd.max} className="ms-2 text-xs" />}
                  </>
                ) : <MissingFact label="Price not listed" isClaimed={isClaimed} business={effectiveBusiness} />}
              </dd>
            </div>
          </dl>
          )}
        </div>

        {amenities.length > 0 && (
          <div className="sm:max-w-xs">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Services listed</p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {amenities.map((amenity) => {
                const Icon = iconForAmenity(amenity);
                return (
                  <span
                    key={amenity}
                    className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 text-xs text-slate-600 dark:bg-slate-800 dark:text-slate-300"
                  >
                    <Icon aria-hidden className="h-3.5 w-3.5" />
                    {amenity}
                  </span>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {!phone && !whatsapp && !website && (
        <div className="border-t border-slate-100 pt-3 text-sm dark:border-slate-800">
          <MissingFact label="No verified contact on file yet" isClaimed={isClaimed} business={effectiveBusiness} />
        </div>
      )}

      <VerificationTrustInfo status={verificationStatus} verifiedAt={verifiedAt} />

      <PlaceProvenance place={place} verificationStatus={verificationStatus} />

      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 border-t border-slate-100 pt-3 text-sm text-slate-600 dark:border-slate-800 dark:text-slate-300">
        <span>{t('somethingWrong')}</span>
        <ReportButton targetType="place" targetId={place.id} label={t('reportIncorrect')} />
      </div>
    </section>
    {effectiveBusiness && caps.booking && (
      <StickyBookingBar business={effectiveBusiness} name={place.name} />
    )}
    </>
  );
}

function MissingFact({ label, isClaimed, business }: { label: string; isClaimed: boolean; business: Business | null }) {
  return (
    <span className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-slate-500 dark:text-slate-400">
      <span>{label}.</span>
      {isClaimed && business ? (
        <ReportButton targetType="business" targetId={business.id} label="Suggest an update" />
      ) : (
        <>
          <span>Own this place?</span>
          <Link href="#claim" className="font-medium text-brand-700 hover:underline dark:text-brand-300">
            Claim it
          </Link>
          <span>or call ahead to verify.</span>
        </>
      )}
    </span>
  );
}

function keyFactsPriceUsd(place: Place, business: Business | null): { min: number | null; max: number | null } | null {
  if (business?.priceRangeMin != null || business?.priceRangeMax != null) {
    return { min: business.priceRangeMin ?? business.priceRangeMax ?? null, max: business.priceRangeMax ?? null };
  }
  if (place.estimatedCostEntry != null) return { min: place.estimatedCostEntry, max: null };
  return null;
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
