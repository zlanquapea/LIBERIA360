'use client';

import Link from 'next/link';
import { MegaphoneIcon, XMarkIcon } from '@heroicons/react/24/outline';
import { resolveImageUrl } from '@/lib/images';
import { SafeImage } from './SafeImage';
import type { Advertisement } from '@/lib/types';

// One carousel card for a single sponsored ad — the entire (uncropped)
// image on the left (object-contain, letterboxed on a neutral background,
// not the cropped object-cover thumbnail AdvertisementBannerRow used),
// title + a short blurb on the right, and a "See more" affordance that's
// really the whole card: clicking anywhere on it (other than the dismiss
// X) opens the ad's own /ads/[id] detail page with its full description,
// every photo, and every contact method. This card intentionally doesn't
// carry AdvertisementBannerRow's inline contact CTAs — no room at
// carousel-card width, and the detail page is now the place for those.
//
// The dismiss button lives as a SIBLING of the <Link>, both inside this
// `relative` wrapper, rather than nested inside it — a <button> nested
// inside an <a> is invalid HTML, and keeping them siblings avoids needing
// stopPropagation/preventDefault gymnastics to keep a dismiss click from
// also navigating to the detail page.
export function AdvertisementCard({ ad, onDismiss }: { ad: Advertisement; onDismiss: () => void }) {
  const cover = ad.images[0] ? resolveImageUrl(ad.images[0]) : null;

  return (
    <div className="relative w-72 shrink-0 overflow-hidden rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-card sm:w-80">
      <button
        type="button"
        onClick={onDismiss}
        aria-label="Dismiss this ad"
        className="absolute right-2 top-2 z-10 flex h-6 w-6 items-center justify-center rounded-full bg-white/90 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700 dark:bg-slate-900/90 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200"
      >
        <XMarkIcon aria-hidden className="h-4 w-4" />
      </button>
      <Link href={`/ads/${ad.id}`} className="flex h-40 gap-3 p-3">
        <div className="flex h-full w-28 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-slate-100 dark:bg-slate-800">
          <SafeImage
            src={cover}
            alt=""
            className="h-full w-full object-contain"
            fallback={<MegaphoneIcon aria-hidden className="h-8 w-8 text-slate-400 dark:text-slate-500" />}
          />
        </div>
        <div className="flex min-w-0 flex-1 flex-col gap-1 pr-5">
          <span className="w-fit rounded-full bg-slate-900/80 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white dark:bg-slate-100/90 dark:text-slate-900">
            Sponsored
          </span>
          <h3 className="line-clamp-2 font-display font-semibold leading-snug text-slate-900 dark:text-slate-50">
            {ad.title}
          </h3>
          <p className="line-clamp-2 text-sm text-slate-600 dark:text-slate-300">{ad.description}</p>
          {ad.priceLabel && <p className="text-sm font-medium text-brand-700 dark:text-brand-300">{ad.priceLabel}</p>}
          <span className="mt-auto text-xs font-semibold text-brand-700 dark:text-brand-300">See more →</span>
        </div>
      </Link>
    </div>
  );
}
