'use client';

import { useEffect } from 'react';
import { ChatBubbleLeftRightIcon, EnvelopeIcon, GlobeAltIcon, MegaphoneIcon, PhoneIcon } from '@heroicons/react/24/outline';
import { recordAdvertisementAnalyticsEvent } from '@/lib/analytics-api';
import { whatsappLink } from '@/lib/contact';
import { resolveImageUrl } from '@/lib/images';
import { ContactLink } from './ContactLink';
import { SafeImage } from './SafeImage';
import type { Advertisement } from '@/lib/types';

// A compact "Sponsored" card — clearly labeled as an ad per platform best
// practice (Instagram/Facebook Marketplace-style transparency: a viewer
// should never mistake a paid placement for organic catalog content).
// Fires a "view" impression once per mount; the primary CTA (WhatsApp is
// preferred — the dominant contact channel in this market, same priority
// order as PlaceKeyFacts) fires "contact_click" via ContactLink.
export function AdvertisementCard({ ad }: { ad: Advertisement }) {
  useEffect(() => {
    recordAdvertisementAnalyticsEvent(ad.id, 'view');
  }, [ad.id]);

  const cover = ad.images[0] ? resolveImageUrl(ad.images[0]) : null;
  const primaryClass =
    'inline-flex items-center gap-1.5 rounded-full bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-emerald-700';
  const secondaryClass =
    'inline-flex items-center gap-1.5 rounded-full border border-slate-300 dark:border-slate-700 px-3 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-200 transition-colors hover:border-brand-500 hover:bg-brand-50 dark:hover:bg-brand-950/30';

  return (
    <div className="flex flex-col overflow-hidden rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-card">
      <div className="h-28 overflow-hidden">
        <SafeImage
          src={cover}
          alt=""
          className="h-28 w-full object-cover"
          fallback={
            <div aria-hidden className="flex h-28 items-center justify-center bg-slate-100 dark:bg-slate-800">
              <MegaphoneIcon className="h-8 w-8 text-slate-400 dark:text-slate-500" />
            </div>
          }
        />
      </div>
      <div className="flex flex-1 flex-col gap-1.5 p-3">
        <span className="w-fit rounded-full bg-slate-900/80 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white dark:bg-slate-100/90 dark:text-slate-900">
          Sponsored
        </span>
        <h3 className="font-display font-semibold leading-snug text-slate-900 dark:text-slate-50">{ad.title}</h3>
        <p className="line-clamp-2 text-sm text-slate-600 dark:text-slate-300">{ad.description}</p>
        {ad.priceLabel && <p className="text-sm font-medium text-brand-700 dark:text-brand-300">{ad.priceLabel}</p>}
        <div className="mt-auto flex flex-wrap gap-1.5 pt-1">
          {ad.contactWhatsapp && (
            <ContactLink
              advertisementId={ad.id}
              href={whatsappLink(ad.contactWhatsapp)}
              target="_blank"
              rel="noopener noreferrer"
              className={primaryClass}
            >
              <ChatBubbleLeftRightIcon aria-hidden className="h-3.5 w-3.5" />
              WhatsApp
            </ContactLink>
          )}
          {ad.contactPhone && (
            <ContactLink advertisementId={ad.id} href={`tel:${ad.contactPhone}`} className={secondaryClass}>
              <PhoneIcon aria-hidden className="h-3.5 w-3.5" />
              Call
            </ContactLink>
          )}
          {ad.contactEmail && (
            <ContactLink advertisementId={ad.id} href={`mailto:${ad.contactEmail}`} className={secondaryClass}>
              <EnvelopeIcon aria-hidden className="h-3.5 w-3.5" />
              Email
            </ContactLink>
          )}
          {ad.externalLink && (
            <ContactLink
              advertisementId={ad.id}
              href={ad.externalLink}
              target="_blank"
              rel="noopener noreferrer"
              className={secondaryClass}
            >
              <GlobeAltIcon aria-hidden className="h-3.5 w-3.5" />
              Learn more
            </ContactLink>
          )}
        </div>
      </div>
    </div>
  );
}
