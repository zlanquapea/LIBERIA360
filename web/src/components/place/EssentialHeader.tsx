import { useTranslations } from 'next-intl';
import { ChatBubbleLeftRightIcon, ExclamationTriangleIcon, MapPinIcon, PhoneIcon, PaperAirplaneIcon } from '@heroicons/react/24/solid';
import type { Business, Place, VerificationStatus } from '@/lib/types';
import type { PlaceKind } from '@/lib/place-kind';
import { placeLocation } from '@/lib/place-card';
import { directionsLink, whatsappLink } from '@/lib/contact';
import { resolveImageUrl, resolveThumbUrl } from '@/lib/images';
import { CategoryIcon } from '@/lib/icons';
import { ContactLink } from '@/components/ContactLink';
import { SafeImage } from '@/components/SafeImage';
import { ShareMenu } from '@/components/ShareMenu';
import { SaveButton } from '@/components/SaveButton';
import { VerificationBadge } from '@/components/VerificationBadge';
import { PlaceRating } from '@/components/place-card-parts';
import { HoursStatus } from './HoursStatus';

/**
 * The top of a hospital, clinic, pharmacy, bank or other service page.
 * Nobody browses these for the scenery: they need to know if it's open
 * right now, call, and get there — so those come first and biggest, with
 * the county's emergency line on health pages. No trip planning.
 */
export function EssentialHeader({
  place,
  kind,
  business,
  verificationStatus,
}: {
  place: Place;
  kind: Extract<PlaceKind, 'health' | 'service'>;
  business: Business | null;
  verificationStatus: VerificationStatus;
}) {
  const t = useTranslations('placeKind');
  const health = kind === 'health';
  const phone = business?.phone ?? place.contactPhone;
  const whatsapp = business?.whatsapp ?? place.whatsapp;
  const photo = place.images[0] ?? business?.images[0] ?? null;
  const emergency = place.county.emergencyNumber;

  const accent = health
    ? 'from-teal-700 to-emerald-800'
    : 'from-slate-800 to-brand-900';
  const primary = health
    ? 'bg-emerald-600 text-white hover:bg-emerald-700 focus-visible:ring-emerald-300'
    : 'bg-brand-700 text-white hover:bg-brand-800 focus-visible:ring-brand-300';
  const button = 'inline-flex min-h-14 items-center justify-center gap-2 rounded-2xl px-5 text-base font-bold shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-4';
  const secondary = `${button} border border-slate-200 bg-white text-slate-800 hover:border-brand-400 hover:bg-brand-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-brand-950/30`;

  return (
    <header className="overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-card dark:border-slate-800 dark:bg-slate-900">
      <div className={`flex items-center gap-4 bg-gradient-to-r ${accent} px-5 py-4 text-white sm:px-7`}>
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white/15 ring-1 ring-white/25">
          <CategoryIcon iconKey={place.category.icon} categorySlug={place.category.slug} className="h-6 w-6" />
        </span>
        <div className="min-w-0">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-white/75">{place.category.name}</p>
          <p className="text-sm text-white/90">{health ? t('healthTagline') : t('serviceTagline')}</p>
        </div>
      </div>

      <div className="flex flex-col gap-5 p-5 sm:p-7">
        <div className="flex gap-4">
          <div className="min-w-0 flex-1">
            <h1 className="flex flex-wrap items-center gap-x-3 gap-y-1 font-display text-[1.65rem] font-black leading-tight tracking-tight text-slate-950 [overflow-wrap:anywhere] sm:text-4xl dark:text-white">
              <span>{place.name}</span>
              <VerificationBadge status={verificationStatus} />
            </h1>
            <p className="mt-2 flex items-center gap-1 text-sm text-slate-600 dark:text-slate-300">
              <MapPinIcon aria-hidden className="h-4 w-4 text-slate-400" />
              {placeLocation(place)}
            </p>
            <div className="mt-2">
              <PlaceRating place={place} tone="onLight" />
            </div>
          </div>
          {photo && (
            <div className="relative hidden h-28 w-36 shrink-0 overflow-hidden rounded-2xl bg-slate-100 sm:block dark:bg-slate-800">
              <SafeImage src={resolveImageUrl(photo)} thumbSrc={resolveThumbUrl(photo)} alt="" className="absolute inset-0 h-full w-full object-cover" fallback={null} />
            </div>
          )}
        </div>

        <div className="flex flex-col gap-1.5">
          <span className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">{t('rightNow')}</span>
          <div>
            <HoursStatus hours={place.structuredHours} fallbackText={business?.openingHours ?? place.openingHours} size="lg" />
          </div>
        </div>

        <div className="grid gap-2 sm:grid-cols-2">
          {phone ? (
            <ContactLink placeId={place.id} href={`tel:${phone}`} className={`${button} ${primary}`}>
              <PhoneIcon aria-hidden className="h-5 w-5" />
              {/* Non-breaking spaces keep the number on one line. */}
              {t('callNumber', { phone: phone.replace(/ /g, '\u00a0') })}
            </ContactLink>
          ) : (
            <a href="#claim" className={`${button} border-2 border-dashed border-slate-300 text-slate-500 dark:border-slate-700`}>
              <PhoneIcon aria-hidden className="h-5 w-5" />
              {t('noPhone')}
            </a>
          )}
          <a href={directionsLink(place.latitude, place.longitude)} target="_blank" rel="noopener noreferrer" className={secondary}>
            <PaperAirplaneIcon aria-hidden className="h-5 w-5 -rotate-45 text-brand-600" />
            {t('directions')}
          </a>
          {whatsapp && (
            <ContactLink placeId={place.id} href={whatsappLink(whatsapp)} target="_blank" rel="noopener noreferrer" className={secondary}>
              <ChatBubbleLeftRightIcon aria-hidden className="h-5 w-5 text-emerald-600" />
              WhatsApp
            </ContactLink>
          )}
          <div className={`flex items-center gap-2 ${whatsapp ? '' : 'sm:col-span-2'}`}>
            <SaveButton slug={place.slug} placeId={place.id} className="min-h-14 flex-1 justify-center rounded-2xl border-slate-200 bg-white px-4 text-base font-bold text-slate-800 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100" />
            <ShareMenu placeName={place.name} />
          </div>
        </div>

        {health && (
          <div role="note" className="flex gap-3 rounded-2xl border border-rose-200 bg-rose-50 p-4 dark:border-rose-900 dark:bg-rose-950/40">
            <ExclamationTriangleIcon aria-hidden className="mt-0.5 h-5 w-5 shrink-0 text-rose-600 dark:text-rose-300" />
            <div className="text-sm text-rose-900 dark:text-rose-100">
              {emergency ? (
                <p className="font-bold">
                  {t('emergencyCall')}{' '}
                  <a href={`tel:${emergency}`} className="underline decoration-2 underline-offset-2">{emergency}</a>
                  <span className="font-normal"> · {t('emergencyCounty', { county: place.county.name })}</span>
                </p>
              ) : (
                <p className="font-bold">{t('emergencyGeneric')}</p>
              )}
              <p className="mt-1">{t('callAhead')}</p>
            </div>
          </div>
        )}
      </div>
    </header>
  );
}
