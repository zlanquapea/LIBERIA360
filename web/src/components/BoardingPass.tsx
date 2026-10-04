import Link from 'next/link';
import type { ReactNode } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import type { PublicTripSummary } from '@/lib/types';
import { formatTripStatus } from '@/lib/format';
import { resolveImageUrl } from '@/lib/images';
import { barcodeBars, destinationCode, passDate, tripDays } from '@/lib/boarding-pass';
import { SafeImage } from './SafeImage';
import { LoneStar } from './LoneStar';

/**
 * A trip as a boarding pass: a dark header band over the trip's photo,
 * the trip name, a Lone Star trail to the destination's three-letter
 * code, then DATE / DAYS / TRAVELLERS / SEATS like a pass's fields, and a
 * tear-off stub with the organiser and a barcode unique to the trip.
 * Trips don't record a starting point, so the route only names where
 * it's going. `action` (e.g. "Use this itinerary") renders on the stub.
 */
export function BoardingPass({
  trip,
  href,
  action,
  className = '',
}: {
  trip: PublicTripSummary;
  href?: string;
  action?: ReactNode;
  className?: string;
}) {
  const t = useTranslations('boardingPass');
  const locale = useLocale();
  const code = destinationCode(trip.destination?.name);
  const days = tripDays(trip.startDate, trip.endDate);
  const seatsLeft = trip.maxParticipants != null ? Math.max(0, trip.maxParticipants - trip.participantCount) : null;
  const cover = trip.coverImage ? resolveImageUrl(trip.coverImage) : null;
  const destination = trip.destination ? `${trip.destination.name}, ${trip.destination.county.name}` : t('anywhere');

  const fields: Array<{ label: string; value: string; accent?: boolean }> = [
    { label: t('date'), value: trip.startDate ? passDate(trip.startDate, locale) : t('flexible') },
    { label: t('days'), value: days != null ? String(days) : '—' },
    {
      label: t('travellers'),
      value: trip.maxParticipants != null ? `${trip.participantCount}/${trip.maxParticipants}` : String(trip.participantCount),
    },
    {
      label: t('seats'),
      value: seatsLeft == null ? t('open') : seatsLeft === 0 ? t('full') : t('left', { count: seatsLeft }),
      accent: seatsLeft === 0,
    },
  ];

  const body = (
    <>
      <div className="relative overflow-hidden bg-brand-950 px-4 pb-3 pt-3 text-white">
        {cover && (
          <SafeImage
            src={cover}
            alt=""
            className="absolute inset-0 h-full w-full object-cover opacity-35 transition-transform duration-[1200ms] ease-out group-hover:scale-110 motion-reduce:transition-none"
            fallback={null}
          />
        )}
        <span aria-hidden className="absolute inset-0 bg-gradient-to-r from-brand-950 via-brand-950/80 to-brand-950/40" />
        <div className="relative flex items-center justify-between gap-2">
          <span className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.22em] text-sunset-200">
            <LoneStar className="h-3 w-3 text-white" />
            {t('title')}
          </span>
          <span className="rounded-full bg-white/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ring-1 ring-white/25">
            {formatTripStatus(trip.status)}
          </span>
        </div>
        <h3 className="relative mt-2 line-clamp-2 font-display text-lg font-bold leading-snug">{trip.title}</h3>
      </div>

      <div className="flex flex-1 flex-col gap-3 bg-[#fffaf1] px-4 pb-4 pt-3 dark:bg-slate-900">
        <div className="flex items-end gap-3">
          <div aria-hidden className="relative mb-2 h-4 flex-1">
            <span className="absolute inset-x-0 top-1/2 border-t-2 border-dotted border-brand-300 dark:border-brand-700" />
            <span className="lib-pass__traveller absolute top-0 flex h-4 w-4 items-center justify-center rounded-full bg-brand-700 text-white shadow">
              <LoneStar className="h-2.5 w-2.5" />
            </span>
          </div>
          <div className="text-end">
            <p className="font-display text-3xl font-black leading-none tracking-tight text-slate-950 dark:text-white">{code}</p>
            <p className="mt-1 max-w-[11rem] truncate text-[11px] font-medium text-slate-500 dark:text-slate-400">{destination}</p>
          </div>
        </div>
        <dl className="grid grid-cols-4 gap-2 border-t border-slate-200/80 pt-3 dark:border-slate-800">
          {fields.map((f) => (
            <div key={f.label} className="min-w-0">
              <dt className="text-[9px] font-bold uppercase tracking-[0.16em] text-slate-400">{f.label}</dt>
              <dd className={`truncate font-display text-sm font-bold ${f.accent ? 'text-flag-600 dark:text-flag-300' : 'text-slate-900 dark:text-slate-50'}`}>{f.value}</dd>
            </div>
          ))}
        </dl>
      </div>
    </>
  );

  const bars = barcodeBars(trip.id);
  return (
    <div className={`lib-pass group flex h-full flex-col ${className}`}>
      <div className="lib-ticket__top flex flex-1 flex-col overflow-hidden rounded-t-[1.25rem]">
        {href ? (
          <Link href={href} className="flex flex-1 flex-col focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-inset focus-visible:ring-sunset-300">
            {body}
          </Link>
        ) : (
          body
        )}
      </div>
      <div className="lib-ticket__bottom relative flex items-center gap-3 rounded-b-[1.25rem] bg-[#fffaf1] px-4 pb-4 pt-3 dark:bg-slate-900">
        <span aria-hidden className="absolute inset-x-4 top-0 border-t-2 border-dashed border-slate-200 dark:border-slate-700" />
        <div className="min-w-0 flex-1">
          {action ?? (
            <p className="truncate text-xs text-slate-500 dark:text-slate-400">
              {trip.admin ? t('organizer', { name: trip.admin.name }) : t('communityTrip')}
            </p>
          )}
        </div>
        <svg aria-hidden viewBox={`0 0 ${bars.reduce((a, w) => a + w + 1, 0)} 20`} className="h-7 w-24 shrink-0 text-slate-800 dark:text-slate-200" preserveAspectRatio="none">
          {bars.reduce<{ x: number; rects: ReactNode[] }>(
            (acc, w, i) => {
              if (i % 2 === 0) acc.rects.push(<rect key={i} x={acc.x} y={0} width={w} height={20} fill="currentColor" />);
              acc.x += w + 1;
              return acc;
            },
            { x: 0, rects: [] },
          ).rects}
        </svg>
      </div>
    </div>
  );
}
