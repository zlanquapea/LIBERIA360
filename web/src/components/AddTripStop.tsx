'use client';

import { useRef, useState } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { ArrowTopRightOnSquareIcon, CalendarDaysIcon, HomeIcon, MapPinIcon, TruckIcon } from '@heroicons/react/24/outline';
import { useAuth } from '@/hooks/useAuth';
import { getPlaces, getEvents, getCarListings } from '@/lib/api';
import { addItineraryStop } from '@/lib/itinerary-api';
import { formatCarCategory, formatCost, formatEventDateRange } from '@/lib/format';
import { HttpError } from '@/lib/http';
import type { Place, Event, CarListing } from '@/lib/types';

type Tab = 'place' | 'stay' | 'event' | 'carListing';

type TabResult = Place | Event | CarListing;

const TABS: { key: Tab; icon: typeof MapPinIcon }[] = [
  { key: 'place', icon: MapPinIcon },
  { key: 'stay', icon: HomeIcon },
  { key: 'event', icon: CalendarDaysIcon },
  { key: 'carListing', icon: TruckIcon },
];

function resultTitle(tab: Tab, item: TabResult): string {
  if (tab === 'carListing') return (item as CarListing).title;
  return (item as Place | Event).name;
}

function resultSubtitle(tab: Tab, item: TabResult): string | null {
  if (tab === 'event') {
    const event = item as Event;
    return formatEventDateRange(event.startDate, event.endDate);
  }
  if (tab === 'carListing') {
    const listing = item as CarListing;
    return `${formatCarCategory(listing.category)} · ${formatCost(listing.pricePerDay)}/day`;
  }
  return null;
}

// Where "view this before deciding" goes — the same catalog detail page
// AddToTripButton offers "add to trip" from on the other side of this same
// flow, opened in a new tab so browsing photos/reviews/pricing doesn't lose
// this picker's search results, tab, and day selection.
function resultHref(tab: Tab, item: TabResult): string {
  if (tab === 'event') return `/events/${item.id}`;
  if (tab === 'carListing') return `/car-rentals/${item.id}`;
  return `/places/${(item as Place).slug}`;
}

// The inline search above only ever shows 5 results — plenty for "I know
// what I'm looking for," not for "show me what's out there." This is the
// door to the real catalog page (with its own filters — category, price,
// transmission, etc. for cars) for the other kind of browsing, same
// new-tab reasoning as resultHref above. Each catalog card offers its own
// quick "add to trip" too (see CarListingCard), so someone can go explore
// and add straight from there instead of coming back to search again.
function browseAllHref(tab: Tab): string {
  if (tab === 'event') return '/events';
  if (tab === 'carListing') return '/car-rentals';
  return '/explore';
}

