'use client';

import Link from 'next/link';
import { ChatBubbleLeftRightIcon, MegaphoneIcon, PhoneIcon, XMarkIcon } from '@heroicons/react/24/outline';
import { resolveImageUrl } from '@/lib/images';
import { whatsappLink } from '@/lib/contact';
import { ContactLink } from './ContactLink';
import { SafeImage } from './SafeImage';
import type { Advertisement } from '@/lib/types';

// One carousel card for a single sponsored ad — laid out top-image /
// bottom-content, the same structure PlaceCard/PlaceCardCompact use
// elsewhere on Home, rather than the old side-by-side image+fixed-height
// split. That split squeezed the title into a narrow column next to a
// fixed h-40 image and let a two-line title collide with the text below
// it; a full-width image on top followed by a content block that's free
// to grow gives the title room to wrap onto two lines without touching
// anything else.
//
// No description or price here — full details live on the ad's own
// /ads/[id] page (via "See more"). What the card surfaces instead is a
// direct way to reach the advertiser: WhatsApp and Call, the same two
// contact methods and styling the detail page leads with.
//
// The dismiss button and both ContactLinks are SIBLINGS of the <Link>,
// not nested inside it — a <button> or <a> nested inside an <a> is
// invalid HTML, and keeping them siblings avoids stopPropagation
// gymnastics to stop a click on one from also navigating to the detail
// page via the other.
export function AdvertisementCard({ ad, onDismiss }: { ad: Advertisement; onDismiss: () => void }) {
  const cover = ad.images[0] ? resolveImageUrl(ad.images[0]) : null;
  const hasContact = Boolean(ad.contactWhatsapp || ad.contactPhone);

  return (
    <div className="relative flex w-64 shrink-0 flex-col overflow-hidden rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-card sm:w-72">
      <button
        type="button"
        onClick={onDismiss}
        aria-label="Dismiss this ad"
        className="absolute right-2 top-2 z-10 flex h-6 w-6 items-center justify-center rounded-full bg-white/90 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700 dark:bg-slate-900/90 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200"
      >
        <XMarkIcon aria-hidden className="h-4 w-4" />
      </button>
      <Link href={`/ads/${ad.id}`} className="flex flex-col">
        <div className="flex h-32 items-center justify-center overflow-hidden bg-slate-100 dark:bg-slate-800">
          <SafeImage
            src={cover}
            alt=""
            className="h-full w-full object-contain"
            fallback={<MegaphoneIcon aria-hidden className="h-8 w-8 text-slate-400 dark:text-slate-500" />}
          />
        </div>
        <div className="flex flex-col gap-1.5 p-3">
          <span className="w-fit rounded-full bg-slate-900/80 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white dark:bg-slate-100/90 dark:text-slate-900">
            Sponsored
          </span>
          <h3 className="line-clamp-2 min-h-[2.5em] font-display text-sm font-semibold leading-snug text-slate-900 dark:text-slate-50">
            {ad.title}
          </h3>
          <span className="text-xs font-semibold text-brand-700 dark:text-brand-300">See more →</span>
        </div>
      </Link>
      {hasContact && (
        <div className="flex items-center gap-2 border-t border-slate-100 p-3 pt-2.5 dark:border-slate-800">
          {ad.contactWhatsapp && (
            <ContactLink
              advertisementId={ad.id}
              href={whatsappLink(ad.contactWhatsapp)}
              target="_blank"
              rel="noopener noreferrer"
              className="flex flex-1 items-center justify-center gap-1 rounded-full bg-emerald-600 px-2 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-emerald-700"
            >
              <ChatBubbleLeftRightIcon aria-hidden className="h-3.5 w-3.5" />
              WhatsApp
            </ContactLink>
          )}
          {ad.contactPhone && (
            <ContactLink
              advertisementId={ad.id}
              href={`tel:${ad.contactPhone}`}
              className="flex flex-1 items-center justify-center gap-1 rounded-full border border-slate-300 px-2 py-1.5 text-xs font-medium text-slate-700 transition-colors hover:border-brand-500 hover:bg-brand-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-brand-950/30"
            >
              <PhoneIcon aria-hidden className="h-3.5 w-3.5" />
              Contact
            </ContactLink>
          )}
        </div>
      )}
    </div>
  );
}
