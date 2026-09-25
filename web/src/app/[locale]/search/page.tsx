import Link from "next/link";
import {
  MagnifyingGlassIcon,
  ArrowLeftIcon,
  ArrowRightIcon,
} from "@heroicons/react/24/outline";
import { getTranslations } from "next-intl/server";
import {
  getActiveAdvertisements,
  getBusinesses,
  getCarListings,
  getCategories,
  getCounties,
  getCreators,
  getEvents,
  getExperiences,
  getGuides,
  getPlaces,
} from "@/lib/api";
import { findMatchingCategory } from "@/lib/category-match";
import { PlaceCard } from "@/components/PlaceCard";
import { SearchFilters } from "@/components/SearchFilters";
import { QuickFilterChips } from "@/components/QuickFilterChips";
import { AdvertisementBanner } from "@/components/AdvertisementBanner";
import type { Category, PlaceSort, PlacesQuery, PlaceType } from "@/lib/types";

export const metadata = { title: "Search — LIBERIA360" };

type SearchParams = { [key: string]: string | string[] | undefined };

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

// Search Results screen — filterable, sortable list (Tech Spec §4.1).
export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const t = await getTranslations("search");
  const params = await searchParams;
  const q = first(params.q)?.trim().slice(0, 100);
  const category = first(params.category);
  const county = first(params.county);
  const type = first(params.type) as PlaceType | undefined;
  const sort = (first(params.sort) as PlaceSort | undefined) ?? "featured";
  const page = Number(first(params.page) ?? "1") || 1;
  const openNow = first(params.openNow) === "true";
  const priceMinRaw = first(params.priceMin);
  const priceMaxRaw = first(params.priceMax);
  const priceMin = priceMinRaw !== undefined ? Number(priceMinRaw) : undefined;
  const priceMax = priceMaxRaw !== undefined ? Number(priceMaxRaw) : undefined;

  const query: PlacesQuery = {
    q,
    category,
    county,
    type,
    sort,
    page,
    limit: 12,
    openNow: openNow || undefined,
    priceMin,
    priceMax,
  };

  // The place filters still scope places. Cross-category discovery is shown
  // only on the first page of a text search, so pagination stays predictable.
  const discover = Boolean(q && q.length >= 2 && page === 1);
  const [
    categories,
    counties,
    result,
    ads,
    businesses,
    events,
    creators,
    guides,
    experiences,
    cars,
  ] = await Promise.all([
    getCategories(),
    getCounties(),
    getPlaces(query),
    page === 1 ? getActiveAdvertisements(6) : Promise.resolve([]),
    discover ? getBusinesses({ search: q, limit: 4 }) : Promise.resolve(null),
    discover ? getEvents({ search: q, limit: 4 }) : Promise.resolve(null),
    discover ? getCreators({ search: q, limit: 4 }) : Promise.resolve(null),
    discover ? getGuides({ search: q }) : Promise.resolve([]),
    discover ? getExperiences({ search: q }) : Promise.resolve([]),
    discover ? getCarListings({ search: q, limit: 4 }) : Promise.resolve(null),
  ]);
  const otherSections = discover
    ? [
        {
          title: t("sectionBusinesses"),
          total: businesses?.meta.total ?? 0,
          href: `/businesses?search=${encodeURIComponent(q!)}`,
          items:
            businesses?.data.map((item) => ({
              id: item.id,
              title: item.name,
              detail: `${item.linkedPlace.city}, ${item.linkedPlace.county.name}`,
              href: `/businesses/${item.slug}`,
            })) ?? [],
        },
        {
          title: t("sectionEvents"),
          total: events?.meta.total ?? 0,
          href: `/events?search=${encodeURIComponent(q!)}`,
          items:
            events?.data.map((item) => ({
              id: item.id,
              title: item.name,
              detail: item.place?.name ?? item.locationText ?? item.county.name,
              href: `/events/${item.id}`,
            })) ?? [],
        },
        {
          title: t("sectionCreators"),
          total: creators?.meta.total ?? 0,
          href: null,
          items:
            creators?.data.map((item) => ({
              id: item.id,
              title: item.name,
              detail: item.county?.name ?? item.category.replaceAll("_", " "),
              href: `/creators/${item.username}`,
            })) ?? [],
        },
        {
          title: t("sectionGuides"),
          total: guides.length,
          href: `/guides?search=${encodeURIComponent(q!)}`,
          items: guides.slice(0, 4).map((item) => ({
            id: item.id,
            title: item.slug.replaceAll("-", " "),
            detail: `${item.city}${item.county?.name ? `, ${item.county.name}` : ""}`,
            href: `/guides/${item.slug}`,
          })),
        },
        {
          title: t("sectionExperiences"),
          total: experiences.length,
          href: null,
          items: experiences.slice(0, 8).map((item) => ({
            id: item.id,
            title: item.title,
            detail: item.county,
            href: `/experiences/${item.id}`,
          })),
        },
        {
          title: t("sectionCars"),
          total: cars?.meta.total ?? 0,
          href: `/car-rentals?search=${encodeURIComponent(q!)}`,
          items:
            cars?.data.map((item) => ({
              id: item.id,
              title: item.title,
              detail: item.pickupLocation ?? item.county?.name ?? "",
              href: `/car-rentals/${item.id}`,
            })) ?? [],
        },
      ].filter((section) => section.total > 0)
    : [];

  function pageHref(targetPage: number) {
    const p = new URLSearchParams();
    if (q) p.set("q", q);
    if (category) p.set("category", category);
    if (county) p.set("county", county);
    if (type) p.set("type", type);
    if (sort) p.set("sort", sort);
    if (openNow) p.set("openNow", "true");
    if (priceMinRaw !== undefined) p.set("priceMin", priceMinRaw);
    if (priceMaxRaw !== undefined) p.set("priceMax", priceMaxRaw);
    p.set("page", String(targetPage));
    return `/search?${p.toString()}`;
  }

  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-4 px-4 py-6">
      <form
        action="/search"
        method="GET"
        className="flex overflow-hidden rounded-full border border-slate-300 dark:border-slate-700 transition-shadow focus-within:ring-2 focus-within:ring-brand-400"
      >
        {/* This plain GET form only ever submits its own fields — a native
            submit replaces the whole query string, so a `type` scoping the
            page (from AddTripStop's "Browse all stays" link) would
            otherwise vanish the moment someone searches from here. */}
        {type && <input type="hidden" name="type" value={type} />}
        <input
          type="search"
          name="q"
          defaultValue={q}
          placeholder={t("searchPlaceholder")}
          className="w-full px-4 py-2.5 text-sm outline-none"
        />
        <button
          type="submit"
          className="flex items-center px-4 text-slate-600 dark:text-slate-300 transition-colors hover:bg-slate-50 dark:hover:bg-slate-800"
          aria-label={t("searchAriaLabel")}
        >
          <MagnifyingGlassIcon aria-hidden className="h-5 w-5" />
        </button>
      </form>

      <QuickFilterChips surface="light" />
      <SearchFilters categories={categories} counties={counties} />

      {otherSections.map((section) => (
        <section
          key={section.title}
          aria-label={section.title}
          className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900"
        >
          <div className="mb-2 flex items-center justify-between gap-3">
            <h2 className="font-display text-lg font-bold text-slate-900 dark:text-white">
              {section.title}{" "}
              <span className="text-sm font-normal text-slate-500">
                ({section.total})
              </span>
            </h2>
            {section.href && (
              <Link
                href={section.href}
                className="shrink-0 text-sm font-semibold text-brand-700 hover:underline dark:text-brand-300"
              >
                {t("viewAllCategory")}
              </Link>
            )}
          </div>
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {section.items.map((item) => (
              <Link
                key={item.id}
                href={item.href}
                className="flex min-h-14 items-center justify-between gap-3 py-2 hover:text-brand-700 dark:hover:text-brand-300"
              >
                <span className="min-w-0">
                  <span className="block truncate font-medium">
                    {item.title}
                  </span>
                  <span className="block truncate text-xs text-slate-500 dark:text-slate-400">
                    {item.detail}
                  </span>
                </span>
                <ArrowRightIcon aria-hidden className="h-4 w-4 shrink-0" />
              </Link>
            ))}
          </div>
        </section>
      ))}

      <p className="text-sm text-slate-500 dark:text-slate-400">
        {discover && `${t("sectionPlaces")}: `}
        {t("resultCount", { count: result.meta.total })}
        {q && ` ${t("resultCountForQuery", { query: q })}`}
      </p>

      {result.data.length === 0 && otherSections.length === 0 ? (
        <ZeroResultsRecovery
          q={q}
          categories={categories}
          hasFilters={Boolean(
            category ||
            county ||
            type ||
            openNow ||
            priceMinRaw !== undefined ||
            priceMaxRaw !== undefined,
          )}
          t={t}
        />
      ) : result.data.length > 0 ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {result.data.map((place, i) => (
            <PlaceCard key={place.id} place={place} index={i} />
          ))}
        </div>
      ) : null}

      {page === 1 && <AdvertisementBanner ads={ads} />}

      <p className="rounded-xl border border-dashed border-slate-300 dark:border-slate-700 px-4 py-3 text-center text-sm text-slate-500 dark:text-slate-400">
        {t("dontSeeDestination")}{" "}
        <Link
          href="/places/submit"
          className="font-medium text-brand-700 dark:text-brand-300 hover:underline"
        >
          {t("addToLiberia360")}
        </Link>
      </p>

      {result.meta.totalPages > 1 && (
        <div className="flex items-center justify-between pt-2">
          <Link
            href={pageHref(page - 1)}
            aria-disabled={page <= 1}
            className={`flex items-center gap-1 text-sm font-medium ${page <= 1 ? "pointer-events-none text-slate-300 dark:text-slate-700" : "text-brand-700 dark:text-brand-300 hover:underline"}`}
          >
            <ArrowLeftIcon
              aria-hidden
              className="h-3.5 w-3.5 rtl:-scale-x-100"
            />
            {t("previous")}
          </Link>
          <span className="text-sm text-slate-500 dark:text-slate-400">
            {t("pageOf", {
              page: result.meta.page,
              totalPages: result.meta.totalPages,
            })}
          </span>
          <Link
            href={pageHref(page + 1)}
            aria-disabled={page >= result.meta.totalPages}
            className={`flex items-center gap-1 text-sm font-medium ${
              page >= result.meta.totalPages
                ? "pointer-events-none text-slate-300 dark:text-slate-700"
                : "text-brand-700 dark:text-brand-300 hover:underline"
            }`}
          >
            {t("next")}
            <ArrowRightIcon
              aria-hidden
              className="h-3.5 w-3.5 rtl:-scale-x-100"
            />
          </Link>
        </div>
      )}
    </main>
  );
}

