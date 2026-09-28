import Link from "next/link";
import { getExperience } from "@/lib/api";
import { GuideBookingForm } from "@/components/GuideBookingForm";
import { formatExperienceDuration } from "@/lib/format";
import {
  MapPinIcon,
  ClockIcon,
  UserGroupIcon,
  BookmarkIcon,
  CalendarDaysIcon,
  CheckBadgeIcon,
} from "@heroicons/react/24/solid";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const experience = await getExperience(id);
  return {
    title: `${experience.title} — LIBERIA360`,
    description: experience.description,
    openGraph: {
      title: experience.title,
      description: experience.description,
      images: experience.coverImageUrl
        ? [experience.coverImageUrl]
        : ["/logo.png"],
    },
  };
}

export default async function ExperiencePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const experience = await getExperience(id);
  return (
    <main className="mx-auto max-w-5xl px-4 py-5 pb-12 sm:px-6 lg:px-10">
      <div className="mb-5 flex items-center justify-between">
        <Link
          href={`/guides/${experience.guide.slug}`}
          className="text-sm font-bold text-brand-700"
        >
          ← View guide
        </Link>
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-brand-700">
          LIBERIA360 creators
        </p>
      </div>
      <section className="overflow-hidden rounded-3xl bg-white shadow-sm dark:bg-slate-900">
        {(experience.imageUrls?.[0] ?? experience.coverImageUrl) ? (
          <img
            src={experience.imageUrls?.[0] ?? experience.coverImageUrl ?? ""}
            alt={`${experience.title} experience`}
            className="h-56 w-full object-cover sm:h-80"
          />
        ) : (
          <div className="h-56 bg-gradient-to-br from-brand-900 via-brand-700 to-cyan-400 sm:h-80" />
        )}
        {experience.imageUrls && experience.imageUrls.length > 1 && (
          <div className="grid grid-cols-4 gap-1 bg-slate-100 p-1 dark:bg-slate-800">
            {experience.imageUrls.slice(0, 4).map((url, index) => (
              <img
                key={url}
                src={url}
                alt={`${experience.title} photo ${index + 1}`}
                className="h-20 w-full object-cover sm:h-28"
              />
            ))}
          </div>
        )}
        <div className="p-5 sm:p-8">
          <p className="text-xs font-bold uppercase tracking-[0.22em] text-brand-700">
            {experience.category}
          </p>
          <h1 className="mt-2 font-display text-3xl font-extrabold tracking-tight text-slate-950 dark:text-slate-50 sm:text-4xl">
            {experience.title}
          </h1>
          <div className="mt-5 flex flex-wrap items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center overflow-hidden rounded-full border-4 border-emerald-500 bg-brand-100">
              {experience.guide.profileImageUrl ? (
                <img
                  src={experience.guide.profileImageUrl}
                  alt=""
                  className="h-full w-full object-cover"
                />
              ) : (
                <span className="font-bold text-brand-800">
                  {experience.guide.slug.charAt(0).toUpperCase()}
                </span>
              )}
            </div>
            <div>
              <p className="text-sm text-slate-500">Hosted by</p>
              <Link
                href={`/guides/${experience.guide.slug}`}
                className="font-display text-lg font-extrabold"
              >
                {experience.guide.slug.replaceAll("-", " ")}
              </Link>
              <span className="ml-2 inline-flex items-center gap-1 rounded-full bg-amber-300 px-2 py-1 text-xs font-bold">
                <CheckBadgeIcon className="h-3.5 w-3.5" /> Verified Guide
              </span>
            </div>
            <div className="ml-auto text-right">
              <p className="text-2xl font-extrabold text-brand-700">
                ${experience.priceUsd.toFixed(0)}
              </p>
              <p className="text-xs text-slate-500">per booking</p>
            </div>
          </div>
          <div className="mt-6 grid gap-3 border-y border-slate-200 py-4 text-sm dark:border-slate-800 sm:grid-cols-3">
            <span>
              <ClockIcon className="mr-2 inline h-5 w-5 text-brand-700" />
              {formatExperienceDuration(experience.durationMinutes)}
            </span>
            <span>
              <UserGroupIcon className="mr-2 inline h-5 w-5 text-brand-700" />
              {experience.groupType.replaceAll("_", " ")}
            </span>
            <span>
              <MapPinIcon className="mr-2 inline h-5 w-5 text-brand-700" />
              {experience.meetingPointText}
            </span>
          </div>
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <a
              href="#book"
              className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-brand-700 px-5 font-bold text-white"
            >
              <CalendarDaysIcon className="h-5 w-5" /> Request to Book
            </a>
            <button
              type="button"
              className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full border-2 border-brand-700 px-5 font-bold text-brand-700"
            >
              <BookmarkIcon className="h-5 w-5" /> Save to Trip
            </button>
          </div>
        </div>
      </section>
      <section className="mt-8">
        <p className="text-xs font-bold uppercase tracking-[0.22em] text-brand-700">
          What you will experience
        </p>
        <p className="mt-3 max-w-3xl whitespace-pre-line text-base leading-8 text-slate-600 dark:text-slate-300">
          {experience.description}
        </p>
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <div>
            <h2 className="font-display text-xl font-extrabold">
              What&apos;s included
            </h2>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-600 dark:text-slate-300">
              {experience.includes.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
          <div>
            <h2 className="font-display text-xl font-extrabold">
              Cancellation policy
            </h2>
            <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">
              {experience.cancellationPolicy}
            </p>
          </div>
        </div>
      </section>
      <div id="book" className="mt-8">
        <GuideBookingForm
          experienceId={experience.id}
          maxGroupSize={experience.maxGroupSize}
        />
      </div>
    </main>
  );
}
