// Keep this route under the frontend deployment watch path.
import Link from "next/link";
import { cookies } from "next/headers";
import {
  ArrowRightIcon,
  CheckBadgeIcon,
  MapPinIcon,
  ShieldCheckIcon,
  StarIcon,
} from "@heroicons/react/24/solid";
import { getCreatorFeed, getGuides } from "@/lib/api";
import { CreatorFeed } from "@/components/CreatorFeed";
import { CreatorDirectoryHeader } from "@/components/CreatorDirectoryHeader";

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
  if (value === "guide") return "Tour Guide";
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
  const view = first(params.view);
  const isFollowing = view === "following";
  const cookieHeader = (await cookies()).toString();

  const [feed, guides] = await Promise.all([
    getCreatorFeed({ page: 1, limit: 20 }, cookieHeader),
    getGuides(),
  ]);
  return (
    <main className="mx-auto flex max-w-6xl flex-col gap-5 px-4 py-4 pb-28 sm:gap-7 sm:px-6 sm:py-7 lg:px-10">
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
        className="grid grid-cols-2 rounded-2xl border border-slate-200 bg-white p-1 shadow-sm dark:border-slate-800 dark:bg-slate-900"
      >
        <Link
          href="/creators"
          aria-current={!isFollowing ? "page" : undefined}
          className={`inline-flex min-h-11 items-center justify-center rounded-xl px-3 text-sm font-bold ${!isFollowing ? "bg-brand-700 text-white shadow-sm" : "text-slate-600 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-800"}`}
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
      </nav>

      <section
        aria-labelledby="creator-feed-section-heading"
        className="rounded-[1.75rem] bg-slate-50/80 p-4 dark:bg-slate-900/50 sm:p-6"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-brand-700 dark:text-brand-300">
              LOCAL EXPERTISE
            </p>
            <h2
              id="creator-feed-section-heading"
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
            className="inline-flex min-h-11 shrink-0 items-center gap-1 rounded-full px-3 text-sm font-bold text-brand-700 hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 dark:text-brand-300 dark:hover:bg-slate-800"
          >
            See all <ArrowRightIcon className="h-4 w-4" />
          </Link>
        </div>
        {isFollowing ? (
          <CreatorFeed initialPosts={[]} mode="following" showHeader={false} />
        ) : guides.length > 0 ? (
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

      {!isFollowing && (
        <CreatorFeed initialPosts={feed.data} showHeader={false} />
      )}
    </main>
  );
}
