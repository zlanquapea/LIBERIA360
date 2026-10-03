import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { ApiError, getSharedTrip } from '@/lib/api';
import { formatBudgetBand } from '@/lib/format';
import { ItineraryStops } from '@/components/ItineraryStops';
import { TripCostSummary } from '@/components/TripCostSummary';
import { TripPlanChecks } from '@/components/trips/TripPlanChecks';
import { TripMapLoader } from '@/components/TripMapLoader';
import { tripHasMapPins } from '@/lib/trip-map';

// A private link: never indexed, and no preview card that could leak the
// trip's title.
export const metadata = { title: 'Shared trip — LIBERIA360', robots: { index: false, follow: false } };

// What someone sees through a trip's view-only share link: the plan and
// its estimates, never the people, chat or invitations.
export default async function SharedTripPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const t = await getTranslations('trips');
  const trip = await getSharedTrip(token).catch((err) => {
    if (err instanceof ApiError && err.status === 404) return null;
    throw err;
  });
  if (!trip) notFound();

  const fmt = new Intl.DateTimeFormat('en-US', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
  const dates =
    trip.startDate && trip.endDate ? `${fmt.format(new Date(trip.startDate))} – ${fmt.format(new Date(trip.endDate))}` : null;
  const facts = [
    t('days', { count: trip.durationDays }),
    dates,
    formatBudgetBand(trip.budgetBand),
    trip.partySize ? t('travelers', { count: trip.partySize }) : null,
    trip.startingLocation ? t('fromPlace', { place: trip.startingLocation }) : null,
    trip.transportMode ? t(`transport_${trip.transportMode}`) : null,
    trip.pace ? t(`pace_${trip.pace}`) : null,
  ].filter(Boolean);

  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-5 px-4 py-8 sm:px-6">
      <div>
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-sunset-700 dark:text-sunset-300">{t('sharedPlanEyebrow')}</p>
        <h1 className="mt-1 font-display text-3xl font-extrabold tracking-tight text-slate-950 dark:text-slate-50">{trip.title}</h1>
        {trip.admin && <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{t('plannedBy', { name: trip.admin.name })}</p>}
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">{facts.join(' · ')}</p>
        {trip.description && <p className="mt-3 text-slate-700 dark:text-slate-200">{trip.description}</p>}
      </div>

      <p className="rounded-xl bg-slate-100 px-3 py-2 text-sm text-slate-700 dark:bg-slate-800 dark:text-slate-200">{t('sharedPlanNotice')}</p>

      <TripCostSummary stops={trip.stops} />

      {tripHasMapPins(trip.stops) && (
        <div className="h-64 overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-800 sm:h-80">
          <TripMapLoader stops={trip.stops} />
        </div>
      )}

      <TripPlanChecks
        stops={trip.stops}
        durationDays={trip.durationDays}
        transportMode={trip.transportMode}
        pace={trip.pace}
        startDate={trip.startDate}
        endDate={trip.endDate}
      />

      <ItineraryStops stops={trip.stops} durationDays={trip.durationDays} />

      <Link href="/trips/new" className="inline-flex min-h-12 items-center justify-center self-start rounded-full bg-brand-700 px-5 text-sm font-semibold text-white hover:bg-brand-800">
        {t('planYourOwn')}
      </Link>
    </main>
  );
}
