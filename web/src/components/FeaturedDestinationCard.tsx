import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { ArrowRightIcon } from '@heroicons/react/20/solid';
import type { Place, VerificationStatus } from '@/lib/types';
import { resolveImageUrl } from '@/lib/images';
import { placeLocation } from '@/lib/place-card';
import { SafeImage } from './SafeImage';
import { VerificationSeal } from './VerificationBadge';
import { PlaceBackdrop, PlaceRating } from './place-card-parts';

/**
 * Home's paid featured places, shot like a film poster: the photo fills a
 * wide frame, shaded from the left so a big headline reads over it, with
 * a gold foil "Featured" sash across the corner. The slide in view
 * (`active`) drifts in a slow Ken Burns zoom; the rest hold still. One
 * Link wraps the card, so the "Explore" pill is decorative.
 */
export function FeaturedDestinationCard({
  place,
  verificationStatus,
  active = false,
}: {
  place: Place;
  verificationStatus?: VerificationStatus;
  active?: boolean;
}) {
  const t = useTranslations('featuredCard');
  const cover = place.images[0] ? resolveImageUrl(place.images[0]) : null;
  const status = verificationStatus ?? place.verificationStatus;

  return (
    <Link
      href={`/places/${place.slug}`}
      className="group relative isolate block aspect-[4/5] overflow-hidden rounded-[2rem] bg-brand-950 shadow-card ring-1 ring-black/5 transition-shadow duration-500 hover:shadow-[0_30px_60px_-28px_rgb(8_46_33/0.6)] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-gold-300 sm:aspect-[16/10] dark:ring-white/10"
    >
      <div className={`absolute inset-0 ${active ? 'lib-kenburns' : ''}`}>
        <SafeImage
          src={cover}
          alt=""
          className="absolute inset-0 h-full w-full object-cover"
          fallback={<PlaceBackdrop category={place.category} />}
        />
      </div>
      <span aria-hidden className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-black/10 sm:bg-gradient-to-r sm:from-black/85 sm:via-black/45 sm:to-transparent" />

      {/* Gold foil sash across the top-left corner. */}
      <span aria-hidden className="pointer-events-none absolute -start-12 top-6 w-48 -rotate-45 rtl:rotate-45">
        <span className="lib-foil block py-1 text-center text-[11px] font-black uppercase tracking-[0.3em] shadow-lg">{t('featured')}</span>
      </span>
      <span className="sr-only">{t('featured')}</span>

      <div className="absolute inset-x-0 bottom-0 flex max-w-xl flex-col gap-2 p-5 text-white sm:p-7">
        <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-gold-300">
          {place.category.name} · {placeLocation(place)}
        </p>
        <h3 className="font-display text-3xl font-black leading-[1.02] tracking-tight drop-shadow-[0_2px_12px_rgba(0,0,0,0.45)] sm:text-4xl">
          {place.name}
          {status && (
            <>
              {' '}
              <VerificationSeal status={status} tone="onDark" />
            </>
          )}
        </h3>
        {place.description && <p className="line-clamp-2 text-sm leading-6 text-white/80">{place.description}</p>}
        <div className="mt-1 flex items-center gap-3">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-white px-4 py-2 text-sm font-bold text-brand-900 shadow transition-colors group-hover:bg-gold-300">
            {t('explore')}
            <ArrowRightIcon aria-hidden className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1 rtl:-scale-x-100 rtl:group-hover:-translate-x-1 motion-reduce:transition-none" />
          </span>
          <PlaceRating place={place} />
        </div>
      </div>
    </Link>
  );
}
