'use client';

import Link from 'next/link';
import { ChatBubbleLeftRightIcon, MegaphoneIcon, PhoneIcon, XMarkIcon } from '@heroicons/react/24/outline';
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
      className="group relative h-56 w-[85%] shrink-0 snap-center overflow-hidden rounded-2xl shadow-card transition-all duration-300 hover:-translate-y-0.5 hover:shadow-card-hover sm:h-64 sm:w-96"
    >
      <Link href={`/ads/${ad.id}`} className="absolute inset-0 block">
        <SafeImage
          src={cover}
          alt=""
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
        <div aria-hidden className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/10 to-black/40" />
        <div className="absolute inset-x-0 bottom-0 flex flex-col gap-1 p-4 pr-24 text-white">
          <span className="w-fit rounded-full bg-white/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide backdrop-blur-sm">
            Sponsored
          </span>
          <h3 className="line-clamp-2 font-display text-lg font-bold leading-tight">{ad.title}</h3>
          <span className="mt-0.5 text-xs font-semibold text-white/85 group-hover:text-white">See more →</span>
        </div>
      </Link>

      <button
        type="button"
        onClick={onDismiss}
        aria-label="Dismiss this ad"
        className="absolute right-3 top-3 z-10 flex h-7 w-7 items-center justify-center rounded-full bg-black/30 text-white backdrop-blur-sm transition-colors hover:bg-black/50"
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
