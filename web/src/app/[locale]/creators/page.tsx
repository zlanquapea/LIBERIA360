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

// Redesigned (Sep 2026 — "the three buttons look childish/unprofessional")
// from a row of squeezed horizontal pills (icon bubble + wrapping label +
// chevron, all fighting for ~110px of width) into the same icon-top tile
// the rest of the app already uses for a row of quick actions (see
// account/page.tsx's QUICK_ACTION_GROUPS tiles) — one visual language for
// "here are some shortcuts" across the app, not a one-off. Also brings
// dark-mode support the old version never had at all (raw hex, no `dark:`
// variants anywhere on this page) — see the page's own doc comment below.
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
  return (
    <Link
      href={href}
      className={`group flex min-h-[104px] flex-col justify-between gap-3 rounded-2xl border p-3.5 shadow-sm transition-colors hover:-translate-y-0.5 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 ${
        emphasized
          ? "border-gold-200 bg-gold-50 hover:bg-gold-100 dark:border-gold-800 dark:bg-gold-950/20 dark:hover:bg-gold-950/30"
          : "border-slate-200 bg-white hover:border-brand-300 hover:bg-brand-50 dark:border-slate-800 dark:bg-slate-900 dark:hover:border-brand-800 dark:hover:bg-brand-950/30"
      }`}
    >
      <span
        className={`flex h-10 w-10 items-center justify-center rounded-xl ${
          emphasized
            ? "bg-gold-400 text-brand-950"
            : "bg-brand-100 text-brand-700 dark:bg-brand-950/60 dark:text-brand-300"
        }`}
      >
        {icon}
      </span>
      <span className="text-sm font-bold leading-tight text-slate-900 dark:text-slate-50">
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
// Redesigned (Sep 2026 — product feedback: "childish" quick actions, bad
// spacing, and text disappearing into its own background) to fully adopt
// the app's shared dark-mode-aware design tokens (brand/slate/gold, all
// with `dark:` pairs) instead of the raw one-off hex this page previously
// hardcoded everywhere (`bg-[#F7F8FA]`, `text-[#1A2E35]`, etc.) with no
// `dark:` variants at all. That mismatch was the real cause of the poor
// contrast reported below the hero: CreatorFeed → CreatorStories is a
// shared, theme-aware component that switches to light-colored `dark:`
// text (e.g. `dark:text-brand-300`, `dark:text-white`) whenever the site's
// dark mode is on — but this page's own background stayed forced-light
// regardless of theme, so that text rendered as light-on-light and nearly
// vanished. Making every surface here theme-aware (not just the shared
// children) fixes that for good instead of patching one heading at a time.
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
    <main className="min-h-screen bg-slate-50 px-4 pb-28 pt-4 text-slate-900 dark:bg-slate-950 dark:text-slate-50 sm:px-6 sm:pt-6">
      <div className="mx-auto flex w-full max-w-[420px] flex-col gap-4">
        <section aria-label="Creator quick actions" className="grid grid-cols-3 gap-3">
          <QuickAction
            href="/creators"
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
          className="relative min-h-[312px] overflow-hidden rounded-[24px] bg-brand-900 shadow-lg"
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
          <div className="relative flex min-h-[312px] flex-col justify-center px-6 py-8">
            <p className="max-w-[230px] text-[10px] font-extrabold uppercase tracking-[0.22em] text-brand-200">
              A LOCAL CREATOR COMMUNITY
            </p>
            <h1
              id="creators-hero-heading"
              className="mt-3 max-w-[285px] text-[27px] font-extrabold leading-[1.12] tracking-tight text-white"
            >
              Discover people, stories and experiences from across Liberia.
            </h1>
            <span
              aria-hidden
              className="mt-5 h-1.5 w-[60px] rounded-full bg-gold-400"
            />
            <p className="mt-4 text-5xl font-black tracking-tight text-white">
              Creators
            </p>
          </div>
        </section>

        <nav
          aria-label="Creator sections"
          className="grid grid-cols-2 rounded-full bg-white p-1.5 shadow-sm dark:bg-slate-900"
        >
          <Link
            href="/creators"
            aria-current={!isFollowing ? "page" : undefined}
            className={`inline-flex min-h-11 items-center justify-center rounded-full px-3 text-sm font-extrabold transition-colors ${!isFollowing ? "bg-brand-700 text-white shadow-sm" : "text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"}`}
          >
            Discover
          </Link>
          <Link
            href="/creators?view=following"
            aria-current={isFollowing ? "page" : undefined}
            className={`inline-flex min-h-11 items-center justify-center rounded-full px-3 text-sm font-extrabold transition-colors ${isFollowing ? "bg-brand-700 text-white shadow-sm" : "text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"}`}
          >
            Following
          </Link>
        </nav>

        <section
          aria-labelledby="creator-feed-section-heading"
          className="pt-2"
        >
          <div className="flex items-end justify-between gap-3">
            <div>
              <p className="text-[11px] font-extrabold uppercase tracking-[0.2em] text-brand-700 dark:text-brand-300">
                LOCAL EXPERTISE
              </p>
              <h2
                id="creator-feed-section-heading"
                className="mt-1 text-[25px] font-extrabold leading-tight tracking-tight text-slate-950 dark:text-slate-50"
              >
                Trip Guides &amp; Hosts
              </h2>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                Experience Liberia with trusted locals.
              </p>
            </div>
            <Link
              href="/guides"
              className="inline-flex min-h-11 shrink-0 items-center gap-1 text-sm font-extrabold text-brand-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 dark:text-brand-300"
            >
              See all <ArrowRightIcon aria-hidden className="h-4 w-4" />
            </Link>
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
