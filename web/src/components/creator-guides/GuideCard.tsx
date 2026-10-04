import Link from 'next/link';
import { CheckBadgeIcon } from '@heroicons/react/24/solid';
import { SafeImage } from '@/components/SafeImage';
import { resolveImageUrl, resolveThumbUrl } from '@/lib/images';
import type { CreatorGuide } from '@/lib/types';

const TRAIL_MAX = 5;

/**
 * A creator's guide as a field journal: ruled paper on a stitched spine,
 * the guide's photo taped in like a snapshot (its own cover, or a photo of
 * its first place), and the route drawn as a dotted trail with a numbered
 * stamp per stop. On hover the cover swings open a little on its spine.
 */
export function GuideCard({ guide, placesLabel, byLabel }: { guide: CreatorGuide; placesLabel: string; byLabel: string }) {
  const cover = guide.coverImage ?? guide.stops.find((s) => s.place.images.length > 0)?.place.images[0] ?? null;
  const stops = guide.stops.slice(0, TRAIL_MAX);
  const more = guide.stops.length - stops.length;

  return (
    <div className="lib-journal reveal-on-scroll h-full">
      <Link
        href={`/creator-guides/${guide.slug}`}
        className="lib-journal__cover group relative flex h-full flex-col overflow-hidden rounded-e-[1.25rem] rounded-s-md ps-6 shadow-card ring-1 ring-black/5 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-300 dark:ring-white/10"
      >
        {/* Leather spine with stitching. */}
        <span aria-hidden className="absolute inset-y-0 start-0 w-4 bg-gradient-to-r from-brand-950 to-brand-800" />
        <span aria-hidden className="absolute inset-y-2 start-[7px] border-s-2 border-dashed border-gold-300/70" />

        <div className="relative px-4 pt-4">
          <div className="lib-journal__snap relative bg-white p-1.5 pb-5 shadow-md dark:bg-slate-100">
            <span aria-hidden className="absolute -top-2 start-1/2 h-4 w-14 -translate-x-1/2 rotate-[-4deg] bg-gold-200/80 shadow-sm rtl:translate-x-1/2" />
            <div className="relative aspect-[16/10] overflow-hidden bg-brand-900">
              <SafeImage
                src={cover ? resolveImageUrl(cover) : null}
                thumbSrc={cover ? resolveThumbUrl(cover) : null}
                alt=""
                className="absolute inset-0 h-full w-full object-cover"
                fallback={<div aria-hidden className="absolute inset-0 bg-gradient-to-br from-brand-700 to-brand-950" />}
              />
            </div>
          </div>
        </div>

        <div className="flex flex-1 flex-col gap-2 px-4 pb-4 pt-3">
          <h3 className="font-display text-lg font-bold leading-snug text-slate-950 group-hover:text-brand-800 dark:text-slate-50 dark:group-hover:text-brand-300">
            {guide.title}
          </h3>
          <p className="line-clamp-2 text-sm leading-7 text-slate-600 dark:text-slate-300">{guide.summary}</p>

          {stops.length > 0 && (
            <div className="mt-1">
              <ol className="flex items-center" aria-label={placesLabel}>
                {stops.map((stop, i) => (
                  <li key={`${stop.place.id}-${i}`} className="flex flex-1 items-center last:flex-none">
                    <span
                      title={stop.place.name}
                      className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 border-sunset-500 bg-white text-[10px] font-black text-sunset-700 dark:bg-slate-900 dark:text-sunset-300"
                    >
                      <span aria-hidden>{i + 1}</span>
                      <span className="sr-only">{stop.place.name}</span>
                    </span>
                    {(i < stops.length - 1 || more > 0) && (
                      <span aria-hidden className="mx-1 h-0 flex-1 border-t-2 border-dotted border-sunset-300 dark:border-sunset-700" />
                    )}
                  </li>
                ))}
                {more > 0 && <li className="text-[11px] font-bold text-sunset-700 dark:text-sunset-300">+{more}</li>}
              </ol>
              <p className="mt-1.5 truncate text-xs text-slate-500 dark:text-slate-400">
                {stops.map((s) => s.place.name).join(' → ')}
              </p>
            </div>
          )}

          <div className="mt-auto flex items-center justify-between gap-2 border-t border-dashed border-slate-300 pt-2 text-xs text-slate-600 dark:border-slate-700 dark:text-slate-400">
            <span className="flex min-w-0 items-center gap-1 italic">
              <span className="truncate">{byLabel}</span>
              {guide.creator.verificationStatus === 'verified' && (
                <CheckBadgeIcon aria-label="Verified creator" className="h-4 w-4 shrink-0 text-brand-600" />
              )}
            </span>
            <span className="shrink-0 font-semibold">{placesLabel}</span>
          </div>
        </div>
      </Link>
    </div>
  );
}
