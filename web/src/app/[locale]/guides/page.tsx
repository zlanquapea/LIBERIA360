import { FeatureNavigation } from "@/components/FeatureNavigation";
import Link from "next/link";
import { getGuides, getCounties } from "@/lib/api";
import {
  MapPinIcon,
  CheckBadgeIcon,
  StarIcon,
} from "@heroicons/react/24/solid";

export const metadata = {
  title: "Trip Guides & Hosts — LIBERIA360",
  description: "Explore Liberia with local guides and hosts.",
};
type SearchParams = Record<string, string | string[] | undefined>;
const first = (value: string | string[] | undefined) =>
  Array.isArray(value) ? value[0] : value;
const label = (value: string) =>
  value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());

export default async function GuidesPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const search = first(params.search);
  const county = first(params.county);
  const language = first(params.language);
  const rawCategory = first(params.category);
  const category =
    (
      {
        city: "tour_guide",
        culture: "cultural_host",
        nature: "nature_guide",
        food: "food_host",
      } as Record<string, string>
    )[rawCategory ?? ""] ?? rawCategory;
  const role =
    first(params.role) === "hosts" ||
    (!first(params.role) && category?.endsWith("host"))
      ? "hosts"
      : "guides";
  const [guides, counties] = await Promise.all([
    getGuides({ search, county, language }),
    getCounties(),
  ]);
  const visible = guides.filter(
    (guide) =>
      (role === "hosts"
        ? guide.guideType.endsWith("host")
        : !guide.guideType.endsWith("host")) &&
      (!category || guide.guideType === category),
  );
  const tabHref = (next: string) => {
    const query = new URLSearchParams({ role: next });
    if (search) query.set("search", search);
    if (county) query.set("county", county);
    if (language) query.set("language", language);
    return `/guides?${query}`;
  };
  const activeFilters = [
    { key: "search", value: search, text: search },
    {
      key: "county",
      value: county,
      text: counties.find((item) => item.id === county)?.name ?? county,
    },
    {
      key: "category",
      value: category,
      text: category ? label(category) : undefined,
    },
    { key: "language", value: language, text: language },
  ].filter((item) => Boolean(item.value));
  function removeFilter(key: string) {
    const query = new URLSearchParams({ role });
    activeFilters.forEach((item) => {
      if (item.key !== key && item.value) query.set(item.key, item.value);
    });
    return `/guides?${query}`;
  }
  const field =
    "min-h-11 w-full min-w-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 rounded-xl border border-slate-200 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-900";
  return (
    <main className="mx-auto max-w-5xl px-4 py-6 pb-24 sm:px-6">
      <FeatureNavigation />
      <header className="mb-6">
        <p className="text-xs font-bold uppercase tracking-widest text-brand-700 dark:text-brand-300">
          Trip Guides &amp; Hosts
        </p>
        <h1 className="mt-2 font-display text-3xl font-bold tracking-tight sm:text-4xl">
          Find your local expert
        </h1>
        <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">
          Explore Liberia with people who know it.
        </p>
      </header>
      <nav
        aria-label="Find a guide or host"
        className="mb-4 grid grid-cols-2 rounded-2xl bg-slate-100 p-1 dark:bg-slate-800"
      >
        {(["guides", "hosts"] as const).map((item) => (
          <Link
            key={item}
            href={tabHref(item)}
            aria-current={role === item ? "page" : undefined}
            className={`flex min-h-11 items-center justify-center rounded-xl text-sm font-bold ${role === item ? "bg-brand-700 text-white dark:bg-brand-300 dark:text-slate-950" : "text-slate-600 dark:text-slate-300"}`}
          >
            {label(item)}
          </Link>
        ))}
      </nav>
      <p className="mb-4 text-sm text-slate-500 dark:text-slate-400">
        {role === "hosts"
          ? "Meet local hosts for food and cultural experiences."
          : "Find a guide for city walks, nature and adventure."}
      </p>
      <form className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
        <input type="hidden" name="role" value={role} />
        <label htmlFor="guide-search" className="sr-only">
          Search people or destinations
        </label>
        <input
          id="guide-search"
          name="search"
          defaultValue={search}
          placeholder="Where are you going?"
          className={field}
        />
        <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <label className="text-xs font-semibold">
            County
            <select
              name="county"
              defaultValue={county ?? ""}
              className={`${field} mt-1`}
            >
              <option value="">All counties</option>
              {counties.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs font-semibold">
            Activity
            <select
              name="category"
              defaultValue={category ?? ""}
              className={`${field} mt-1`}
            >
              <option value="">All activities</option>
              {(role === "hosts"
                ? ["cultural_host", "food_host"]
                : ["tour_guide", "nature_guide", "adventure_guide"]
              ).map((item) => (
                <option key={item} value={item}>
                  {label(item)}
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs font-semibold">
            Language
            <input
              name="language"
              defaultValue={language}
              placeholder="e.g. English"
              className={`${field} mt-1`}
            />
          </label>
          <button className="button-primary mt-auto min-h-11">
            Find {role}
          </button>
        </div>
      </form>
      {activeFilters.length > 0 && (
        <nav
          aria-label="Active search filters"
          className="mt-3 flex flex-wrap items-center gap-2"
        >
          {activeFilters.map((item) => (
            <Link
              key={item.key}
              href={removeFilter(item.key)}
              aria-label={`Remove ${item.key} filter: ${item.text}`}
              className="inline-flex min-h-11 max-w-full items-center gap-2 rounded-full bg-brand-50 px-3 text-sm text-brand-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 dark:bg-brand-950 dark:text-brand-200"
            >
              <span className="break-words">{item.text}</span>
              <span aria-hidden>×</span>
            </Link>
          ))}
          <Link
            href={`/guides?role=${role}`}
            className="inline-flex min-h-11 items-center px-2 text-sm font-semibold text-brand-700 underline dark:text-brand-300"
          >
            Clear all
          </Link>
        </nav>
      )}
      <div className="mb-4 mt-7 flex items-center justify-between gap-3">
        <h2 className="font-display text-xl font-bold">
          {role === "hosts" ? "Meet local hosts" : "Guides for your next trip"}
        </h2>
        <span className="text-sm text-slate-500">{visible.length} found</span>
      </div>
      <section
        className="grid gap-4 sm:grid-cols-2"
        aria-label="Search results"
      >
        {visible.map((guide) => (
          <article
            key={guide.id}
            className="flex flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900"
          >
            <div className="flex items-center gap-3 p-4 pb-0">
              {guide.profileImageUrl ? (
                <img
                  src={guide.profileImageUrl}
                  alt=""
                  className="h-16 w-16 shrink-0 rounded-2xl object-cover"
                />
              ) : (
                <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-brand-50 text-2xl font-bold text-brand-700 dark:bg-brand-950 dark:text-brand-300">
                  {guide.slug.charAt(0).toUpperCase()}
                </span>
              )}
              <div className="min-w-0">
                <h3 className="break-words font-display text-lg font-bold capitalize">
                  {guide.slug.replaceAll("-", " ")}
                </h3>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  {label(guide.guideType)}
                </p>
                {guide.verificationStatus === "verified" && (
                  <span className="mt-1 inline-flex items-center gap-1 text-xs font-semibold text-brand-700 dark:text-brand-300">
                    <CheckBadgeIcon className="h-4 w-4" />
                    Verified
                  </span>
                )}
              </div>
            </div>
            <div className="flex flex-1 flex-col p-4">
              <p className="flex items-center gap-1 text-sm text-slate-600 dark:text-slate-300">
                <MapPinIcon className="h-4 w-4 shrink-0" />
                {[guide.city, guide.county?.name].filter(Boolean).join(", ")}
              </p>
              <p className="mt-2 line-clamp-2 text-sm leading-6 text-slate-600 dark:text-slate-300">
                {guide.bio}
              </p>
              <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                {guide.languages.join(" · ")}
              </p>
              <div className="mt-auto flex items-center justify-between gap-2 pt-4">
                <span className="text-xs text-slate-500 dark:text-slate-400">
                  {guide.reviewCount > 0 ? (
                    <>
                      <StarIcon className="mr-1 inline h-4 w-4 text-amber-500" />
                      {guide.rating.toFixed(1)} ({guide.reviewCount} reviews)
                    </>
                  ) : (
                    "Meet your local expert"
                  )}
                </span>
                <Link
                  href={`/guides/${guide.slug}`}
                  className="flex min-h-11 items-center rounded-xl border border-brand-700 px-4 text-sm font-bold text-brand-700 dark:border-brand-300 dark:text-brand-300"
                >
                  View profile
                </Link>
              </div>
            </div>
          </article>
        ))}
        {!visible.length && (
          <div className="rounded-2xl border border-dashed border-slate-300 p-8 text-center sm:col-span-2">
            <p>No {role} match this search.</p>
            <Link
              href={`/guides?role=${role}`}
              className="mt-3 inline-flex min-h-11 items-center text-sm font-bold text-brand-700 dark:text-brand-300"
            >
              Clear filters
            </Link>
          </div>
        )}
      </section>
      <aside className="mt-8 rounded-2xl bg-brand-50 p-5 dark:bg-slate-900">
        <h2 className="font-bold">Know Liberia by heart?</h2>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
          Share your local knowledge with travelers.
        </p>
        <Link
          href="/guides/apply"
          className="mt-3 inline-flex min-h-11 items-center font-semibold text-brand-700 dark:text-brand-300"
        >
          Become a guide or host →
        </Link>
      </aside>
    </main>
  );
}
