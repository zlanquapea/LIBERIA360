'use client';

import { useMemo, useState } from 'react';
import { MegaphoneIcon } from '@heroicons/react/24/outline';
import { AdvertisementCard } from './AdvertisementCard';
import type { Advertisement } from '@/lib/types';

/**
 * Sponsored inventory is intentionally a grid rather than a full-width hero:
 * every active ad remains discoverable without autoplay, hidden overflow, or
 * competing swipe/click gestures. Dismissal stays local to the current visit.
 */
export function AdvertisementBanner({ ads }: { ads: Advertisement[] }) {
  const [dismissed, setDismissed] = useState<string[]>([]);
  const visible = useMemo(() => ads.filter((ad) => !dismissed.includes(ad.id)), [ads, dismissed]);

  if (visible.length === 0) return null;

  return (
    <section aria-labelledby="sponsored-heading" aria-label="Sponsored advertisements" className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        <h2 id="sponsored-heading" className="flex items-center gap-1.5 font-display text-lg font-semibold text-slate-900 dark:text-slate-50">
          <MegaphoneIcon aria-hidden className="h-5 w-5 text-slate-500 dark:text-slate-400" />
          Sponsored
        </h2>
        <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Advertisements</p>
      </div>

      <div data-testid="sponsored-card-grid" className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {visible.map((ad) => (
          <AdvertisementCard
            key={ad.id}
            ad={ad}
            onDismiss={() => setDismissed((current) => [...current, ad.id])}
          />
        ))}
      </div>
    </section>
  );
}
