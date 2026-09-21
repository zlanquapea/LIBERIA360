import Link from 'next/link';
import { CalendarDaysIcon, PencilSquareIcon, TruckIcon } from '@heroicons/react/24/solid';
import { formatCarCategory, formatCost, formatEventDateRange, formatPlaceType } from '@/lib/format';
import { CategoryIcon } from '@/lib/icons';
import type { ItineraryStopDetail } from '@/lib/types';

// Groups an itinerary's resolved stops by day (Tech Spec §4.3) — the same
// trip detail view renders an older Weekend Explorer trip too (retired
// feature, but existing ones still show fine — same ItineraryDetail
// shape). `onRemove`/`onMove` are only passed for a collaborative trip's
// detail view where the viewer can actually edit it — the read-only
// generation-result views leave them undefined.
//
// Product feedback (Sep 5, 2026): "in Liberia we plan a trip to a place...
// no one talks about stop." The word "stop" — clear enough to someone
// picturing a multi-leg road trip — doesn't match how a Liberian traveler
// actually describes this ("a trip to Nimba Ecolodge"). Kept the
// underlying `stops` data model as-is (a trip can still bundle more than
// one place across days if someone wants that); only the user-facing
// copy changed here and everywhere else it showed up ("place"/"places"
// instead of "stop"/"stops" — see AddTripStop, TripPlannerForm, the
// homepage/trips/new blurbs, and the stat line drawn onto TripShareCard).
//
// Widened (Sep 2026, "make trip planning the platform's focus" product
// review) from place-only stops to also carry an event or a car rental
// listing — see ItineraryStopDetail's own doc comment. Exactly one of
// place/event/carListing is set per stop; `itemId`/the icon/the link
// target/the subtitle all branch on whichever it is.
function stopItemId(stop: ItineraryStopDetail): string | undefined {
  return stop.place?.id ?? stop.event?.id ?? stop.carListing?.id;
}

function StopIcon({ stop }: { stop: ItineraryStopDetail }) {
  if (stop.event) return <CalendarDaysIcon aria-hidden className="h-4 w-4" />;
  if (stop.carListing) return <TruckIcon aria-hidden className="h-4 w-4" />;
  return (
    <CategoryIcon
      iconKey={stop.place!.category.icon}
      categorySlug={stop.place!.category.slug}
      className="h-4 w-4"
    />
  );
}

function stopHref(stop: ItineraryStopDetail): string {
  if (stop.event) return `/events/${stop.event.id}`;
  if (stop.carListing) return `/car-rentals/${stop.carListing.id}`;
  return `/places/${stop.place!.slug}`;
}

function stopTitle(stop: ItineraryStopDetail): string {
  return stop.event?.name ?? stop.carListing?.title ?? stop.place!.name;
}

function stopSubtitle(stop: ItineraryStopDetail): string {
  if (stop.event) {
    const location =
      stop.event.place?.name ?? stop.event.locationText ?? stop.event.county.name;
    return `${formatEventDateRange(stop.event.startDate, stop.event.endDate)} · ${location}`;
  }
  if (stop.carListing) {
    return `${formatCarCategory(stop.carListing.category)} · ${formatCost(stop.carListing.pricePerDay)}/day`;
  }
  return `${formatPlaceType(stop.place!.type)} · ${stop.place!.city}`;
}

export function ItineraryStops({
  stops,
  durationDays,
  onRemove,
  onMove,
}: {
  stops: ItineraryStopDetail[];
  durationDays?: number;
  onRemove?: (itemId: string) => void;
  onMove?: (itemId: string, day: number) => void;
}) {
  const byDay = new Map<number, ItineraryStopDetail[]>();
  for (const stop of stops) {
    const list = byDay.get(stop.day) ?? [];
    list.push(stop);
    byDay.set(stop.day, list);
  }
  const days = [...byDay.keys()].sort((a, b) => a - b);

  if (days.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-slate-300 dark:border-slate-700 px-4 py-8 text-center text-slate-500 dark:text-slate-400">
        No places in this itinerary.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      {days.map((day) => (
        <div key={day} className="flex flex-col gap-2">
          <h2 className="font-semibold text-slate-900 dark:text-slate-50">Day {day}</h2>
          <ul className="flex flex-col gap-2">
            {byDay
              .get(day)!
              .sort((a, b) => a.order - b.order)
              .map((stop) => {
                const itemId = stopItemId(stop);
                if (!itemId) return null;
                return (
                  <li key={`${stop.day}-${stop.order}-${itemId}`}>
                    <div className="flex items-center gap-2 rounded-xl border border-slate-200 dark:border-slate-800 p-3 transition-all hover:-translate-y-0.5 hover:border-brand-500 hover:shadow-card">
                      <Link href={stopHref(stop)} className="flex min-w-0 flex-1 items-center gap-3">
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent-600 text-lg text-white">
                          <StopIcon stop={stop} />
                        </span>
                        <div className="min-w-0">
                          <p className="truncate font-medium text-slate-900 dark:text-slate-50">
                            {stopTitle(stop)}
                          </p>
                          <p className="text-xs text-slate-500 dark:text-slate-400">
                            {stopSubtitle(stop)}
                          </p>
                        </div>
                      </Link>
                      {onMove && durationDays && durationDays > 1 && (
                        <select
                          value={stop.day}
                          onChange={(e) => onMove(itemId, Number(e.target.value))}
                          aria-label={`Move ${stopTitle(stop)} to a different day`}
                          className="shrink-0 rounded-full border border-slate-300 dark:border-slate-700 bg-transparent px-2 py-1 text-xs font-medium text-slate-600 dark:text-slate-300"
                        >
                          {Array.from({ length: durationDays }, (_, i) => i + 1).map((d) => (
                            <option key={d} value={d}>
                              Day {d}
                            </option>
                          ))}
                        </select>
                      )}
                      {onRemove && (
                        <button
                          type="button"
                          onClick={() => onRemove(itemId)}
                          aria-label={`Remove ${stopTitle(stop)} from this trip`}
                          className="shrink-0 rounded-full border border-slate-300 dark:border-slate-700 px-2.5 py-1 text-xs font-medium text-slate-500 dark:text-slate-400 hover:border-flag-500 hover:text-flag-700 dark:hover:text-flag-300"
                        >
                          Remove
                        </button>
                      )}
                    </div>
                    {stop.notes && (
                      <p className="mt-1 flex items-center gap-1 pl-12 text-xs text-slate-500 dark:text-slate-400">
                        <PencilSquareIcon aria-hidden className="h-3.5 w-3.5 shrink-0" />
                        {stop.notes}
                      </p>
                    )}
                  </li>
                );
              })}
          </ul>
        </div>
      ))}
    </div>
  );
}
