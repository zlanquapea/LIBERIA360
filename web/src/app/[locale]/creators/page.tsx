import Link from "next/link";
import { cookies } from "next/headers";
import {
  ArrowRightIcon,
  CheckBadgeIcon,
  MapPinIcon,
  MagnifyingGlassIcon,
  ShieldCheckIcon,
  StarIcon,
} from "@heroicons/react/24/solid";
import { getCounties, getCreators, getCreatorFeed, getGuides } from "@/lib/api";
import { CreatorCard } from "@/components/CreatorCard";
import { CreatorFeed } from "@/components/CreatorFeed";
import { CreatorFilters } from "@/components/CreatorFilters";
import { CreatorDirectoryHeader } from "@/components/CreatorDirectoryHeader";
import type { CreatorCategory } from "@/lib/types";

export const metadata = { title: "Creators — LIBERIA360" };

type SearchParams = { [key: string]: string | string[] | undefined };

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function guideName(slug: string) {
  return slug
    .replaceAll("-", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function guideTypeLabel(value: string) {
  return value
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function GuideCard({
  guide,
}: {
  guide: Awaited<ReturnType<typeof getGuides>>[number];
}) {
  const name = guideName(guide.slug);
  const specialties = guide.languages.slice(0, 3);
  return (
    <article className="group flex min-w-[292px] snap-start flex-col overflow-hidden rounded-[1.75rem] border border-slate-200 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg dark:border-slate-800 dark:bg-slate-900 sm:min-w-0">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="h-16 w-16 shrink-0 overflow-hidden rounded-full border-4 border-cyan-100 bg-brand-50 dark:border-cyan-950 dark:bg-brand-950">
            {guide.profileImageUrl ? (
              <img
                src={guide.profileImageUrl}
                alt=""
                className="h-full w-full object-cover"
              />
            ) : (
              <span className="flex h-full items-center justify-center text-xl font-extrabold text-brand-800 dark:text-brand-200">
                {name.charAt(0)}
              </span>
            )}
          </div>
          <div className="min-w-0">
            <h3 className="truncate font-display text-lg font-extrabold text-slate-950 dark:text-white">
              {name}
            </h3>
            <span className="mt-1 inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-1 text-[10px] font-extrabold text-amber-900 dark:bg-amber-950/50 dark:text-amber-200">
              <ShieldCheckIcon className="h-3.5 w-3.5" /> Verified{" "}
              {guideTypeLabel(guide.guideType)}
            </span>
          </div>
        </div>
        <span
          className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-50 text-slate-400 dark:bg-slate-800"
          aria-label="Verified guide"
        >
          <CheckBadgeIcon className="h-5 w-5 text-cyan-600" />
        </span>
      </div>
      <div className="mt-4 flex items-center justify-between gap-3 text-sm text-slate-600 dark:text-slate-300">
        <span className="truncate">
          <MapPinIcon className="mr-1 inline h-4 w-4 text-brand-700" />
          {guide.city}
        </span>
        <span className="shrink-0 font-bold text-slate-900 dark:text-white">
          <StarIcon className="mr-1 inline h-4 w-4 text-amber-400" />
          {guide.rating.toFixed(1)}{" "}
          <span className="font-normal text-slate-500">
            ({guide.reviewCount})
          </span>
        </span>
      </div>
      {specialties.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {specialties.map((specialty) => (
            <span
              key={specialty}
              className="rounded-full bg-cyan-50 px-2.5 py-1 text-xs font-semibold text-brand-800 dark:bg-cyan-950/40 dark:text-cyan-200"
            >
              {specialty}
            </span>
          ))}
        </div>
      )}
      <Link
        href={`/guides/${guide.slug}`}
        className="mt-4 inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-brand-700 px-4 text-sm font-bold text-white transition hover:bg-brand-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
      >
        View profile <ArrowRightIcon className="h-4 w-4" />
      </Link>
    </article>
  );
}

export default async function CreatorsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const page = Number(first(params.page) ?? "1") || 1;
  const search = first(params.search);
  const category = first(params.category) as CreatorCategory | undefined;
  const countyId = first(params.countyId);
  const view = first(params.view);
  const isFollowing = view === "following";
  const isDirectory = view === "directory";
  const cookieHeader = (await cookies()).toString();

  const [counties, result, feed, guides] = await Promise.all([
    getCounties(),
    getCreators({ page, limit: 20, search, category, countyId }),
    getCreatorFeed({ page: 1, limit: 20 }, cookieHeader),
    getGuides(),
  ]);

  function pageHref(targetPage: number) {
    const p = new URLSearchParams();
    if (search) p.set("search", search);
    if (category) p.set("category", category);
    if (countyId) p.set("countyId", countyId);
    if (isDirectory) p.set("view", "directory");
    if (targetPage > 1) p.set("page", String(targetPage));
    const query = p.toString();
    return query ? `/creators?${query}` : "/creators";
  }

  const hasFilters = Boolean(search || category || countyId);
  return (
    <main className="mx-auto flex max-w-6xl flex-col gap-5 px-4 py-4 pb-12 sm:gap-7 sm:px-6 sm:py-7 lg:px-10">
      <section className="overflow-hidden rounded-[2rem] bg-gradient-to-br from-brand-950 via-brand-800 to-cyan-700 px-5 py-7 text-white shadow-lg sm:px-8 sm:py-9">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
          <div className="max-w-2xl">
            <p className="text-xs font-bold uppercase tracking-[0.24em] text-cyan-200">
              A local creator community
            </p>
            <p className="mt-3 max-w-xl text-base leading-7 text-cyan-50 sm:text-lg">
              Discover people, stories and experiences from across Liberia.
            </p>
          </div>
          <CreatorDirectoryHeader variant="hero" />
        </div>
      </section>

      <nav
        aria-label="Creator sections"
        className="grid grid-cols-3 rounded-2xl border border-slate-200 bg-white p-1 shadow-sm dark:border-slate-800 dark:bg-slate-900"
      >
        <Link
          href={pageHref(1)}
          aria-current={!isFollowing && !isDirectory ? "page" : undefined}
          className={`inline-flex min-h-11 items-center justify-center rounded-xl px-3 text-sm font-bold ${!isFollowing && !isDirectory ? "bg-brand-700 text-white shadow-sm" : "text-slate-600 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-800"}`}
        >
          Discover
        </Link>
        <Link
          href="/creators?view=following"
          aria-current={isFollowing ? "page" : undefined}
          className={`inline-flex min-h-11 items-center justify-center rounded-xl px-3 text-sm font-bold ${isFollowing ? "bg-brand-700 text-white shadow-sm" : "text-slate-600 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-800"}`}
        >
          Following
        </Link>
        <Link
          href="/account/bookings"
          className="inline-flex min-h-11 items-center justify-center rounded-xl px-3 text-sm font-bold text-slate-600 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-800"
        >
          Bookings
        </Link>
      </nav>

      {isFollowing ? (
        <CreatorFeed initialPosts={[]} mode="following" />
      ) : (
        <>
          {isDirectory || hasFilters ? (
            <section className="rounded-[1.75rem] border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-6">
              <div className="mb-4 flex items-end justify-between gap-3">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.2em] text-brand-700 dark:text-brand-300">
                    Creator directory
                  </p>
                  <h2 className="mt-1 font-display text-2xl font-extrabold text-slate-950 dark:text-white">
                    Find your local experts
                  </h2>
                </div>
                {hasFilters && (
                  <Link
                    href="/creators?view=directory"
                    className="text-xs font-bold text-brand-700 hover:underline dark:text-brand-300"
                  >
                    Clear filters
                  </Link>
                )}
              </div>
              <CreatorFilters counties={counties} />
            </section>
          ) : (
            <section
              aria-labelledby="guide-heading"
              className="rounded-[1.75rem] bg-slate-50/80 p-4 dark:bg-slate-900/50 sm:p-6"
            >
              <div className="flex items-end justify-between gap-3">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.2em] text-brand-700 dark:text-brand-300">
                    Local expertise
                  </p>
                  <h2
                    id="guide-heading"
                    className="mt-1 font-display text-2xl font-extrabold tracking-tight text-slate-950 dark:text-white sm:text-3xl"
                  >
                    Trip Guides &amp; Hosts
                  </h2>
                  <p className="mt-1 text-sm text-slate-600 dark:text-slate-300 sm:text-base">
                    Experience Liberia with trusted locals.
                  </p>
                </div>
                <Link
                  href="/guides"
                  className="inline-flex min-h-10 shrink-0 items-center gap-1 rounded-full px-3 text-sm font-bold text-brand-700 hover:bg-white dark:text-brand-300 dark:hover:bg-slate-800"
                >
                  See all <ArrowRightIcon className="h-4 w-4" />
                </Link>
              </div>
              {guides.length > 0 ? (
                <div className="-mx-1 mt-5 flex snap-x gap-3 overflow-x-auto px-1 pb-2 sm:grid sm:grid-cols-2 sm:overflow-visible lg:grid-cols-3">
                  {guides.slice(0, 6).map((guide) => (
                    <GuideCard key={guide.id} guide={guide} />
                  ))}
                </div>
              ) : (
                <div className="mt-5 rounded-2xl border border-dashed border-brand-200 bg-white p-5 text-sm text-slate-600 dark:border-brand-800 dark:bg-slate-900 dark:text-slate-300">
                  No approved guides yet.{" "}
                  <Link
                    href="/guides/apply"
                    className="font-bold text-brand-700 underline dark:text-brand-300"
                  >
                    Become a guide
                  </Link>
                  .
                </div>
              )}
            </section>
          )}

          {isDirectory || hasFilters ? (
            <section
              aria-labelledby="creator-results-heading"
              className="flex flex-col gap-3"
            >
              <div className="flex items-end justify-between gap-3">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.2em] text-brand-700 dark:text-brand-300">
                    Meet Liberia&apos;s local experts
                  </p>
                  <h2
                    id="creator-results-heading"
                    className="mt-1 font-display text-2xl font-extrabold text-slate-950 dark:text-white"
                  >
                    Creators to explore
                  </h2>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {result.meta.total.toLocaleString()} profiles
                </p>
              </div>
              {result.data.length === 0 ? (
                <p className="rounded-3xl border border-dashed border-slate-300 px-4 py-10 text-center text-slate-500 dark:border-slate-700 dark:text-slate-400">
                  No creators match these filters.
                </p>
              ) : (
                <div className="rounded-3xl border border-slate-200 bg-white px-4 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:px-5">
                  {result.data.map((creator, i) => (
                    <CreatorCard key={creator.id} creator={creator} index={i} />
                  ))}
                </div>
              )}
            </section>
          ) : (
            <>
              <section
                aria-labelledby="creator-search-heading"
                className="rounded-[1.75rem] border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-6"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-cyan-50 text-brand-700 dark:bg-cyan-950/40 dark:text-cyan-200">
                    <MagnifyingGlassIcon className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-xs font-bold uppercase tracking-[0.2em] text-brand-700 dark:text-brand-300">
                      Discover more
                    </p>
                    <h2
                      id="creator-search-heading"
                      className="mt-1 font-display text-xl font-extrabold text-slate-950 dark:text-white"
                    >
                      Search creators, guides &amp; hosts
                    </h2>
                  </div>
                </div>
                <div className="mt-4">
                  <CreatorFilters counties={counties} />
                </div>
              </section>
              <CreatorFeed initialPosts={feed.data} />
              <section
                aria-labelledby="directory-heading"
                className="rounded-[1.75rem] border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-6"
              >
                <div className="flex items-end justify-between gap-3">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-[0.2em] text-brand-700 dark:text-brand-300">
                      Creator directory
                    </p>
                    <h2
                      id="directory-heading"
                      className="mt-1 font-display text-2xl font-extrabold text-slate-950 dark:text-white"
                    >
                      Meet Liberia&apos;s local experts
                    </h2>
                    <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                      Guides, hosts and creators who know Liberia.
                    </p>
                  </div>
                  <Link
                    href="/creators?view=directory"
                    className="inline-flex min-h-10 items-center gap-1 rounded-full px-3 text-sm font-bold text-brand-700 hover:bg-slate-50 dark:text-brand-300 dark:hover:bg-slate-800"
                  >
                    See all <ArrowRightIcon className="h-4 w-4" />
                  </Link>
                </div>
                <div className="mt-5 grid gap-3 sm:grid-cols-2">
                  {result.data.slice(0, 4).map((creator, i) => (
                    <CreatorCard key={creator.id} creator={creator} index={i} />
                  ))}
                </div>
              </section>
            </>
          )}
        </>
      )}

      {!isFollowing &&
        result.meta.totalPages > 1 &&
        (isDirectory || hasFilters) && (
          <nav
            aria-label="Creator pages"
            className="flex items-center justify-between border-t border-slate-200 pt-4 dark:border-slate-800"
          >
            <Link
              href={page <= 1 ? pageHref(1) : pageHref(page - 1)}
              className={`text-sm font-bold ${page <= 1 ? "pointer-events-none text-slate-300" : "text-brand-700 hover:underline dark:text-brand-300"}`}
            >
              ← Previous
            </Link>
            <span className="text-sm text-slate-500">
              Page {result.meta.page} of {result.meta.totalPages}
            </span>
            <Link
              href={
                page >= result.meta.totalPages
                  ? pageHref(page)
                  : pageHref(page + 1)
              }
              className={`text-sm font-bold ${page >= result.meta.totalPages ? "pointer-events-none text-slate-300" : "text-brand-700 hover:underline dark:text-brand-300"}`}
            >
              Next →
            </Link>
          </nav>
        )}
    </main>
  );
}
