'use client';

import Link from 'next/link';
import { ArrowRightIcon, ChatBubbleLeftRightIcon, MegaphoneIcon, PhoneIcon, XMarkIcon } from '@heroicons/react/24/outline';
import { resolveImageUrl } from '@/lib/images';
import { whatsappLink } from '@/lib/contact';
import { ContactLink } from './ContactLink';
import { SafeImage } from './SafeImage';
import type { Advertisement } from '@/lib/types';

// One slide in the Sponsored carousel — full-bleed cover image with every
// detail overlaid on a bottom gradient, the same treatment
// FeaturedDestinationCard uses for the hero banner right below this one on
// Home. The previous layout boxed the photo into a small letterboxed
// thumbnail next to a separate padded text block — a lot of card area
// doing nothing. Going full-bleed puts the whole card to work and reads as
// one deliberate visual system with the banner beneath it, rather than two
// differently-built cards stacked on the same page.
//
// The dismiss button and both ContactLinks are SIBLINGS of the <Link>
// (which covers the rest of the slide, image included), not nested inside
// it — a <button> or <a> nested inside an <a> is invalid HTML. They sit on
// top of the Link with a higher stacking order, so a tap on one of them
// never also triggers the Link's navigation underneath.
export function AdvertisementCard({
  ad,
  onDismiss,
  cardRef,
}: {
  ad: Advertisement;
  onDismiss: () => void;
  cardRef?: (el: HTMLDivElement | null) => void;
}) {
  const cover = ad.images[0] ? resolveImageUrl(ad.images[0]) : null;
  const hasContact = Boolean(ad.contactWhatsapp || ad.contactPhone);

  return (
    <div
      ref={cardRef}
      className="group relative flex min-w-0 flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-card transition hover:border-brand-300 hover:shadow-card-hover lg:hover:-translate-y-0.5 dark:border-slate-800 dark:bg-slate-900 dark:hover:border-brand-600"
    >
      <Link href={`/ads/${ad.id}`} className="flex h-full flex-col focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-500" aria-label={`${ad.title}, sponsored advertisement`}>
        <div className="relative aspect-[4/3] overflow-hidden bg-slate-200 dark:bg-slate-800 lg:aspect-[16/10]">
        <SafeImage
          src={cover}
          alt={cover ? ad.title : ''}
          className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
          fallback={
            <div
              aria-hidden
              className="flex h-full w-full items-center justify-center bg-gradient-to-br from-slate-700 to-slate-900"
            >
              <MegaphoneIcon aria-hidden className="h-12 w-12 text-white/60" />
            </div>
          }
        />
        <span className="absolute left-3 top-3 rounded-full bg-slate-950/80 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.12em] text-white backdrop-blur-sm">
            Sponsored
        </span>
        </div>
        <div className="flex flex-1 flex-col gap-2 p-4 pb-16">
          <div className="flex items-start justify-between gap-2">
            <h3 className="line-clamp-2 font-display text-lg font-bold leading-tight text-slate-900 dark:text-white">{ad.title}</h3>
            {ad.priceLabel && <span className="shrink-0 rounded-full bg-gold-50 px-2 py-1 text-xs font-bold text-gold-600 dark:bg-gold-950 dark:text-gold-300">{ad.priceLabel}</span>}
          </div>
          {ad.description && <p className="line-clamp-2 text-sm leading-5 text-slate-600 dark:text-slate-300">{ad.description}</p>}
          <span className="mt-auto inline-flex items-center gap-1 pt-1 text-sm font-bold text-brand-700 dark:text-brand-300">
            Learn more <ArrowRightIcon aria-hidden className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
          </span>
        </div>
      </Link>

      <button
        type="button"
        onClick={onDismiss}
        aria-label="Dismiss this ad"
        className="absolute right-3 top-3 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-slate-950/75 text-white backdrop-blur-sm transition-colors hover:bg-slate-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
      >
        <XMarkIcon aria-hidden className="h-4 w-4" />
      </button>

      {hasContact && (
        <div className="absolute bottom-4 right-4 z-10 flex items-center gap-2">
          {ad.contactWhatsapp && (
            <ContactLink
              advertisementId={ad.id}
              href={whatsappLink(ad.contactWhatsapp)}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Message on WhatsApp"
              className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-600 text-white shadow-md transition-colors hover:bg-emerald-700"
            >
              <ChatBubbleLeftRightIcon aria-hidden className="h-4 w-4" />
            </ContactLink>
          )}
          {ad.contactPhone && (
            <ContactLink
              advertisementId={ad.id}
              href={`tel:${ad.contactPhone}`}
              aria-label="Call"
              className="flex h-9 w-9 items-center justify-center rounded-full bg-white/90 text-slate-900 shadow-md backdrop-blur-sm transition-colors hover:bg-white"
            >
              <PhoneIcon aria-hidden className="h-4 w-4" />
            </ContactLink>
          )}
        </div>
      )}
    </div>
  );
}
