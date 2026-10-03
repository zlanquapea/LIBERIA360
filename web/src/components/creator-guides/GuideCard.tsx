import Link from 'next/link';
import { CheckBadgeIcon } from '@heroicons/react/24/solid';
import { MapPinIcon } from '@heroicons/react/24/outline';
import { SafeImage } from '@/components/SafeImage';
import { resolveImageUrl, resolveThumbUrl } from '@/lib/images';
import type { CreatorGuide } from '@/lib/types';

// A guide in a list: its own cover, or else a photo of its first place.
export function GuideCard({ guide, placesLabel, byLabel }: { guide: CreatorGuide; placesLabel: string; byLabel: string }) {
  const cover = guide.coverImage ?? guide.stops.find((s) => s.place.images.length > 0)?.place.images[0] ?? null;
  return (
    <Link
      href={`/creator-guides/${guide.slug}`}
      className="group flex h-full flex-col overflow-hidden rounded-[1.5rem] border border-slate-200 bg-white shadow-card transition-all hover:-translate-y-0.5 hover:shadow-card-hover motion-reduce:transition-none motion-reduce:hover:translate-y-0 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-300 dark:border-slate-800 dark:bg-slate-900"
    >
      <div className="relative h-40 overflow-hidden bg-brand-900">
        <SafeImage
          src={cover ? resolveImageUrl(cover) : null}
          thumbSrc={cover ? resolveThumbUrl(cover) : null}
          alt=""
          className="h-40 w-full object-cover transition-transform duration-500 group-hover:scale-105 motion-reduce:transition-none"
          fallback={<div aria-hidden className="h-40 bg-gradient-to-br from-brand-700 to-brand-950" />}
        />
      </div>
      <div className="flex flex-1 flex-col gap-1.5 p-4">
        <h3 className="font-display text-lg font-bold leading-snug text-slate-950 group-hover:text-brand-800 dark:text-slate-50 dark:group-hover:text-brand-300">
          {guide.title}
        </h3>
        <p className="line-clamp-2 text-sm text-slate-600 dark:text-slate-300">{guide.summary}</p>
        <div className="mt-auto flex items-center justify-between gap-2 pt-2 text-xs text-slate-600 dark:text-slate-400">
          <span className="flex min-w-0 items-center gap-1">
            <span className="truncate">{byLabel}</span>
            {guide.creator.verificationStatus === 'verified' && (
              <CheckBadgeIcon aria-label="Verified creator" className="h-4 w-4 shrink-0 text-brand-600" />
            )}
          </span>
          <span className="flex shrink-0 items-center gap-1">
            <MapPinIcon aria-hidden className="h-3.5 w-3.5" />
            {placesLabel}
          </span>
        </div>
      </div>
    </Link>
  );
}
