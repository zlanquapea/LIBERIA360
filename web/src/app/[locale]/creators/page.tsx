import Link from "next/link";
import { cookies } from "next/headers";
import {
  ArrowRightIcon,
  CalendarDaysIcon,
  ChevronRightIcon,
  MapPinIcon,
  PlusIcon,
  ShieldCheckIcon,
  StarIcon,
  UserGroupIcon,
} from "@heroicons/react/24/solid";
import { getCreatorFeed, getGuides } from "@/lib/api";
import { CreatorFeed } from "@/components/CreatorFeed";

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

function QuickAction({
  href,
  label,
  icon,
  emphasized = false,
}: {
  href: string;
  label: string;
  icon: React.ReactNode;
  emphasized?: boolean;
}) {
  // Stacked icon-top, not the row's old horizontal icon+label+chevron
  // layout: at this container's 390px cap, three tiles in a row leave each
  // one well under 40px for its own label once the icon, chevron, gaps and
  // padding are accounted for — nowhere near enough for "Find local
  // creators," which is exactly the cramped/wrapping look this redesign
  // set out to remove. Stacking vertically (and dropping the chevron,
  // which read as a list-row affordance this tile isn't) gives the label
  // the tile's full width instead of a sliver of it.
  return (
    <Link
      href={href}
      className={`flex min-h-[92px] min-w-0 flex-1 flex-col items-center justify-center gap-2 rounded-2xl px-2 py-3 text-center shadow-sm transition hover:-translate-y-0.5 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 ${
        emphasized ? "bg-gold-100 dark:bg-gold-950/30" : "bg-brand-50 dark:bg-brand-950/40"
      }`}
    >
      <span
        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${emphasized ? "bg-gold-400 text-brand-950" : "bg-brand-800 text-white"}`}
      >
        <span className="[&>svg]:h-4 [&>svg]:w-4">{icon}</span>
      </span>
      <span className="text-xs font-extrabold leading-tight text-slate-900 dark:text-slate-50">
        {label}
      </span>
    </Link>
  );
}

function GuideCard({
  guide,
}: {
  guide: Awaited<ReturnType<typeof getGuides>>[number];
}) {
  const name = guideName(guide.slug);
  const languages = guide.languages.slice(0, 2);

  return (
    <Link
      href={`/guides/${guide.slug}`}
      className="group block rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 dark:border-slate-800 dark:bg-slate-900"
    >
      <div className="flex items-start gap-3">
        <div className="h-[90px] w-[90px] shrink-0 overflow-hidden rounded-full border-4 border-brand-50 bg-brand-50 dark:border-brand-950/40 dark:bg-brand-950/40">
          {guide.profileImageUrl ? (
            <img
              src={guide.profileImageUrl}
              alt={`${name} portrait`}
              className="h-full w-full object-cover"
            />
          ) : (
            <span className="flex h-full items-center justify-center text-2xl font-extrabold text-brand-800 dark:text-brand-200">
              {name.charAt(0)}
            </span>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <h3 className="truncate text-lg font-extrabold leading-tight text-slate-950 dark:text-slate-50">
                {name}
              </h3>
              <span className="mt-1 inline-flex max-w-full items-center gap-1 rounded-full bg-gold-100 px-2 py-1 text-[10px] font-extrabold text-gold-800 dark:bg-gold-950/40 dark:text-gold-300">
                <ShieldCheckIcon aria-hidden className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate">
                  Verified {guideTypeLabel(guide.guideType)}
                </span>
              </span>
            </div>
            <ChevronRightIcon
              aria-hidden
              className="mt-1 h-5 w-5 shrink-0 text-brand-700 dark:text-brand-300"
            />
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-500 dark:text-slate-400">
            <span className="inline-flex items-center gap-1">
              <MapPinIcon aria-hidden className="h-3.5 w-3.5 text-brand-700 dark:text-brand-300" />
              {guide.city}
            </span>
            <span aria-hidden className="text-slate-300 dark:text-slate-700">
              |
            </span>
            <span className="inline-flex items-center gap-1">
              <StarIcon aria-hidden className="h-3.5 w-3.5 text-gold-500" />
              <span className="font-semibold text-slate-900 dark:text-slate-50">
                {guide.rating.toFixed(1)} ({guide.reviewCount})
              </span>
            </span>
          </div>
          {languages.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {languages.map((language) => (
                <span
                  key={language}
                  className="rounded-full bg-brand-50 px-2.5 py-1 text-[11px] font-bold text-slate-800 dark:bg-brand-950/40 dark:text-slate-100"
                >
                  {language}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
    </Link>
  );
}

// Creator directory (Tech Spec §5 Creator / §3.2) — a social-style discovery
// surface for Liberian content creators, guides, and storytellers.
//
// Every surface here uses the app's shared dark-mode-aware design tokens
// (brand/slate/gold, all with `dark:` pairs) instead of raw one-off hex —
// this page used to hardcode colors like `bg-[#F7F8FA]`/`text-[#1A2E35]`
// with no `dark:` variants at all, which was the real cause of text
// disappearing below the hero: CreatorFeed → CreatorStories is a shared,
// theme-aware component that switches to light-colored `dark:` text (e.g.
// `dark:text-brand-300`, `dark:text-white`) whenever the site's dark mode
// is on — but this page's own background stayed forced-light regardless of
// theme, so that text rendered as light-on-light and nearly vanished.
// Making every surface here theme-aware (not just the shared children)
// fixes that for good instead of patching one heading at a time.
export default async function CreatorsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const isFollowing = first(params.view) === "following";
  const cookieHeader = (await cookies()).toString();
  const [feed, guides] = await Promise.all([
    getCreatorFeed({ page: 1, limit: 20 }, cookieHeader),
    getGuides(),
  ]);

  return (
    <main className="min-h-screen overflow-x-hidden bg-slate-50 px-4 pb-28 pt-0 text-slate-900 dark:bg-slate-950 dark:text-slate-50 sm:px-6 sm:pt-6">
      <div className="mx-auto flex w-full max-w-[390px] flex-col">
        <section aria-label="Creator quick actions" className="flex gap-2">
          <QuickAction
            href="/creators#creator-feed"
            label="Find local creators"
            icon={<UserGroupIcon aria-hidden className="h-5 w-5" />}
          />
          <QuickAction
            href="/creators/me/create"
            label="Create a post"
            emphasized
            icon={<PlusIcon aria-hidden className="h-5 w-5" />}
          />
          <QuickAction
            href="/account/bookings"
            label="Bookings"
            icon={<CalendarDaysIcon aria-hidden className="h-5 w-5" />}
          />
        </section>

        <section
          aria-labelledby="creators-hero-heading"
          className="relative mt-4 h-[290px] overflow-hidden rounded-[20px] bg-brand-900 shadow-[0_12px_30px_rgba(0,47,59,0.18)]"
          style={{
            backgroundImage: "url('/onboarding/discover.jpg')",
            backgroundPosition: "62% center",
            backgroundSize: "cover",
          }}
        >
          <div
            aria-hidden
            className="absolute inset-0 bg-[linear-gradient(90deg,rgba(0,47,59,0.98)_0%,rgba(0,47,59,0.82)_38%,rgba(0,47,59,0.2)_100%)]"
          />
          <div className="relative flex h-full flex-col justify-center px-5 pb-6 pt-5">
            <p className="text-[11px] font-extrabold uppercase tracking-[1.5px] text-brand-200">
              A LOCAL CREATOR COMMUNITY
            </p>
            <h1
              id="creators-hero-heading"
              className="mt-3 max-w-[220px] text-[22px] font-extrabold leading-[1.25] tracking-tight text-white"
            >
              Discover people, stories and experiences from across Liberia.
            </h1>
            <span
              aria-hidden
              className="my-3 h-1 w-10 rounded-full bg-gold-400"
            />
            <p className="text-[38px] font-black leading-none tracking-tight text-white">
              Creators
            </p>
          </div>
        </section>

        <nav
          aria-label="Creator sections"
          className="mt-4 grid h-14 grid-cols-2 rounded-full bg-white p-1 shadow-[0_2px_8px_rgba(0,0,0,0.06)] dark:bg-slate-900"
        >
          <Link
            href="/creators"
            aria-current={!isFollowing ? "page" : undefined}
            className={`inline-flex h-12 items-center justify-center rounded-full px-3 text-base font-extrabold transition-colors ${!isFollowing ? "bg-brand-800 text-white shadow-sm" : "text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"}`}
          >
            Discover
          </Link>
          <Link
            href="/creators?view=following"
            aria-current={isFollowing ? "page" : undefined}
            className={`inline-flex h-12 items-center justify-center rounded-full px-3 text-base font-extrabold transition-colors ${isFollowing ? "bg-brand-800 text-white shadow-sm" : "text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"}`}
          >
            Following
          </Link>
        </nav>

        <section
          aria-labelledby="creator-feed-section-heading"
          className="mt-6"
        >
          <div>
            <div>
              <p className="text-[11px] font-extrabold uppercase tracking-[1.5px] text-brand-700 dark:text-brand-300">
                LOCAL EXPERTISE
              </p>
              <h2
                id="creator-feed-section-heading"
                className="mt-1 text-[26px] font-extrabold leading-tight tracking-tight text-slate-950 dark:text-slate-50"
              >
                Trip Guides &amp; Hosts
              </h2>
              <div className="mt-1 flex items-center justify-between gap-3">
                <p className="text-[15px] text-slate-500 dark:text-slate-400">
                  Experience Liberia with trusted locals.
                </p>
                <Link
                  href="/guides"
                  className="inline-flex min-h-10 shrink-0 items-center gap-1 text-[15px] font-extrabold text-brand-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 dark:text-brand-300"
                >
                  See all <ArrowRightIcon aria-hidden className="h-3.5 w-3.5" />
                </Link>
              </div>
            </div>
          </div>

          {isFollowing ? (
            <CreatorFeed
              initialPosts={[]}
              mode="following"
              showHeader={false}
            />
          ) : guides.length > 0 ? (
            <div className="mt-4 space-y-3">
              {guides.slice(0, 6).map((guide) => (
                <GuideCard key={guide.id} guide={guide} />
              ))}
            </div>
          ) : (
            <div className="mt-4 rounded-2xl border border-dashed border-slate-300 bg-white p-5 text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400">
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
      </div>
    </main>
  );
}
