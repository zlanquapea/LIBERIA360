'use client';

import { useLocale, useTranslations } from 'next-intl';
import { InformationCircleIcon, ShieldCheckIcon, UserGroupIcon } from '@heroicons/react/24/outline';
import { daysSinceChecked, STALE_AFTER_DAYS } from '@/lib/practical-info';
import type { Place, VerificationStatus } from '@/lib/types';

// Where the practical details (hours, prices, contacts, amenities) came
// from and when they were last confirmed — and whether the listing itself
// is verified by LIBERIA360 or a community submission. Nothing here is
// inferred: an unrecorded source is shown as unrecorded.
export function PlaceProvenance({
  place,
  verificationStatus,
}: {
  place: Pick<Place, 'practicalInfoSource' | 'practicalInfoCheckedAt' | 'ownerUserId'>;
  verificationStatus: VerificationStatus;
}) {
  const t = useTranslations('placeDetail');
  const locale = useLocale();
  const verified = verificationStatus === 'verified';
  const community = !verified && (place.practicalInfoSource === 'community' || place.ownerUserId !== null);
  const age = daysSinceChecked(place);
  const checked = place.practicalInfoCheckedAt
    ? new Date(place.practicalInfoCheckedAt).toLocaleDateString(locale, { day: 'numeric', month: 'short', year: 'numeric' })
    : null;

  return (
    <div className="flex flex-col gap-2 rounded-2xl bg-slate-50 p-3 text-sm dark:bg-slate-800/60">
      <p className="flex items-start gap-2 font-semibold text-slate-900 dark:text-slate-50">
        {verified ? (
          <ShieldCheckIcon aria-hidden className="mt-0.5 h-4 w-4 shrink-0 text-brand-600 dark:text-brand-300" />
        ) : community ? (
          <UserGroupIcon aria-hidden className="mt-0.5 h-4 w-4 shrink-0 text-sunset-600 dark:text-sunset-300" />
        ) : (
          <InformationCircleIcon aria-hidden className="mt-0.5 h-4 w-4 shrink-0 text-slate-500" />
        )}
        {verified ? t('listingVerified') : community ? t('listingCommunity') : t('listingUnverified')}
      </p>
      <p className="text-slate-600 dark:text-slate-300">
        {place.practicalInfoSource
          ? t('detailsSource', { source: t(`source_${place.practicalInfoSource}`) })
          : t('detailsSourceUnknown')}
        {checked && <> · {t('lastChecked', { date: checked })}</>}
      </p>
      {(age === null || age > STALE_AFTER_DAYS) && (
        <p className="text-xs text-slate-500 dark:text-slate-400">{t('callAhead')}</p>
      )}
    </div>
  );
}
