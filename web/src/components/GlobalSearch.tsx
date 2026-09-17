"use client";

import { useEffect, useRef, useState, type ComponentType } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  BuildingStorefrontIcon,
  CalendarDaysIcon,
  ClockIcon,
  MagnifyingGlassIcon,
  MapPinIcon,
  UserCircleIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";
import { getSearchSuggestions } from "@/lib/api";
import { resolveImageUrl, resolveThumbUrl } from "@/lib/images";
import {
  formatBusinessType,
  formatCreatorCategory,
  formatEventCategory,
  formatEventDateRange,
  formatPlaceType,
} from "@/lib/format";
import { SafeImage } from "./SafeImage";
import type { SearchSuggestResponse, SearchSuggestion } from "@/lib/types";

const RECENT_SEARCHES_KEY = "liberia360:recent-searches";
const MAX_RECENT = 6;
const DEBOUNCE_MS = 250;
const MIN_QUERY_LENGTH = 2;

// One row's worth of display data, derived from whichever suggestion kind
// it came from — lets the dropdown, the keyboard-nav flattening, and the
// "go to this result" handler all share one shape instead of switching on
// `kind` three separate times.
type Row = {
  key: string;
  href: string;
  title: string;
  subtitle: string;
  image: string | null;
  Icon: ComponentType<{ className?: string }>;
};

function suggestionToRow(s: SearchSuggestion): Row {
  switch (s.kind) {
    case "place":
      return {
        key: `place-${s.id}`,
        href: `/places/${s.slug}`,
        title: s.name,
        subtitle: `${formatPlaceType(s.type)} · ${s.city}, ${s.county.name}`,
        image: s.image,
        Icon: MapPinIcon,
      };
    case "business":
      return {
        key: `business-${s.id}`,
        href: `/businesses/${s.slug}`,
        title: s.name,
        subtitle: `${formatBusinessType(s.type)} · ${s.city}, ${s.county.name}`,
        image: s.image,
        Icon: BuildingStorefrontIcon,
      };
    case "event": {
      const location = s.place?.name ?? s.locationText ?? s.county.name;
      return {
        key: `event-${s.id}`,
        href: `/events/${s.id}`,
        title: s.name,
        subtitle: `${formatEventDateRange(s.startDate, s.endDate)} · ${location}`,
        image: s.image,
        Icon: CalendarDaysIcon,
      };
    }
    case "creator":
      return {
        key: `creator-${s.id}`,
        href: `/creators/${s.username}`,
        title: s.name,
        subtitle: s.county
          ? `${formatCreatorCategory(s.category)} · ${s.county.name}`
          : formatCreatorCategory(s.category),
        image: s.image,
        Icon: UserCircleIcon,
      };
  }
}

// Bolds the first case-insensitive occurrence of `query` inside `text` —
// the "yes, this is what you typed" confirmation every social app's
// search dropdown gives for free.
function Highlight({ text, query }: { text: string; query: string }) {
  const trimmed = query.trim();
  if (!trimmed) return <>{text}</>;
  const index = text.toLowerCase().indexOf(trimmed.toLowerCase());
  if (index === -1) return <>{text}</>;
  return (
    <>
      {text.slice(0, index)}
      <mark className="rounded-sm bg-gold-200 px-0.5 text-inherit dark:bg-gold-800/60">
        {text.slice(index, index + trimmed.length)}
      </mark>
      {text.slice(index + trimmed.length)}
    </>
  );
}

function loadRecentSearches(): string[] {
  try {
    const raw = localStorage.getItem(RECENT_SEARCHES_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((v) => typeof v === "string") : [];
  } catch {
    return [];
  }
}

function saveRecentSearch(query: string, current: string[]): string[] {
  const next = [query, ...current.filter((r) => r.toLowerCase() !== query.toLowerCase())].slice(
    0,
    MAX_RECENT,
  );
  try {
    localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(next));
  } catch {
    // Private browsing / storage disabled — recent searches just won't
    // persist across sessions, not worth surfacing as an error.
  }
  return next;
}

