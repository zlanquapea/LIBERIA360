import Link from 'next/link';
import { formatPlaceType } from '@/lib/format';
import type { ItineraryStopWithPlace } from '@/lib/types';

// Groups an itinerary's resolved stops by day (Tech Spec §4.3) — shared
// between the trip and Weekend Explorer detail views, since both produce
// the same ItineraryDetail shape.
export function ItineraryStops({ stops }: { stops: ItineraryStopWithPlace[] }) {
  const byDay = new Map<number, ItineraryStopWithPlace[]>();
  for (const stop of stops) {
    const list = byDay.get(stop.day) ?? [];
    list.push(stop);
    byDay.set(stop.day, list);
  }
  const days = [...byDay.keys()].sort((a, b) => a - b);

  if (days.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-slate-300 px-4 py-8 text-center text-slate-500">
        No stops in this itinerary.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      {days.map((day) => (
        <div key={day} className="flex flex-col gap-2">
          <h2 className="font-semibold text-slate-900">Day {day}</h2>
          <ul className="flex flex-col gap-2">
            {byDay
              .get(day)!
              .sort((a, b) => a.order - b.order)
              .map((stop) => (
                <li key={`${stop.day}-${stop.order}-${stop.place.id}`}>
                  <Link
                    href={`/places/${stop.place.slug}`}
                    className="flex items-center gap-3 rounded-xl border border-slate-200 p-3 hover:border-brand-500"
                  >
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent-600 text-lg text-white">
                      {stop.place.category.icon ?? '📍'}
                    </span>
                    <div className="min-w-0">
                      <p className="truncate font-medium text-slate-900">{stop.place.name}</p>
                      <p className="text-xs text-slate-500">
                        {formatPlaceType(stop.place.type)} · {stop.place.city}
                      </p>
                    </div>
                  </Link>
                </li>
              ))}
          </ul>
        </div>
      ))}
    </div>
  );
}
