'use client';

import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { getPlaces } from '@/lib/api';
import { addItineraryStop } from '@/lib/itinerary-api';
import { HttpError } from '@/lib/http';
import type { Place } from '@/lib/types';

// Owner or any collaborator can add a stop — searches the catalog by name
// rather than requiring a place id, since that's how someone actually
// finds a place while planning ("let's add that waterfall Marcus found").
export function AddTripStop({
  itineraryId,
  durationDays,
  onAdded,
}: {
  itineraryId: string;
  durationDays: number;
  onAdded: () => void;
}) {
  const { token } = useAuth();
  const [query, setQuery] = useState('');
  const [day, setDay] = useState(1);
  const [results, setResults] = useState<Place[]>([]);
  const [searching, setSearching] = useState(false);
  const [addingId, setAddingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function search() {
    const q = query.trim();
    if (!q) return;
    setSearching(true);
    setError(null);
    try {
      const res = await getPlaces({ q, limit: 5 });
      setResults(res.data);
    } catch {
      setError('Search failed — try again.');
    } finally {
      setSearching(false);
    }
  }

  async function add(placeId: string) {
    if (!token) return;
    setAddingId(placeId);
    setError(null);
    try {
      await addItineraryStop(token, itineraryId, { placeId, day });
      setResults((prev) => prev.filter((p) => p.id !== placeId));
      onAdded();
    } catch (err) {
      setError(err instanceof HttpError ? err.message : 'Could not add this stop.');
    } finally {
      setAddingId(null);
    }
  }

  return (
    <section className="flex flex-col gap-2 rounded-xl border border-dashed border-slate-300 dark:border-slate-700 p-3">
      <p className="text-sm font-medium text-slate-700 dark:text-slate-200">Add a stop</p>
      <div className="flex gap-2">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              search();
            }
          }}
          placeholder="Search places…"
          className="min-w-0 flex-1 rounded-lg border border-slate-300 dark:border-slate-700 px-3 py-1.5 text-sm outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
        />
        <input
          type="number"
          min={1}
          max={Math.max(durationDays, 30)}
          value={day}
          onChange={(e) => setDay(Math.max(1, Number(e.target.value) || 1))}
          aria-label="Day"
          className="w-16 shrink-0 rounded-lg border border-slate-300 dark:border-slate-700 px-2 py-1.5 text-sm outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
        />
        <button
          type="button"
          disabled={searching || !query.trim()}
          onClick={search}
          className="shrink-0 rounded-full border border-slate-300 dark:border-slate-700 px-3 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-200 hover:border-brand-500 hover:text-brand-700 dark:hover:text-brand-300 disabled:opacity-60"
        >
          {searching ? 'Searching…' : 'Search'}
        </button>
      </div>

      {error && <p className="text-xs text-flag-700 dark:text-flag-300">{error}</p>}

      {results.length > 0 && (
        <ul className="flex flex-col gap-1.5">
          {results.map((place) => (
            <li key={place.id}>
              <button
                type="button"
                disabled={addingId === place.id}
                onClick={() => add(place.id)}
                className="flex w-full items-center justify-between gap-2 rounded-lg border border-slate-200 dark:border-slate-800 px-3 py-1.5 text-left text-sm hover:border-brand-500 disabled:opacity-60"
              >
                <span className="truncate">{place.name}</span>
                <span className="shrink-0 text-xs font-medium text-brand-700 dark:text-brand-300">
                  {addingId === place.id ? 'Adding…' : `+ Day ${day}`}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
