'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { ClockIcon, MapPinIcon, PhoneIcon, SignalSlashIcon, WifiIcon } from '@heroicons/react/24/outline';
import { listOfflinePacks, loadOfflinePack, type OfflinePack, type OfflinePackSummary } from '@/lib/offline-packs';
import { formatCost, formatEventDateRange } from '@/lib/format';
import { resolveImageUrl, resolveThumbUrl } from '@/lib/images';
import type { ItineraryStopDetail } from '@/lib/types';

function stopTitle(stop: ItineraryStopDetail): string {
  return stop.place?.name ?? stop.event?.name ?? stop.carListing?.title ?? '';
}

// The offline copy of a downloaded trip. Everything here comes from the
// device: practical details for each stop (hours, phone, how to get
// there), the traveler's notes, and when the copy was made. Without ?id it
// lists every downloaded trip.
export default function OfflineTripPage() {
  const t = useTranslations('offline');
  const locale = useLocale();
  const [id, setId] = useState<string | null>(null);
  const [packs, setPacks] = useState<OfflinePackSummary[]>([]);
  const [pack, setPack] = useState<OfflinePack | null | undefined>(undefined);
  const [online, setOnline] = useState(true);

  useEffect(() => {
    const tripId = new URLSearchParams(window.location.search).get('id');
    setId(tripId);
    setPacks(listOfflinePacks());
    setOnline(navigator.onLine);
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    if (tripId) loadOfflinePack(tripId).then(setPack).catch(() => setPack(null));
    else setPack(null);
    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
    };
  }, []);

  const fmt = new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' });

  const status = (
    <p className={`flex items-center gap-2 rounded-xl px-3 py-2 text-sm ${online ? 'bg-brand-50 text-brand-900 dark:bg-brand-900/30 dark:text-brand-100' : 'bg-slate-200 text-slate-800 dark:bg-slate-800 dark:text-slate-100'}`}>
      {online ? <WifiIcon aria-hidden className="h-4 w-4" /> : <SignalSlashIcon aria-hidden className="h-4 w-4" />}
      {online ? t('onlineNow') : t('offlineNow')}
    </p>
  );

  if (pack === undefined) return <main className="mx-auto max-w-3xl px-4 py-10" />;

  if (!id || !pack) {
    return (
      <main className="mx-auto flex max-w-3xl flex-col gap-4 px-4 py-8 sm:px-6">
        <h1 className="font-display text-3xl font-extrabold tracking-tight text-slate-950 dark:text-slate-50">{t('offlineTrips')}</h1>
        {status}
        {id && <p className="text-slate-700 dark:text-slate-200">{t('packMissing')}</p>}
        {packs.length === 0 ? (
          <p className="text-slate-600 dark:text-slate-300">{t('noPacks')}</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {packs.map((p) => (
              <li key={p.id}>
                <a href={`/trips/offline?id=${p.id}`} className="flex flex-col rounded-2xl border border-slate-200 bg-white p-4 hover:border-brand-500 dark:border-slate-800 dark:bg-slate-900">
                  <span className="font-semibold text-slate-900 dark:text-slate-50">{p.title}</span>
                  <span className="text-xs text-slate-500 dark:text-slate-400">{t('downloadedAt', { date: fmt.format(new Date(p.downloadedAt)) })}</span>
                </a>
              </li>
            ))}
          </ul>
        )}
      </main>
    );
  }

  const { trip } = pack;
  const days = [...new Set(trip.stops.map((s) => s.day))].sort((a, b) => a - b);

  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-5 px-4 py-8 sm:px-6">
      <div>
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-sunset-700 dark:text-sunset-300">{t('offlineCopy')}</p>
        <h1 className="mt-1 font-display text-3xl font-extrabold tracking-tight text-slate-950 dark:text-slate-50">{trip.title}</h1>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
          {t('downloadedAt', { date: fmt.format(new Date(pack.downloadedAt)) })}
        </p>
      </div>
      {status}
      <p className="text-xs text-slate-500 dark:text-slate-400">{t('offlineLimits')}</p>

      {days.map((day) => (
        <section key={day} className="flex flex-col gap-3">
          <h2 className="font-display text-xl font-bold text-slate-950 dark:text-slate-50">{t('day', { day })}</h2>
          <ol className="flex flex-col gap-3">
            {trip.stops
              .filter((s) => s.day === day)
              .sort((a, b) => a.order - b.order)
              .map((stop) => {
                const image = stop.place?.images[0] ?? stop.event?.images[0] ?? stop.carListing?.images[0];
                const place = stop.place;
                const phone = place?.contactPhone ?? null;
                return (
                  <li key={`${stop.day}-${stop.order}`} className="flex gap-3 rounded-2xl border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900">
                    {image && (
                      // Served from the offline cache when there's no connection.
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={resolveThumbUrl(image) ?? resolveImageUrl(image)} alt="" className="h-20 w-20 shrink-0 rounded-xl object-cover" />
                    )}
                    <div className="flex min-w-0 flex-col gap-1 text-sm">
                      <p className="font-semibold text-slate-900 dark:text-slate-50">{stopTitle(stop)}</p>
                      {place && (
                        <p className="flex items-center gap-1 text-slate-600 dark:text-slate-300">
                          <MapPinIcon aria-hidden className="h-4 w-4 shrink-0" />
                          {place.city}, {place.county.name} · {Number(place.latitude).toFixed(5)}, {Number(place.longitude).toFixed(5)}
                        </p>
                      )}
                      {stop.event && <p className="text-slate-600 dark:text-slate-300">{formatEventDateRange(stop.event.startDate, stop.event.endDate)}</p>}
                      {place?.openingHours && (
                        <p className="flex items-center gap-1 text-slate-600 dark:text-slate-300">
                          <ClockIcon aria-hidden className="h-4 w-4 shrink-0" />
                          {place.openingHours}
                        </p>
                      )}
                      {place?.estimatedCostEntry != null && <p className="text-slate-600 dark:text-slate-300">{t('entry', { price: formatCost(place.estimatedCostEntry) })}</p>}
                      {phone && (
                        <a href={`tel:${phone}`} className="flex w-fit items-center gap-1 font-semibold text-brand-700 dark:text-brand-300">
                          <PhoneIcon aria-hidden className="h-4 w-4" />
                          {phone}
                        </a>
                      )}
                      {place?.transportNotes && <p className="text-slate-700 dark:text-slate-200">{t('gettingThere', { notes: place.transportNotes })}</p>}
                      {stop.notes && <p className="rounded-lg bg-slate-50 px-2 py-1 text-slate-700 dark:bg-slate-800 dark:text-slate-200">{stop.notes}</p>}
                    </div>
                  </li>
                );
              })}
          </ol>
        </section>
      ))}

      {online && (
        <Link href={`/trips/${trip.id}`} className="self-start font-semibold text-brand-700 underline dark:text-brand-300">
          {t('openLive')}
        </Link>
      )}
    </main>
  );
}
