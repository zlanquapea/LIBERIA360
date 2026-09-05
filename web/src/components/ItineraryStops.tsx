import Link from 'next/link';
import { PencilSquareIcon } from '@heroicons/react/24/solid';
import { formatPlaceType } from '@/lib/format';
import { CategoryIcon } from '@/lib/icons';
import type { ItineraryStopWithPlace } from '@/lib/types';

// Groups an itinerary's resolved stops by day (Tech Spec §4.3) — the same
// trip detail view renders an older Weekend Explorer trip too (retired
// feature, but existing ones still show fine — same ItineraryDetail
// shape). `onRemove` is only passed for a
// collaborative trip's detail view where the viewer can actually edit it —
// the read-only generation-result views leave it undefined.
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
export function ItineraryStops({
  stops,
  onRemove,
}: {
  stops: ItineraryStopWithPlace[];
  onRemove?: (placeId: string) => void;
}) {
  const byDay = new Map<number, ItineraryStopWithPlace[]>();
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
              .map((stop) => (
                <li key={`${stop.day}-${stop.order}-${stop.place.id}`}>
                  <div className="flex items-center gap-2 rounded-xl border border-slate-200 dark:border-slate-800 p-3 transition-all hover:-translate-y-0.5 hover:border-brand-500 hover:shadow-card">
                    <Link
                      href={`/places/${stop.place.slug}`}
                      className="flex min-w-0 flex-1 items-center gap-3"
                    >
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent-600 text-lg text-white">
                        <CategoryIcon iconKey={stop.place.category.icon} categorySlug={stop.place.category.slug} className="h-4 w-4" />
                      </span>
                      <div className="min-w-0">
                        <p className="truncate font-medium text-slate-900 dark:text-slate-50">{stop.place.name}</p>
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          {formatPlaceType(stop.place.type)} · {stop.place.city}
                        </p>
                      </div>
                    </Link>
                    {onRemove && (
                      <button
                        type="button"
                        onClick={() => onRemove(stop.place.id)}
                        aria-label={`Remove ${stop.place.name} from this trip`}
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
              ))}
          </ul>
        </div>
      ))}
    </div>
  );
}
