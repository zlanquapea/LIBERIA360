import Link from "next/link";
import { getCounties, getCreators, getCreatorFeed } from "@/lib/api";
import { CreatorCard } from "@/components/CreatorCard";
import { CreatorFeed } from "@/components/CreatorFeed";
import { CreatorFilters } from "@/components/CreatorFilters";
import { CreatorDirectoryHeader } from "@/components/CreatorDirectoryHeader";
import { SafeImage } from "@/components/SafeImage";
import { colorForCreator, gradientForCategory } from "@/lib/category-colors";
import { formatCreatorCategory } from "@/lib/format";
import { resolveImageUrl, resolveThumbUrl } from "@/lib/images";
import type { CreatorCategory } from "@/lib/types";

export const metadata = { title: "Creators — LIBERIA360" };

type SearchParams = { [key: string]: string | string[] | undefined };

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

// Creator directory (Tech Spec §5 Creator / §3.2) — a social-style discovery
// surface for Liberian content creators, guides, and storytellers. The list
// endpoint stays the source of truth; portfolio media remains on profile pages.
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
  const isFollowing = first(params.view) === "following";

  const [counties, result, feed] = await Promise.all([
    getCounties(),
    getCreators({ page, limit: 20, search, category, countyId }),
    getCreatorFeed({ page: 1, limit: 20 }),
  ]);

  function pageHref(targetPage: number) {
    const p = new URLSearchParams();
    if (search) p.set("search", search);
    if (category) p.set("category", category);
    if (countyId) p.set("countyId", countyId);
    if (targetPage > 1) p.set("page", String(targetPage));
    const query = p.toString();
    return query ? `/creators?${query}` : "/creators";
  }

  const hasFilters = Boolean(search || category || countyId);
  const railCreators = result.data.slice(0, 5);

  return (
    <main className="mx-auto flex max-w-5xl flex-col gap-6 px-4 py-6 pb-12 sm:px-6 lg:px-10 lg:py-8">
      <header className="flex flex-col gap-5">
        <CreatorDirectoryHeader />

        <nav
          aria-label="Creator sections"
          className="grid grid-cols-3 rounded-2xl border border-slate-200 bg-slate-50 p-1 dark:border-slate-800 dark:bg-slate-900"
        >
          <Link
            href={pageHref(1)}
            aria-current={!isFollowing ? "page" : undefined}
            className={`inline-flex min-h-11 items-center justify-center rounded-xl px-3 py-2 text-sm font-semibold ${!isFollowing ? "bg-brand-700 text-white shadow-sm" : "text-slate-600 hover:bg-white hover:text-brand-700 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-brand-300"}`}
          >
            Discover
          </Link>
          <Link
            href="/creators?view=following"
            aria-current={isFollowing ? "page" : undefined}
            className={`inline-flex min-h-11 items-center justify-center rounded-xl px-3 py-2 text-sm font-semibold ${isFollowing ? "bg-brand-700 text-white shadow-sm" : "text-slate-600 hover:bg-white hover:text-brand-700 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-brand-300"}`}
          >
            Following
          </Link>
          <Link
            href="/account/bookings"
            className="inline-flex min-h-11 items-center justify-center rounded-xl px-3 py-2 text-sm font-semibold text-slate-600 hover:bg-white hover:text-brand-700 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-brand-300"
          >
            Bookings
          </Link>
        </nav>
      </header>

      {isFollowing ? (
        <CreatorFeed initialPosts={[]} mode="following" />
      ) : (
        <>
          <CreatorFilters counties={counties} />

          {railCreators.length > 0 && (
            <section
              aria-labelledby="trending-creators-heading"
              className="flex flex-col gap-3"
            >
              <div className="flex items-center justify-between">
                <h2
                  id="trending-creators-heading"
                  className="font-display text-lg font-bold text-slate-950 dark:text-slate-50"
                >
                  Trending creators
                </h2>
                <span className="text-sm font-medium text-brand-700 dark:text-brand-300">
                  {result.meta.total} available
                </span>
              </div>
              <div className="-mx-1 flex gap-4 overflow-x-auto px-1 pb-1">
                {railCreators.map((creator) => {
                  const avatar = creator.profileImage
                    ? resolveImageUrl(creator.profileImage)
                    : null;
                  const avatarThumb = creator.profileImage
                    ? resolveThumbUrl(creator.profileImage)
                    : null;
                  return (
                    <Link
                      key={creator.id}
                      href={`/creators/${creator.username}`}
                      className="flex w-20 shrink-0 flex-col items-center gap-1.5 text-center"
                    >
                      <span
                        className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-full border-2 border-accent-400 p-0.5"
                        style={{
                          backgroundColor: colorForCreator(creator.username),
                        }}
                      >
                        <span className="flex h-full w-full items-center justify-center overflow-hidden rounded-full bg-white text-lg font-semibold text-white dark:bg-slate-900">
                          <SafeImage
                            src={avatar}
                            thumbSrc={avatarThumb}
                            alt=""
                            className="h-full w-full object-cover"
                            fallback={
                              <span>
                                {creator.name.trim().charAt(0).toUpperCase() ||
                                  "?"}
                              </span>
                            }
                          />
                        </span>
                      </span>
                      <span className="w-full truncate text-sm font-semibold text-slate-800 dark:text-slate-100">
                        {creator.name}
                      </span>
                      <span className="w-full truncate text-xs text-slate-500 dark:text-slate-400">
                        {formatCreatorCategory(creator.category)}
                      </span>
                    </Link>
                  );
                })}
              </div>
            </section>
          )}

          {hasFilters ? (
            <section
              aria-labelledby="creator-results-heading"
              className="flex flex-col gap-3"
            >
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-brand-700 dark:text-brand-300">
                  Matching profiles
                </p>
                <h2
                  id="creator-results-heading"
                  className="mt-1 font-display text-2xl font-bold text-slate-950 dark:text-slate-50"
                >
                  Creator directory
                </h2>
              </div>
              {result.data.length === 0 ? (
                <p className="rounded-3xl border border-dashed border-slate-300 px-4 py-10 text-center text-slate-500 dark:border-slate-700 dark:text-slate-400">
                  No creators match these filters.
                </p>
              ) : (
                <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
                  {result.data.map((creator) => (
                    <CreatorCard key={creator.id} creator={creator} />
                  ))}
                </div>
              )}
            </section>
          ) : (
            <CreatorFeed initialPosts={feed.data} />
          )}
        </>
      )}

      {!isFollowing && result.meta.totalPages > 1 && (
        <nav
          aria-label="Creator pages"
          className="flex items-center justify-between border-t border-slate-200 pt-4 dark:border-slate-800"
        >
          <Link
            href={page <= 1 ? pageHref(1) : pageHref(page - 1)}
            aria-disabled={page <= 1}
            className={`text-sm font-semibold ${page <= 1 ? "pointer-events-none text-slate-300 dark:text-slate-700" : "text-brand-700 hover:underline dark:text-brand-300"}`}
          >
            ← Previous
          </Link>
          <span className="text-sm text-slate-500 dark:text-slate-400">
            Page {result.meta.page} of {result.meta.totalPages}
          </span>
          <Link
            href={
              page >= result.meta.totalPages
                ? pageHref(page)
                : pageHref(page + 1)
            }
            aria-disabled={page >= result.meta.totalPages}
            className={`text-sm font-semibold ${
              page >= result.meta.totalPages
                ? "pointer-events-none text-slate-300 dark:text-slate-700"
                : "text-brand-700 hover:underline dark:text-brand-300"
            }`}
          >
            Next →
          </Link>
        </nav>
      )}
    </main>
  );
}
