import type { ReactNode } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import type { PublicTripDetail } from '@/lib/types';
import { formatTripStatus } from '@/lib/format';
import { resolveImageUrl } from '@/lib/images';
import { destinationCode, passDate, tripDays } from '@/lib/boarding-pass';
import { SafeImage } from '@/components/SafeImage';
import { LoneStar } from '@/components/LoneStar';

/**
 * The top of a shared trip, as a full-size boarding pass: the trip's
 * photo behind its name and status, a Lone Star trail to the
 * destination's code, the pass fields, and the join and share actions.
 */
export function TripHero({ trip, actions }: { trip: PublicTripDetail; actions: ReactNode }) {
  const t = useTranslations('boardingPass');
  const tp = useTranslations('tripPage');
  const locale = useLocale();
  const coverPath = trip.coverImage ?? trip.destination?.images[0] ?? null;
  const days = tripDays(trip.startDate, trip.endDate) ?? (new Set(trip.stops.map((s) => s.day)).size || null);
  const seatsLeft = trip.maxParticipants != null ? Math.max(0, trip.maxParticipants - trip.participantCount) : null;
  const fields = [
    { label: t('date'), value: trip.startDate ? passDate(trip.startDate, locale) : t('flexible') },
    { label: t('days'), value: days != null ? String(days) : '—' },
    {
      label: t('travellers'),
      value: trip.maxParticipants != null ? `${trip.participantCount}/${trip.maxParticipants}` : String(trip.participantCount),
    },
    { label: t('seats'), value: seatsLeft == null ? t('open') : seatsLeft === 0 ? t('full') : t('left', { count: seatsLeft }), full: seatsLeft === 0 },
  ];

  return (
    <section className="lib-pass overflow-hidden rounded-[2rem]">
      <div className="relative isolate bg-brand-950 px-5 pb-6 pt-5 text-white sm:px-8 sm:pb-8 sm:pt-7">
        {coverPath && (
          <SafeImage src={resolveImageUrl(coverPath)} alt="" loading="eager" className="absolute inset-0 -z-10 h-full w-full object-cover opacity-45" fallback={null} />
        )}
        <span aria-hidden className="absolute inset-0 -z-10 bg-gradient-to-r from-brand-950 via-brand-950/80 to-brand-950/30" />
        <div className="flex items-center justify-between gap-3">
          <span className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.24em] text-sunset-200">
            <LoneStar className="h-3.5 w-3.5 text-white" />
            {t('title')}
          </span>
          <span className="rounded-full bg-white/15 px-3 py-1 text-[11px] font-bold uppercase tracking-wider ring-1 ring-white/25">
            {formatTripStatus(trip.status)}
          </span>
        </div>
        <h1 className="mt-4 max-w-3xl font-display text-[1.75rem] font-black leading-[1.05] tracking-tight [overflow-wrap:anywhere] sm:text-5xl">{trip.title}</h1>
        {trip.admin && <p className="mt-2 text-sm text-white/75">{t('organizer', { name: trip.admin.name })}</p>}
      </div>

      <div className="flex flex-col gap-5 bg-[#fffaf1] px-5 py-5 sm:px-8 sm:py-6 dark:bg-slate-900">
        <div className="flex items-end gap-4">
          <div aria-hidden className="relative mb-3 h-5 flex-1">
            <span className="absolute inset-x-0 top-1/2 border-t-2 border-dotted border-brand-300 dark:border-brand-700" />
            <span className="lib-pass__traveller absolute top-0 flex h-5 w-5 items-center justify-center rounded-full bg-brand-700 text-white shadow">
              <LoneStar className="h-3 w-3" />
            </span>
          </div>
          <div className="text-end">
            <p className="font-display text-5xl font-black leading-none tracking-tight text-slate-950 dark:text-white">{destinationCode(trip.destination?.name)}</p>
            <p className="mt-1 text-sm font-medium text-slate-500 dark:text-slate-400">
              {trip.destination ? `${trip.destination.name}, ${trip.destination.county.name}` : t('anywhere')}
            </p>
          </div>
        </div>
        <dl className="grid grid-cols-2 gap-4 border-t border-slate-200/80 pt-5 sm:grid-cols-4 dark:border-slate-800">
          {fields.map((f) => (
            <div key={f.label}>
              <dt className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">{f.label}</dt>
              <dd className={`font-display text-xl font-black ${f.full ? 'text-flag-600 dark:text-flag-300' : 'text-slate-950 dark:text-white'}`}>{f.value}</dd>
            </div>
          ))}
        </dl>
        <div className="flex flex-wrap items-center gap-3 border-t border-dashed border-slate-300 pt-5 dark:border-slate-700">
          {actions}
          <span className="sr-only">{tp('passLabel')}</span>
        </div>
      </div>
    </section>
  );
}
