import { useTranslations } from 'next-intl';
import { MapPinIcon } from '@heroicons/react/20/solid';
import type { Place, VerificationStatus } from '@/lib/types';
import type { PlaceKind } from '@/lib/place-kind';
import { KIND_CAPS } from '@/lib/place-kind';
import { placeLocation } from '@/lib/place-card';
import { CategoryIcon } from '@/lib/icons';
import { AddToTripButton } from '@/components/AddToTripButton';
import { ShareMenu } from '@/components/ShareMenu';
import { VerificationBadge } from '@/components/VerificationBadge';
import { PlaceRating } from '@/components/place-card-parts';
import { HoursStatus } from './HoursStatus';

/**
 * The name card that sits over the bottom of the photos: what kind of
 * place it is, its name and trust badge, where it is, its rating, whether
 * it's open, and the actions that make sense for this kind of place
 * (only sights, stays, food and markets can go into a trip).
 */
export function PlaceIdentity({
  place,
  kind,
  verificationStatus,
  hoursText,
}: {
  place: Place;
  kind: PlaceKind;
  verificationStatus: VerificationStatus;
  hoursText: string | null;
}) {
  const t = useTranslations('placeKind');
  const caps = KIND_CAPS[kind];
  const showHours = kind !== 'destination' || Boolean(place.structuredHours?.length);

  return (
    <header className="relative z-10 mx-2 -mt-16 flex min-w-0 flex-col gap-4 rounded-[2rem] border border-slate-200/80 bg-white/95 p-4 sm:p-5 shadow-[0_24px_60px_-30px_rgb(8_46_33/0.45)] backdrop-blur-md sm:mx-8 sm:-mt-24 md:p-7 dark:border-slate-800 dark:bg-slate-900/95">
      {/* Phones: text first, then the actions on their own row, so a long
          category or a large system font can never run under the buttons.
          From sm up the actions sit to the right of the text. */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 flex-1">
          <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs font-bold uppercase tracking-[0.16em] text-brand-700 sm:tracking-[0.2em] dark:text-brand-300">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand-50 dark:bg-brand-950/50">
              <CategoryIcon iconKey={place.category.icon} categorySlug={place.category.slug} className="h-4 w-4" />
            </span>
            <span className="min-w-0 break-words">{place.category.name}</span>
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] tracking-[0.12em] text-slate-600 dark:bg-slate-800 dark:text-slate-300">{t(`kind_${kind}`)}</span>
          </p>
          <h1 className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 break-words font-display text-[1.75rem] font-black leading-tight tracking-tight text-slate-950 sm:text-4xl lg:text-5xl dark:text-white">
            <span className="min-w-0 [overflow-wrap:anywhere]">{place.name}</span>
            <VerificationBadge status={verificationStatus} />
          </h1>
          <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2 text-sm text-slate-600 dark:text-slate-300">
            <span className="flex min-w-0 items-center gap-1">
              <MapPinIcon aria-hidden className="h-4 w-4 shrink-0 text-slate-400" />
              <span className="min-w-0">{placeLocation(place)}</span>
            </span>
            <PlaceRating place={place} tone="onLight" />
            {showHours && <HoursStatus hours={place.structuredHours} fallbackText={hoursText} />}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 sm:shrink-0 sm:flex-nowrap">
          {caps.trips && <AddToTripButton contentType="place" itemId={place.id} itemName={place.name} />}
          <ShareMenu placeName={place.name} />
        </div>
      </div>
      {place.tags.length > 0 && (
        <ul className="flex flex-wrap gap-2" aria-label={t('tags')}>
          {place.tags.map((tag) => (
            <li key={tag} className="rounded-full bg-sky-50 px-3 py-1 text-xs font-semibold text-sky-800 dark:bg-sky-950/40 dark:text-sky-300">
              {tag}
            </li>
          ))}
        </ul>
      )}
    </header>
  );
}
