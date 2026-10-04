import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import { CalendarDaysIcon, MapPinIcon, TruckIcon } from '@heroicons/react/24/outline';
import type { ItineraryStopDetail } from '@/lib/types';
import { resolveImageUrl, resolveThumbUrl } from '@/lib/images';
import { placeLocation } from '@/lib/place-card';
import { eventTimeLabel } from '@/lib/event-ticket';
import { SafeImage } from '@/components/SafeImage';

function dayDate(startDate: string | null, day: number, locale: string): string | null {
  if (!startDate) return null;
  const d = new Date(startDate);
  d.setUTCDate(d.getUTCDate() + day - 1);
  return new Intl.DateTimeFormat(locale, { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' }).format(d);
}

/**
 * The trip's plan as a day-by-day timeline: a heading per day (with its
 * date when the trip has one), then each stop with a photo, what kind of
 * stop it is, where, and the organiser's note.
 */
export function TripTimeline({ stops, startDate }: { stops: ItineraryStopDetail[]; startDate: string | null }) {
  const t = useTranslations('tripPage');
  const locale = useLocale();
  if (stops.length === 0) {
    return <p className="rounded-2xl border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">{t('noStops')}</p>;
  }
  const days = [...new Set(stops.map((s) => s.day))].sort((a, b) => a - b);

  return (
    <ol className="flex flex-col gap-8">
      {days.map((day) => {
        const dayStops = stops.filter((s) => s.day === day).sort((a, b) => a.order - b.order);
        const date = dayDate(startDate, day, locale);
        return (
          <li key={day}>
            <h3 className="flex items-baseline gap-3">
              <span className="font-display text-2xl font-black text-slate-950 dark:text-white">{t('day', { day })}</span>
              {date && <span className="text-sm font-semibold text-slate-500 dark:text-slate-400">{date}</span>}
            </h3>
            <ol className="relative mt-4 flex flex-col gap-4 border-s-2 border-dashed border-brand-200 ps-6 dark:border-brand-900">
              {dayStops.map((stop, i) => {
                const image =
                  stop.place?.images[0] ?? stop.event?.images[0] ?? stop.carListing?.images[0] ?? null;
                const href = stop.place
                  ? `/places/${stop.place.slug}`
                  : stop.event
                    ? `/events/${stop.event.id}`
                    : stop.carListing
                      ? `/car-rentals/${stop.carListing.id}`
                      : null;
                const name = stop.place?.name ?? stop.event?.name ?? stop.carListing?.title ?? t('unknownStop');
                const Icon = stop.event ? CalendarDaysIcon : stop.carListing ? TruckIcon : MapPinIcon;
                const kind = stop.event ? t('kindEvent') : stop.carListing ? t('kindCar') : stop.place?.category.name ?? t('kindPlace');
                const sub = stop.place
                  ? placeLocation(stop.place)
                  : stop.event
                    ? eventTimeLabel(stop.event.startDate, stop.event.endDate, locale)
                    : stop.carListing?.county?.name ?? null;
                const body = (
                  <div className="flex gap-3 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm transition-shadow hover:shadow-card dark:border-slate-800 dark:bg-slate-900">
                    <div className="relative h-20 w-24 shrink-0 overflow-hidden rounded-xl bg-brand-900">
                      <SafeImage
                        src={image ? resolveImageUrl(image) : null}
                        thumbSrc={image ? resolveThumbUrl(image) : null}
                        alt=""
                        className="absolute inset-0 h-full w-full object-cover"
                        fallback={
                          <div aria-hidden className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-brand-700 to-brand-950">
                            <Icon className="h-7 w-7 text-white/70" />
                          </div>
                        }
                      />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="flex items-center gap-1 text-[11px] font-bold uppercase tracking-[0.14em] text-brand-700 dark:text-brand-300">
                        <Icon aria-hidden className="h-3.5 w-3.5" />
                        {kind}
                      </p>
                      <p className="mt-0.5 font-display font-bold leading-snug text-slate-950 dark:text-white">{name}</p>
                      {sub && <p className="truncate text-sm text-slate-500 dark:text-slate-400">{sub}</p>}
                      {stop.notes && <p className="mt-1 line-clamp-2 text-sm italic text-slate-600 dark:text-slate-300">“{stop.notes}”</p>}
                    </div>
                  </div>
                );
                return (
                  <li key={`${day}-${i}`} className="relative">
                    <span aria-hidden className="absolute -start-[2.05rem] top-7 flex h-4 w-4 items-center justify-center rounded-full border-2 border-white bg-brand-600 shadow dark:border-slate-950" />
                    {href ? (
                      <Link href={href} className="block rounded-2xl focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-300">
                        {body}
                      </Link>
                    ) : (
                      body
                    )}
                  </li>
                );
              })}
            </ol>
          </li>
        );
      })}
    </ol>
  );
}
