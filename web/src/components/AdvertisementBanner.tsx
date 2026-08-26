'use client';

import { useEffect, useState } from 'react';
import { MegaphoneIcon } from '@heroicons/react/24/outline';
import { AdvertisementBannerRow } from './AdvertisementBannerRow';
import type { Advertisement } from '@/lib/types';

const DISMISSED_KEY = 'liberia360:dismissed-ads';

function loadDismissed(): string[] {
  try {
    const raw = localStorage.getItem(DISMISSED_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveDismissed(ids: string[]) {
  try {
    localStorage.setItem(DISMISSED_KEY, JSON.stringify(ids));
  } catch {
    // Private browsing / storage full / disabled — dismissal just won't
    // persist across reloads; not worth failing the page over.
  }
}

// Strategic placement wrapper — a stack of full-width horizontal banners
// (not a card carousel; see AdvertisementBannerRow) dropped between organic
// content sections rather than above the fold, so it reads as a supplement
// to discovery rather than competing with it. Each banner is dismissible
// (persisted in localStorage, not just for this page load) — a viewer who
// isn't interested in one particular ad shouldn't keep seeing it every
// visit. Renders nothing once every ad has either never existed or been
// dismissed (no empty "Sponsored" shelf).
export function AdvertisementBanner({ ads }: { ads: Advertisement[] }) {
  const [dismissed, setDismissed] = useState<string[]>([]);
  // Server-rendered markup can't know what a returning visitor already
  // dismissed (that lives in their browser's localStorage) — this holds
  // rendering back one tick until the client has read it, rather than
  // flashing a dismissed ad back into view for a moment on every load.
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setDismissed(loadDismissed());
    setHydrated(true);
  }, []);

  function dismiss(id: string) {
    setDismissed((prev) => {
      const next = [...prev, id];
      saveDismissed(next);
      return next;
    });
  }

  if (!hydrated) return null;

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
      <div className="flex flex-col gap-3">
        {visible.map((ad) => (
          <AdvertisementBannerRow key={ad.id} ad={ad} onDismiss={() => dismiss(ad.id)} />
        ))}
      </div>
    </section>
  );
}
