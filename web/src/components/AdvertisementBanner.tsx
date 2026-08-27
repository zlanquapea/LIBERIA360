'use client';

import { useState } from 'react';
import { MegaphoneIcon } from '@heroicons/react/24/outline';
import { AdvertisementCard } from './AdvertisementCard';
import type { Advertisement } from '@/lib/types';

// Strategic placement wrapper — a horizontal-scroll carousel of ad cards
// (see AdvertisementCard), same shelf pattern as "Featured this week" on
// this page, rather than a vertical stack of full-width banners: with
// many advertisers running at once, a stack would make the page
// increasingly long, while a carousel scales to any number of ads without
// growing the page. Dropped between organic content sections rather than
// above the fold, so it reads as a supplement to discovery rather than
// competing with it.
//
// Each card is dismissible for the current page view only — NOT persisted
// across reloads/visits (previously written to localStorage, so a single
// dismiss hid an ad from that visitor forever). Advertisers are paying for
// impressions, and a dismissal permanently suppressing future ones for
// that visitor undercuts what they're paying for; a dismiss here just
// declutters the current view, and the ad is back the next time they load
// the page. Renders nothing once every ad on this load has either never
// existed or been dismissed (no empty "Sponsored" shelf).
export function AdvertisementBanner({ ads }: { ads: Advertisement[] }) {
  const [dismissed, setDismissed] = useState<string[]>([]);

  function dismiss(id: string) {
    setDismissed((prev) => [...prev, id]);
  }

  const visible = ads.filter((ad) => !dismissed.includes(ad.id));
  if (visible.length === 0) return null;

  return (
    <section aria-labelledby="sponsored-heading" className="flex flex-col gap-3">
      <h2
        id="sponsored-heading"
        className="flex items-center gap-1.5 font-display text-lg font-semibold text-slate-900 dark:text-slate-50"
      >
        <MegaphoneIcon aria-hidden className="h-5 w-5 text-slate-400 dark:text-slate-500" />
        Sponsored
      </h2>
      <div className="-mx-4 flex gap-4 overflow-x-auto px-4 pb-1">
        {visible.map((ad) => (
          <AdvertisementCard key={ad.id} ad={ad} onDismiss={() => dismiss(ad.id)} />
        ))}
      </div>
    </section>
  );
}
