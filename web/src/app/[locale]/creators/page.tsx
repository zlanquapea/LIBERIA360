import Link from "next/link";
import { cookies } from "next/headers";
import {
  ArrowRightIcon,
  CalendarDaysIcon,
  CheckBadgeIcon,
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
  return (
    <Link
      href={href}
      className={`flex h-16 min-w-0 flex-1 basis-0 items-center gap-1 rounded-xl px-2 py-2 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0F3B3E] focus-visible:ring-offset-2 ${emphasized ? "bg-[#FAECC5]" : "bg-[#E4F1F7]"}`}
    >
      <span
        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${emphasized ? "bg-[#F5C242] text-[#8A6D1F]" : "bg-[#0F3B3E] text-white"}`}
      >
        <span className="[&>svg]:h-4 [&>svg]:w-4">{icon}</span>
      </span>
      <span className="min-w-0 flex-1 text-left text-[13px] font-extrabold leading-[1.1] text-[#1A2E35]">
        {label}
      </span>
      <ChevronRightIcon
        aria-hidden
        className="h-3 w-3 shrink-0 text-[#0F3B3E]"
      />
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
      className="group block rounded-2xl border border-white bg-white p-4 shadow-[0_8px_24px_rgba(26,46,53,0.08)] transition hover:-translate-y-0.5 hover:shadow-[0_12px_28px_rgba(26,46,53,0.14)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0F3B3E] focus-visible:ring-offset-2"
    >
      <div className="flex items-start gap-3">
        <div className="h-[90px] w-[90px] shrink-0 overflow-hidden rounded-full border-4 border-[#E4F1F7] bg-[#E4F1F7]">
          {guide.profileImageUrl ? (
            <img
              src={guide.profileImageUrl}
              alt={`${name} portrait`}
              className="h-full w-full object-cover"
            />
          ) : (
            <span className="flex h-full items-center justify-center text-2xl font-extrabold text-[#0F3B3E]">
              {name.charAt(0)}
            </span>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <h3 className="truncate text-lg font-extrabold leading-tight text-[#1A2E35]">
                {name}
              </h3>
              <span className="mt-1 inline-flex max-w-full items-center gap-1 rounded-full bg-[#FAECC5] px-2 py-1 text-[10px] font-extrabold text-[#8A6D1F]">
                <ShieldCheckIcon aria-hidden className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate">
                  Verified {guideTypeLabel(guide.guideType)}
                </span>
              </span>
            </div>
            <ChevronRightIcon
              aria-hidden
              className="mt-1 h-5 w-5 shrink-0 text-[#0F3B3E]"
            />
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-[#6B7A85]">
            <span className="inline-flex items-center gap-1">
              <MapPinIcon aria-hidden className="h-3.5 w-3.5 text-[#0F3B3E]" />
              {guide.city}
            </span>
            <span aria-hidden className="text-slate-300">
              |
            </span>
            <span className="inline-flex items-center gap-1">
              <StarIcon aria-hidden className="h-3.5 w-3.5 text-[#F5C242]" />
              <span className="font-semibold text-[#1A2E35]">
                {guide.rating.toFixed(1)} ({guide.reviewCount})
              </span>
            </span>
          </div>
          {languages.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {languages.map((language) => (
                <span
                  key={language}
                  className="rounded-full bg-[#E4F1F7] px-2.5 py-1 text-[11px] font-bold text-[#1A2E35]"
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
    <main className="min-h-screen overflow-x-hidden bg-[#F7F8FA] px-4 pb-28 pt-0 text-[#1A2E35] sm:px-6 sm:pt-6">
      <div className="mx-auto flex w-full max-w-[390px] flex-col">
        <section aria-label="Creator quick actions" className="flex gap-2">
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
          className="relative mt-4 h-[290px] overflow-hidden rounded-[20px] bg-[#0F3B3E] shadow-[0_12px_30px_rgba(15,59,62,0.18)]"
          style={{
            backgroundImage: "url('/onboarding/discover.jpg')",
            backgroundPosition: "62% center",
            backgroundSize: "cover",
          }}
        >
          <div
            aria-hidden
            className="absolute inset-0 bg-[linear-gradient(90deg,rgba(15,59,62,0.98)_0%,rgba(15,59,62,0.82)_38%,rgba(15,59,62,0.2)_100%)]"
          />
          <div className="relative flex h-full flex-col justify-center px-5 pb-6 pt-5">
            <p className="text-[11px] font-extrabold uppercase tracking-[1.5px] text-[#A8E2E0]">
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
              className="my-3 h-1 w-10 rounded-full bg-[#F5C242]"
            />
            <p className="text-[38px] font-black leading-none tracking-tight text-white">
              Creators
            </p>
          </div>
        </section>

        <nav
          aria-label="Creator sections"
          className="mt-4 grid h-14 grid-cols-2 rounded-full bg-white p-1 shadow-[0_2px_8px_rgba(0,0,0,0.06)]"
        >
          <Link
            href="/creators"
            aria-current={!isFollowing ? "page" : undefined}
            className={`inline-flex h-12 items-center justify-center rounded-full px-3 text-base font-extrabold transition ${!isFollowing ? "bg-[#0F3B3E] text-white shadow-sm" : "text-[#6B7A85] hover:bg-[#F7F8FA]"}`}
          >
            Discover
          </Link>
          <Link
            href="/creators?view=following"
            aria-current={isFollowing ? "page" : undefined}
            className={`inline-flex h-12 items-center justify-center rounded-full px-3 text-base font-extrabold transition ${isFollowing ? "bg-[#0F3B3E] text-white shadow-sm" : "text-[#6B7A85] hover:bg-[#F7F8FA]"}`}
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
              <p className="text-[11px] font-extrabold uppercase tracking-[1.5px] text-[#0F7775]">
                LOCAL EXPERTISE
              </p>
              <h2
                id="creator-feed-section-heading"
                className="mt-1 text-[26px] font-extrabold leading-tight tracking-tight text-[#1A2E35]"
              >
                Trip Guides &amp; Hosts
              </h2>
              <div className="mt-1 flex items-center justify-between gap-3">
                <p className="text-[15px] text-[#6B7A85]">
                  Experience Liberia with trusted locals.
                </p>
                <Link
                  href="/guides"
                  className="inline-flex min-h-10 shrink-0 items-center gap-1 text-[15px] font-extrabold text-[#0F3B3E] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0F3B3E] focus-visible:ring-offset-2"
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
            <div className="mt-4 rounded-2xl border border-dashed border-[#B9DDE0] bg-white p-5 text-sm text-[#6B7A85]">
              No approved guides yet.{" "}
              <Link
                href="/guides/apply"
                className="font-bold text-[#0F3B3E] underline"
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
