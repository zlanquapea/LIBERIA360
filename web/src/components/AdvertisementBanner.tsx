import { MegaphoneIcon } from '@heroicons/react/24/outline';
import { AdvertisementCard } from './AdvertisementCard';
import type { Advertisement } from '@/lib/types';

// Strategic placement wrapper — a horizontal-scroll row, same shape as
// Home's "Featured this week" section, dropped between organic content
// sections rather than above the fold, so it reads as a supplement to
// discovery rather than competing with it. Renders nothing when there are
// no approved ads (no empty "Sponsored" shelf).
export function AdvertisementBanner({ ads }: { ads: Advertisement[] }) {
  if (ads.length === 0) return null;

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
        {ads.map((ad) => (
          <div key={ad.id} className="w-64 shrink-0">
            <AdvertisementCard ad={ad} />
          </div>
        ))}
      </div>
    </section>
  );
}