// The site-wide "smart" search: a debounced, cancellable, as-you-type
// dropdown across every browsable content type (places, businesses,
// events, creators), replacing what used to be a bare link straight to
// the full Search Results page. Owns both the trigger button (so Header
// only needs to render this one component) and the overlay it opens.
export function GlobalSearch() {
  const t = useTranslations("search");
  const router = useRouter();

  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchSuggestResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [recent, setRecent] = useState<string[]>([]);

  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const rowRefs = useRef<Map<string, HTMLButtonElement>>(new Map());

  useEffect(() => {
    if (!open) return;
    setRecent(loadRecentSearches());
    // Deferred one tick so the panel is actually mounted (and the mobile
    // keyboard-triggered viewport resize has started) before stealing
    // focus, same reasoning DestinationAutocomplete-style inputs elsewhere
    // in this app already rely on.
    const id = requestAnimationFrame(() => inputRef.current?.focus());
    return () => cancelAnimationFrame(id);
  }, [open]);

  // Body scroll lock + Escape-to-close, one effect — same pairing
  // MobileFilterSheet uses for its own full-screen overlay.
  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") close();
    }
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKey);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      if (abortRef.current) abortRef.current.abort();
    };
  }, []);

  function close() {
    setOpen(false);
    setQuery("");
    setResults(null);
    setLoading(false);
    setActiveIndex(-1);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (abortRef.current) abortRef.current.abort();
  }

  function handleInput(next: string) {
    setQuery(next);
    setActiveIndex(-1);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (abortRef.current) abortRef.current.abort();

    const trimmed = next.trim();
    if (trimmed.length < MIN_QUERY_LENGTH) {
      setResults(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    debounceRef.current = setTimeout(() => {
      const controller = new AbortController();
      abortRef.current = controller;
      getSearchSuggestions(trimmed, controller.signal)
        .then((data) => {
          setResults(data);
          setLoading(false);
        })
        .catch((err) => {
          if (err instanceof DOMException && err.name === "AbortError") return;
          setResults(null);
          setLoading(false);
        });
    }, DEBOUNCE_MS);
  }

  function goTo(href: string, searchTerm: string) {
    setRecent(saveRecentSearch(searchTerm, recent));
    close();
    router.push(href);
  }

  function commitFullSearch(raw: string) {
    const trimmed = raw.trim();
    if (!trimmed) return;
    setRecent(saveRecentSearch(trimmed, recent));
    close();
    router.push(`/search?q=${encodeURIComponent(trimmed)}`);
  }

  function clearRecent() {
    setRecent([]);
    try {
      localStorage.removeItem(RECENT_SEARCHES_KEY);
    } catch {
      // Same "not worth surfacing" reasoning as saveRecentSearch above.
    }
  }

  const rows: Row[] = results
    ? [
        ...results.places.map(suggestionToRow),
        ...results.businesses.map(suggestionToRow),
        ...results.events.map(suggestionToRow),
        ...results.creators.map(suggestionToRow),
      ]
    : [];

  useEffect(() => {
    if (activeIndex < 0) return;
    const row = rows[activeIndex];
    if (row) rowRefs.current.get(row.key)?.scrollIntoView?.({ block: "nearest" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeIndex]);

  function handleKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown" && rows.length > 0) {
      event.preventDefault();
      setActiveIndex((i) => (i + 1) % rows.length);
    } else if (event.key === "ArrowUp" && rows.length > 0) {
      event.preventDefault();
      setActiveIndex((i) => (i <= 0 ? rows.length - 1 : i - 1));
    } else if (event.key === "Enter") {
      event.preventDefault();
      const active = activeIndex >= 0 ? rows[activeIndex] : undefined;
      if (active) goTo(active.href, active.title);
      else commitFullSearch(query);
    }
  }

  const trimmedQuery = query.trim();
  const showRecentAndHints = trimmedQuery.length < MIN_QUERY_LENGTH;
  const groups: { label: string; items: SearchSuggestion[] }[] = results
    ? [
        { label: t("sectionPlaces"), items: results.places },
        { label: t("sectionBusinesses"), items: results.businesses },
        { label: t("sectionEvents"), items: results.events },
        { label: t("sectionCreators"), items: results.creators },
      ].filter((g) => g.items.length > 0)
    : [];

  let rowCursor = 0;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={t("searchAriaLabel")}
        className="flex min-h-10 items-center gap-1.5 rounded-full border border-white/25 bg-white/10 px-3 py-1.5 text-sm font-semibold text-white/90 transition-all hover:border-white hover:bg-white hover:text-brand-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-400"
      >
        <MagnifyingGlassIcon aria-hidden className="h-4 w-4" />
        <span className="hidden sm:inline">{t("searchAriaLabel")}</span>
      </button>

      {open &&
        typeof document !== "undefined" &&
        // Portalled to <body>, not left in place: this button lives inside
        // <header>, which has `backdrop-blur-xl` — a backdrop-filter
        // establishes a containing block for `position: fixed` descendants
        // exactly like `filter` does, so an un-portalled overlay here would
        // be confined to the header's own ~4.5rem box instead of the
        // viewport. Same bug, same fix, as MobileMenu's own drawer.
        createPortal(
        // z-[9999], not a lower "modal" value — this can open on top of
        // ExploreMapClient/CountyPlacesExplorer's Leaflet map, whose own
        // panes/controls carry z-index up to 1000 (see FilterPopover's and
        // MobileFilterSheet's own doc comments for the exact same lesson).
        <div
          className="fixed inset-0 z-[9999] flex flex-col bg-black/50 backdrop-blur-sm sm:items-center sm:pt-16"
          onClick={close}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label={t("searchAriaLabel")}
            className="flex h-full w-full flex-col bg-white shadow-2xl dark:bg-slate-900 sm:h-auto sm:max-h-[80vh] sm:w-full sm:max-w-2xl sm:overflow-hidden sm:rounded-3xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-2 border-b border-slate-100 p-3 dark:border-slate-800">
              <MagnifyingGlassIcon aria-hidden className="h-5 w-5 shrink-0 text-slate-400" />
              <input
                ref={inputRef}
                type="search"
                role="combobox"
                aria-expanded={rows.length > 0}
                aria-controls="global-search-listbox"
                aria-activedescendant={
                  activeIndex >= 0 ? `global-search-row-${activeIndex}` : undefined
                }
                autoComplete="off"
                value={query}
                onChange={(e) => handleInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={t("quickSearchPlaceholder")}
                aria-label={t("searchAriaLabel")}
                className="min-w-0 flex-1 bg-transparent text-base text-slate-900 outline-none placeholder:text-slate-400 dark:text-slate-50"
              />
              {query && (
                <button
                  type="button"
                  onClick={() => handleInput("")}
                  aria-label={t("clearSearch")}
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800"
                >
                  <XMarkIcon aria-hidden className="h-4 w-4" />
                </button>
              )}
              <button
                type="button"
                onClick={close}
                aria-label={t("close")}
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100 hover:text-slate-700 dark:text-slate-400 dark:hover:bg-slate-800"
              >
                <XMarkIcon aria-hidden className="h-5 w-5" />
              </button>
            </div>

            <div
              id="global-search-listbox"
              role="listbox"
              className="flex-1 overflow-y-auto p-2"
            >
              {showRecentAndHints ? (
                <div className="flex flex-col gap-1 p-2">
                  {recent.length > 0 ? (
                    <>
                      <div className="flex items-center justify-between px-1 pb-1">
                        <p className="text-xs font-bold uppercase tracking-wide text-slate-400 dark:text-slate-500">
                          {t("recentSearches")}
                        </p>
                        <button
                          type="button"
                          onClick={clearRecent}
                          className="text-xs font-semibold text-brand-700 hover:underline dark:text-brand-300"
                        >
                          {t("clearRecentSearches")}
                        </button>
                      </div>
                      {recent.map((term) => (
                        <button
                          key={term}
                          type="button"
                          onClick={() => {
                            setQuery(term);
                            handleInput(term);
                          }}
                          className="flex items-center gap-2.5 rounded-xl px-2 py-2 text-left text-sm text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-800"
                        >
                          <ClockIcon aria-hidden className="h-4 w-4 shrink-0 text-slate-400" />
                          <span className="truncate">{term}</span>
                        </button>
                      ))}
                    </>
                  ) : (
                    <p className="px-2 py-6 text-center text-sm text-slate-400 dark:text-slate-500">
                      {t("startTyping")}
                    </p>
                  )}
                </div>
              ) : loading ? (
                <div className="flex flex-col gap-2 p-2">
                  {[0, 1, 2].map((i) => (
                    <div key={i} className="flex animate-pulse items-center gap-3 rounded-xl px-2 py-2">
                      <div className="h-11 w-11 shrink-0 rounded-lg bg-slate-200 dark:bg-slate-800" />
                      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                        <div className="h-3 w-2/3 rounded bg-slate-200 dark:bg-slate-800" />
                        <div className="h-2.5 w-1/3 rounded bg-slate-200 dark:bg-slate-800" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : rows.length === 0 ? (
                <p className="px-3 py-8 text-center text-sm text-slate-400 dark:text-slate-500">
                  {t("noSuggestions", { query: trimmedQuery })}
                </p>
              ) : (
                <div className="flex flex-col gap-3">
                  {groups.map((group) => (
                    <div key={group.label}>
                      <p className="px-2 pb-1 text-xs font-bold uppercase tracking-wide text-slate-400 dark:text-slate-500">
                        {group.label}
                      </p>
                      <div className="flex flex-col gap-0.5">
                        {group.items.map((suggestion) => {
                          const row = suggestionToRow(suggestion);
                          const index = rowCursor;
                          rowCursor += 1;
                          const thumb = row.image ? resolveThumbUrl(row.image) : null;
                          const full = row.image ? resolveImageUrl(row.image) : null;
                          return (
                            <button
                              key={row.key}
                              id={`global-search-row-${index}`}
                              ref={(el) => {
                                if (el) rowRefs.current.set(row.key, el);
                                else rowRefs.current.delete(row.key);
                              }}
                              role="option"
                              aria-selected={activeIndex === index}
                              type="button"
                              onMouseEnter={() => setActiveIndex(index)}
                              onClick={() => goTo(row.href, row.title)}
                              className={`flex items-center gap-3 rounded-xl px-2 py-2 text-left transition-colors ${
                                activeIndex === index
                                  ? "bg-brand-50 dark:bg-brand-950/40"
                                  : "hover:bg-slate-50 dark:hover:bg-slate-800"
                              }`}
                            >
                              <SafeImage
                                src={full}
                                thumbSrc={thumb}
                                alt=""
                                className="h-11 w-11 shrink-0 rounded-lg object-cover"
                                fallback={
                                  <div
                                    aria-hidden
                                    className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-slate-100 dark:bg-slate-800"
                                  >
                                    <row.Icon className="h-5 w-5 text-slate-400" />
                                  </div>
                                }
                              />
                              <span className="min-w-0 flex-1">
                                <span className="block truncate text-sm font-semibold text-slate-900 dark:text-slate-50">
                                  <Highlight text={row.title} query={trimmedQuery} />
                                </span>
                                <span className="block truncate text-xs text-slate-500 dark:text-slate-400">
                                  {row.subtitle}
                                </span>
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {!showRecentAndHints && (
              <button
                type="button"
                onClick={() => commitFullSearch(query)}
                className="border-t border-slate-100 p-3 text-center text-sm font-semibold text-brand-700 hover:bg-slate-50 dark:border-slate-800 dark:text-brand-300 dark:hover:bg-slate-800"
              >
                {t("seeAllResultsFor", { query: trimmedQuery })}
              </button>
            )}
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}