// Owner or any collaborator can add a stop — searches the catalog by name
// rather than requiring an id, since that's how someone actually finds a
// place/event/car while planning ("let's add that waterfall Marcus found").
//
// Widened (Sep 2026, "make trip planning the platform's focus" product
// review) from a single place search box into a tabbed picker across the
// three things a trip's day can now hold — see ItineraryStopDetail.
export function AddTripStop({
  itineraryId,
  durationDays,
  onAdded,
}: {
  itineraryId: string;
  durationDays: number;
  onAdded: () => void;
}) {
  const t = useTranslations('trips');
  const { token } = useAuth();
  const [tab, setTab] = useState<Tab>('place');
  const [query, setQuery] = useState('');
  const [day, setDay] = useState(1);
  const [results, setResults] = useState<TabResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [addingId, setAddingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Bumped on every tab switch so a search still in flight from the
  // previous tab can tell, once it resolves, that it's no longer current —
  // otherwise its results land under the new tab with the wrong shape
  // (e.g. a place rendered as if it were an event), and since each result
  // now links to a detail page keyed off the *current* tab, that stale
  // result would link to a route that 404s.
  const searchTokenRef = useRef(0);

  function switchTab(next: Tab) {
    searchTokenRef.current += 1;
    setTab(next);
    setResults([]);
    setError(null);
    // The stale request's own `finally` is now gated behind the token
    // check above, so it won't clear this — otherwise the new tab stays
    // stuck showing "Searching…" until another search happens to fire.
    setSearching(false);
  }

  async function search() {
    const q = query.trim();
    if (!q) return;
    const searchToken = searchTokenRef.current;
    setSearching(true);
    setError(null);
    try {
      const res =
        tab === 'place'
          ? await getPlaces({ q, limit: 5 })
          : tab === 'stay'
            ? await getPlaces({ q, type: 'hotel', limit: 5 })
            : tab === 'event'
              ? await getEvents({ search: q, limit: 5 })
              : await getCarListings({ search: q, limit: 5 });
      if (searchTokenRef.current === searchToken) setResults(res.data);
    } catch {
      if (searchTokenRef.current === searchToken) setError(t('searchFailed'));
    } finally {
      if (searchTokenRef.current === searchToken) setSearching(false);
    }
  }

  async function add(item: TabResult) {
    if (!token) return;
    setAddingId(item.id);
    setError(null);
    try {
      const input =
        tab === 'place' || tab === 'stay'
          ? { placeId: item.id, day }
          : tab === 'event'
            ? { eventId: item.id, day }
            : { carListingId: item.id, day };
      await addItineraryStop(token, itineraryId, input);
      setResults((prev) => prev.filter((r) => r.id !== item.id));
      onAdded();
    } catch (err) {
      setError(err instanceof HttpError ? err.message : t('couldNotAddPlace'));
    } finally {
      setAddingId(null);
    }
  }

  return (
    <section className="flex flex-col gap-2 rounded-xl border border-dashed border-slate-300 dark:border-slate-700 p-3">
      <p className="text-sm font-medium text-slate-700 dark:text-slate-200">{t('addAPlace')}</p>

      <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {TABS.map(({ key, icon: Icon }) => (
          <button
            key={key}
            type="button"
            onClick={() => switchTab(key)}
            className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${
              tab === key
                ? 'border-brand-600 bg-brand-600 text-white'
                : 'border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-brand-400'
            }`}
          >
            <Icon aria-hidden className="h-3.5 w-3.5" />
            {t(`tab.${key}`)}
          </button>
        ))}
      </div>

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
          placeholder={t(`searchPlaceholder.${tab}`)}
          className="min-w-0 flex-1 rounded-lg border border-slate-300 dark:border-slate-700 px-3 py-1.5 text-sm outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
        />
        <button
          type="button"
          disabled={searching || !query.trim()}
          onClick={search}
          className="shrink-0 rounded-full border border-slate-300 dark:border-slate-700 px-3 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-200 hover:border-brand-500 hover:text-brand-700 dark:hover:text-brand-300 disabled:opacity-60"
        >
          {searching ? t('searching') : t('search')}
        </button>
      </div>

      <Link
        href={browseAllHref(tab)}
        target="_blank"
        rel="noopener noreferrer"
        className="group inline-flex w-fit items-center gap-1 text-xs font-medium text-brand-700 hover:underline dark:text-brand-300"
      >
        {t(`browseAll.${tab}`)}
        <ArrowTopRightOnSquareIcon aria-hidden className="h-3 w-3" />
      </Link>

      {durationDays > 1 && (
        <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {Array.from({ length: durationDays }, (_, i) => i + 1).map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => setDay(d)}
              className={`shrink-0 rounded-full border px-3 py-1 text-xs font-semibold transition-colors ${
                day === d
                  ? 'border-brand-600 bg-brand-600 text-white'
                  : 'border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-brand-400'
              }`}
            >
              {t('dayChip', { day: d })}
            </button>
          ))}
        </div>
      )}

      {error && <p className="text-xs text-flag-700 dark:text-flag-300">{error}</p>}

      {results.length > 0 && (
        <ul className="flex flex-col gap-1.5">
          {results.map((item) => {
            const subtitle = resultSubtitle(tab, item);
            return (
              <li
                key={item.id}
                className="flex items-center gap-2 rounded-lg border border-slate-200 dark:border-slate-800 pl-3 pr-1.5 py-1.5 hover:border-brand-500"
              >
                <Link
                  href={resultHref(tab, item)}
                  target="_blank"
                  rel="noopener noreferrer"
                  title={t('viewDetails')}
                  className="group flex min-w-0 flex-1 items-center gap-1 text-sm"
                >
                  <span className="min-w-0 truncate">
                    <span className="truncate group-hover:underline">{resultTitle(tab, item)}</span>
                    {subtitle && (
                      <span className="block truncate text-xs text-slate-500 dark:text-slate-400">
                        {subtitle}
                      </span>
                    )}
                  </span>
                  <ArrowTopRightOnSquareIcon
                    aria-hidden
                    className="h-3.5 w-3.5 shrink-0 text-slate-400 opacity-0 transition-opacity group-hover:opacity-100"
                  />
                </Link>
                <button
                  type="button"
                  disabled={addingId === item.id}
                  onClick={() => add(item)}
                  className="shrink-0 rounded-full border border-brand-600 px-2.5 py-1 text-xs font-semibold text-brand-700 hover:bg-brand-50 disabled:opacity-60 dark:border-brand-400 dark:text-brand-300 dark:hover:bg-brand-950/30"
                >
                  {addingId === item.id ? t('adding') : t('addToDay', { day })}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
