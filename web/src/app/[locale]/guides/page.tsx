import Link from "next/link";
import { getGuides } from "@/lib/api";
import {
  MagnifyingGlassIcon,
  MapPinIcon,
  StarIcon,
  CheckBadgeIcon,
  ChevronRightIcon,
} from "@heroicons/react/24/solid";

export const metadata = {
  title: "Trip Guides & Hosts — LIBERIA360",
  description:
    "Find verified local guides and hosts for memorable Liberia experiences.",
};

type SearchParams = { [key: string]: string | string[] | undefined };
function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}
function label(value: string) {
  return value
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export default async function GuidesPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const search = first(params.search);
  const category = first(params.category);
  const county = first(params.county);
  const language = first(params.language);
  const guides = await getGuides({ search, county, language });
  function href(nextCategory?: string) {
    const query = new URLSearchParams();
    if (search) query.set("search", search);
    if (nextCategory) query.set("category", nextCategory);
    if (county) query.set("county", county);
    if (language) query.set("language", language);
    return query.toString() ? `/guides?${query}` : "/guides";
  }

  return (
    <main className="mx-auto max-w-5xl px-4 py-5 pb-12 sm:px-6 lg:px-10">
      <header className="mb-5">
        <p className="text-xs font-bold uppercase tracking-[0.24em] text-brand-700 dark:text-brand-300">
          LIBERIA360 community
        </p>
        <div className="mt-1 flex items-end justify-between gap-3">
          <h1 className="font-display text-3xl font-extrabold tracking-tight text-slate-950 dark:text-slate-50 sm:text-4xl">
            Trip Guides &amp; Hosts
          </h1>
          <Link
            href="/guides/apply"
            className="hidden rounded-full border border-brand-300 px-4 py-2 text-sm font-bold text-brand-700 sm:inline-flex"
          >
            Become a guide
          </Link>
        </div>
      </header>

      <form className="rounded-3xl border border-slate-200 bg-white p-3 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <label htmlFor="guide-search" className="sr-only">
          Search guides or places
        </label>
        <div className="flex items-center gap-2 rounded-2xl border border-slate-200 px-3 dark:border-slate-700">
          <MagnifyingGlassIcon className="h-5 w-5 shrink-0 text-brand-700" />
          <input
            id="guide-search"
            name="search"
            defaultValue={search}
            placeholder="Search guides or places"
            className="min-h-11 min-w-0 flex-1 bg-transparent text-sm outline-none"
          />
        </div>
        <div
          className="mt-3 flex gap-2 overflow-x-auto pb-1"
          aria-label="Guide categories"
        >
          {([undefined, "city", "culture", "nature", "food"] as const).map(
            (item) => (
              <Link
                key={item ?? "all"}
                href={href(item)}
                className={`whitespace-nowrap rounded-full border px-5 py-2.5 text-sm font-bold ${category === item || (!category && !item) ? "border-accent-500 bg-brand-700 text-white" : "border-slate-200 bg-white text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"}`}
              >
                {item ? label(item) : "All"}
              </Link>
            ),
          )}
        </div>
        <div className="sr-only">
          <input name="county" defaultValue={county} />
          <input name="language" defaultValue={language} />
        </div>
      </form>

      <section className="mt-5 space-y-3" aria-label="Verified trip guides">
        {guides.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-slate-300 px-4 py-12 text-center text-slate-500 dark:border-slate-700 dark:text-slate-400">
            No guides in this search yet. Try another search or category.
          </div>
        ) : (
          guides.map((guide) => (
            <article
              key={guide.id}
              className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-5"
            >
              <div className="flex items-center gap-3">
                <div className="h-20 w-20 shrink-0 overflow-hidden rounded-full border-4 border-emerald-500 bg-brand-100 dark:bg-brand-950">
                  {guide.profileImageUrl ? (
                    <img
                      src={guide.profileImageUrl}
                      alt=""
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <span className="flex h-full items-center justify-center text-2xl font-bold text-brand-800">
                      {guide.slug.charAt(0).toUpperCase()}
                    </span>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="truncate font-display text-lg font-extrabold text-slate-950 dark:text-slate-50">
                      {guide.slug.replaceAll("-", " ")}
                    </h2>
                    <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-1 text-[11px] font-bold text-amber-900">
                      <CheckBadgeIcon className="h-3.5 w-3.5" /> Verified
                    </span>
                  </div>
                  <p className="mt-1 text-sm font-semibold text-slate-500 dark:text-slate-400">
                    {label(guide.guideType)}
                  </p>
                  <p className="mt-1 truncate text-sm text-slate-500 dark:text-slate-400">
                    <MapPinIcon className="mr-1 inline h-4 w-4 text-brand-700" />
                    {guide.city}
                    {guide.county?.name ? `, ${guide.county.name}` : ""}
                  </p>
                  <p className="mt-1 text-sm font-bold text-slate-800 dark:text-slate-200">
                    <StarIcon className="mr-1 inline h-4 w-4 text-amber-400" />
                    {guide.rating.toFixed(1)}{" "}
                    <span className="font-normal text-slate-500">
                      ({guide.reviewCount} reviews)
                    </span>
                  </p>
                </div>
                <Link
                  href={`/guides/${guide.slug}`}
                  className="hidden min-h-11 shrink-0 items-center gap-1 rounded-full bg-brand-700 px-4 py-2.5 text-sm font-bold text-white sm:inline-flex"
                >
                  View Guide <ChevronRightIcon className="h-4 w-4" />
                </Link>
                <Link
                  href={`/guides/${guide.slug}`}
                  aria-label={`View ${guide.slug}`}
                  className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-cyan-200 text-brand-700 sm:hidden"
                >
                  <ChevronRightIcon className="h-5 w-5" />
                </Link>
              </div>
            </article>
          ))
        )}
      </section>
      <div className="mt-6 text-center sm:hidden">
        <Link
          href="/guides/apply"
          className="inline-flex min-h-11 items-center rounded-full border border-brand-300 px-5 py-2.5 text-sm font-bold text-brand-700"
        >
          Become a guide
        </Link>
      </div>
    </main>
  );
}
