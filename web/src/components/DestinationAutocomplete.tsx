'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { MapPinIcon } from '@heroicons/react/24/outline';
import { getPlaces } from '@/lib/api';
import type { Place } from '@/lib/types';

// "Choose a LIBERIA360 destination" (Section 2 of the Aug 2026 social-trip
// spec) — a debounced type-ahead against the real catalog instead of a
// free-text field, so a trip's destination is always a real Place with a
// real page to link to, not uncontrolled text. Mirrors the "search box on
// top of a picker" shape PlaceLocationPicker already uses for coordinates,
// just for a name instead of a map click.
export function DestinationAutocomplete({
  value,
  onChange,
}: {
  value: Place | null;
  onChange: (place: Place) => void;
}) {
  const [query, setQuery] = useState(value?.name ?? '');
  const [results, setResults] = useState<Place[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [open, setOpen] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setQuery(value?.name ?? '');
  }, [value]);

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  function handleInput(next: string) {
    setQuery(next);
    setOpen(true);
    // Typing away from the selected destination's name un-selects it —
    // the caller shouldn't keep a stale Place once the text no longer
    // matches what's actually chosen.
    if (value && next !== value.name) onChange(null as unknown as Place);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (next.trim().length < 2) {
      setResults(null);
      return;
    }
    setSearching(true);
    debounceRef.current = setTimeout(async () => {
      try {
        const page = await getPlaces({ q: next.trim(), limit: 8 });
        setResults(page.data);
      } catch {
        setResults([]);
      } finally {
        setSearching(false);
      }
    }, 300);
  }

  function pick(place: Place) {
    onChange(place);
    setQuery(place.name);
    setResults(null);
    setOpen(false);
  }

  return (
    <div className="relative flex flex-col gap-1 text-sm font-medium text-slate-700 dark:text-slate-200">
      Destination
      <input
        type="text"
        required
        placeholder="e.g. Robertsport"
        value={query}
        onChange={(e) => handleInput(e.target.value)}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        autoComplete="off"
        className="rounded-lg border border-slate-300 dark:border-slate-700 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
      />
      {open && (searching || (results && results.length > 0)) && (
        <ul className="absolute top-full z-[100] mt-1 w-full rounded-lg border border-slate-200 bg-white shadow-lg dark:border-slate-700 dark:bg-slate-900">
          {searching && (
            <li className="px-3 py-2 text-xs text-slate-400">Searching…</li>
          )}
          {!searching &&
            results?.map((place) => (
              <li key={place.id}>
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => pick(place)}
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-slate-50 dark:hover:bg-slate-800"
                >
                  <MapPinIcon aria-hidden className="h-4 w-4 shrink-0 text-brand-600 dark:text-brand-300" />
                  <span className="min-w-0">
                    <span className="block truncate font-medium text-slate-900 dark:text-slate-50">{place.name}</span>
                    <span className="block truncate text-xs text-slate-500 dark:text-slate-400">
                      {place.city}, {place.county.name}
                    </span>
                  </span>
                </button>
              </li>
            ))}
        </ul>
      )}
      {!searching && open && results && results.length === 0 && query.trim().length >= 2 && (
        <p className="absolute top-full z-[100] mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-500 shadow-lg dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400">
          No matching places. Try a different spelling, or{' '}
          <Link href="/places/submit" className="font-medium text-brand-700 hover:underline dark:text-brand-300">
            add it to the catalog
          </Link>
          .
        </p>
      )}
    </div>
  );
}