// Product review readout (Aug 22, 2026): a zero-result search used to be a
// dead end — a bare "no places match" with no way forward besides
// re-typing. This routes a visitor toward whatever's actually likely to
// help: the matching category if the query is close to one (or already
// filtered), a link to browse everything, and a way to clear an
// over-narrow filter combination.
function ZeroResultsRecovery({
  q,
  categories,
  hasFilters,
  t,
}: {
  q?: string;
  categories: Category[];
  hasFilters: boolean;
  t: Awaited<ReturnType<typeof getTranslations>>;
}) {
  const suggestedCategory = q ? findMatchingCategory(categories, q) : null;

  return (
    <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-slate-300 dark:border-slate-700 px-4 py-8 text-center">
      <p className="text-slate-500 dark:text-slate-400">
        {q
          ? hasFilters
            ? t("noResultsQueryFiltered", { query: q })
            : t("noResultsQuery", { query: q })
          : t("noResultsFiltered")}
      </p>
      <div className="flex flex-wrap items-center justify-center gap-2">
        {suggestedCategory && (
          <Link
            href={`/search?category=${suggestedCategory.slug}`}
            className="rounded-full bg-brand-700 px-4 py-1.5 text-sm font-medium text-white hover:bg-brand-800"
          >
            {t("browseCategoryName", { name: suggestedCategory.name })}
          </Link>
        )}
        {(q || hasFilters) && (
          <Link
            href="/search"
            className="rounded-full border border-slate-300 dark:border-slate-700 px-4 py-1.5 text-sm font-medium text-slate-700 dark:text-slate-200 hover:border-brand-500 hover:text-brand-700 dark:hover:text-brand-300"
          >
            {t("clearSearch")}
          </Link>
        )}
      </div>
    </div>
  );
}
