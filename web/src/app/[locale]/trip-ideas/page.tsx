'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { MapPinIcon } from '@heroicons/react/20/solid';
import { useAuth } from '@/hooks/useAuth';
import { cloneFeaturedItinerary, getFeaturedItineraries } from '@/lib/itinerary-api';
import { getFriendlyErrorMessage } from '@/lib/errors';
import { resolveImageUrl, resolveThumbUrl } from '@/lib/images';
import { gradientForCategory } from '@/lib/category-colors';
import { SafeImage } from '@/components/SafeImage';
import { BrandLoader } from '@/components/BrandLoader';
import type { PublicTripSummary } from '@/lib/types';

// "Trip Ideas" — curated starter itineraries an admin has featured (see
// ItinerariesService.setFeaturedTemplate). Public, unauthenticated, and
// distinct from /trips/community: these are clonable starting points, not
// trips to request to join. Client-only, matching /trips/community's own
// reasoning.
export default function TripIdeasPage() {
  const t = useTranslations('trips');
  const tCommon = useTranslations('common');
  const router = useRouter();
  const { token } = useAuth();
  const [trips, setTrips] = useState<PublicTripSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [usingId, setUsingId] = useState<string | null>(null);
  const [useError, setUseError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    getFeaturedItineraries()
      .then((data) => {
        if (!cancelled) setTrips(data);
      })
      .catch((err) => {
        if (!cancelled) setLoadError(getFriendlyErrorMessage(err, { context: { action: 'load-trip-ideas' } }));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleUseTemplate(id: string) {
    if (!token) {
      router.push('/login');
      return;
    }
    setUsingId(id);
    setUseError(null);
    try {
      const copy = await cloneFeaturedItinerary(token, id);
      router.push(`/trips/${copy.id}`);
    } catch (err) {
      setUseError(getFriendlyErrorMessage(err, { context: { action: 'use-featured-itinerary' } }));
      setUsingId(null);
    }
  }

  const grouped = trips.reduce<Record<string, PublicTripSummary[]>>((acc, trip) => {
    const key = trip.featuredCategory ?? 'more-ideas';
    (acc[key] ??= []).push(trip);
    return acc;
  }, {});

  return (
    <main className="mx-auto flex max-w-5xl flex-col gap-4 px-4 py-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-slate-50">{t('tripIdeas')}</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">{t('tripIdeasSubtitle')}</p>
        </div>
        <Link href="/trips/new" className="text-sm font-medium text-brand-700 dark:text-brand-300 hover:underline">
          {t('buildYourOwn')} →
        </Link>
      </div>

      {useError && (
        <p role="alert" className="rounded-lg bg-flag-500/10 px-3 py-2 text-sm text-flag-700 dark:text-flag-300">
          {useError}
        </p>
      )}

      {loading ? (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-slate-300 px-4 py-10 text-center dark:border-slate-700">
          <BrandLoader />
          <p className="text-sm font-medium text-slate-600 dark:text-slate-300">{tCommon('loading')}</p>
        </div>
      ) : loadError ? (
        <p role="alert" className="rounded-lg bg-flag-500/10 px-3 py-2 text-sm text-flag-700 dark:text-flag-300">
          {loadError}
        </p>
      ) : trips.length === 0 ? (
        <p className="rounded-xl border border-dashed border-slate-300 dark:border-slate-700 px-4 py-8 text-center text-slate-500 dark:text-slate-400">
          {t('noTripIdeas')}
        </p>
      ) : (
        <div className="flex flex-col gap-6">
          {Object.entries(grouped).map(([category, categoryTrips]) => (
            <section key={category} className="flex flex-col gap-3">
              <h2 className="text-sm font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                {category === 'more-ideas' ? t('moreTripIdeas') : category}
              </h2>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {categoryTrips.map((trip) => (
                  <FeaturedItineraryCard
                    key={trip.id}
                    trip={trip}
                    onUse={() => handleUseTemplate(trip.id)}
                    using={usingId === trip.id}
                  />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </main>
  );
}

function FeaturedItineraryCard({
  trip,
  onUse,
  using,
}: {
  trip: PublicTripSummary;
  onUse: () => void;
  using: boolean;
}) {
  const t = useTranslations('trips');
  const cover = trip.coverImage ? resolveImageUrl(trip.coverImage) : null;
  const coverThumb = trip.coverImage ? resolveThumbUrl(trip.coverImage) : null;

  return (
    <div className="flex flex-col overflow-hidden rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-card">
      <div className="h-32 overflow-hidden">
        <SafeImage
          src={cover}
          thumbSrc={coverThumb}
          alt=""
          className="h-32 w-full object-cover"
          fallback={
            <div
              aria-hidden
              className="flex h-32 items-center justify-center text-4xl"
              style={{ backgroundImage: gradientForCategory(trip.destination?.category.slug ?? 'default') }}
            >
              <MapPinIcon className="h-9 w-9 text-white/90" />
            </div>
          }
        />
      </div>
      <div className="flex flex-1 flex-col gap-1.5 p-3">
        <h3 className="font-display font-semibold leading-snug text-slate-900 dark:text-slate-50">{trip.title}</h3>
        {trip.destination && (
          <p className="flex items-center gap-1 text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
            <MapPinIcon aria-hidden className="h-3.5 w-3.5" />
            {trip.destination.name}
          </p>
        )}
        {trip.description && <p className="line-clamp-2 text-sm text-slate-600 dark:text-slate-300">{trip.description}</p>}
        <button
          type="button"
          onClick={onUse}
          disabled={using}
          className="mt-auto inline-flex min-h-10 items-center justify-center rounded-full bg-brand-700 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-800 disabled:opacity-60"
        >
          {using ? t('usingTemplate') : t('useThisItinerary')}
        </button>
      </div>
    </div>
  );
}
