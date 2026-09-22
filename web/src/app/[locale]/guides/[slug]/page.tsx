import Link from "next/link";
import { getGuide, getExperiences } from "@/lib/api";
import {
  MapPinIcon,
  StarIcon,
  CheckBadgeIcon,
  ChatBubbleLeftRightIcon,
  CalendarDaysIcon,
  ChevronRightIcon,
} from "@heroicons/react/24/solid";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const guide = await getGuide(slug);
  return {
    title: `${guide.slug} — Trip Guide | LIBERIA360`,
    description: guide.bio,
    openGraph: {
      title: `${guide.slug} — Trip Guide | LIBERIA360`,
      description: guide.bio,
      images: guide.profileImageUrl ? [guide.profileImageUrl] : ["/logo.png"],
    },
  };
}

export default async function GuidePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const guide = await getGuide(slug);
  const experiences = (await getExperiences()).filter(
    (experience) => experience.guide.id === guide.id,
  );
  const name = guide.slug.replaceAll("-", " ");
  return (
    <main className="mx-auto max-w-5xl px-4 py-5 pb-12 sm:px-6 lg:px-10">
      <div className="mb-5 flex items-center justify-between">
        <Link href="/guides" className="text-sm font-bold text-brand-700">
          ← All guides
        </Link>
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-brand-700">
          LIBERIA360 community
        </p>
      </div>
      <section className="rounded-3xl bg-white p-4 shadow-sm dark:bg-slate-900 sm:p-7">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
          <div className="relative h-32 w-32 shrink-0 overflow-hidden rounded-full border-8 border-amber-300 bg-brand-100 dark:bg-brand-950 sm:h-44 sm:w-44">
            {guide.profileImageUrl ? (
              <img
                src={guide.profileImageUrl}
                alt={name}
                className="h-full w-full object-cover"
              />
            ) : (
              <span className="flex h-full items-center justify-center text-5xl font-bold text-brand-800">
                {name.charAt(0).toUpperCase()}
              </span>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="font-display text-3xl font-extrabold capitalize tracking-tight text-slate-950 dark:text-slate-50 sm:text-4xl">
              {name}
            </h1>
            <span className="mt-2 inline-flex items-center gap-1 rounded-full bg-amber-400 px-3 py-1.5 text-sm font-bold text-slate-950">
              <CheckBadgeIcon className="h-5 w-5" /> Verified Guide
            </span>
            <p className="mt-3 text-base text-slate-600 dark:text-slate-300">
              <MapPinIcon className="mr-1 inline h-5 w-5 text-brand-700" />
              {guide.city}, Liberia
            </p>
            <p className="mt-2 text-base font-bold text-slate-800 dark:text-slate-200">
              <StarIcon className="mr-1 inline h-5 w-5 text-amber-400" />
              {guide.rating.toFixed(1)}{" "}
              <span className="font-normal text-slate-500">
                ({guide.reviewCount} reviews)
              </span>
            </p>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
              Languages: {guide.languages.join(" · ")}
            </p>
          </div>
        </div>
        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          <a
            href={
              guide.whatsappNumber
                ? `https://wa.me/${guide.whatsappNumber.replace(/\D/g, "")}`
                : undefined
            }
            className={`inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-brand-700 px-5 font-bold text-white ${!guide.whatsappNumber ? "pointer-events-none opacity-50" : ""}`}
          >
            <ChatBubbleLeftRightIcon className="h-5 w-5" /> Message
          </a>
          <a
            href="#experiences"
            className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full border-2 border-brand-700 px-5 font-bold text-brand-700"
          >
            <CalendarDaysIcon className="h-5 w-5" /> View Experiences
          </a>
        </div>
      </section>
      <section className="mt-7">
        <h2 className="font-display text-2xl font-extrabold">
          About {name.split(" ")[0]}
        </h2>
        <p className="mt-3 whitespace-pre-line text-base leading-8 text-slate-600 dark:text-slate-300">
          {guide.bio}
        </p>
      </section>
      <section id="experiences" className="mt-8">
        <p className="text-xs font-bold uppercase tracking-[0.22em] text-brand-700">
          Featured experiences
        </p>
        <h2 className="mt-1 font-display text-2xl font-extrabold">
          Featured Experiences
        </h2>
        {experiences.length === 0 ? (
          <p className="mt-4 rounded-2xl border border-dashed border-slate-300 p-6 text-slate-500">
            This guide has no published experiences yet.
          </p>
        ) : (
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            {experiences.map((experience) => (
              <Link
                key={experience.id}
                href={`/experiences/${experience.id}`}
                className="group overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900"
              >
                {experience.coverImageUrl ? (
                  <img
                    src={experience.coverImageUrl}
                    alt=""
                    className="h-44 w-full object-cover transition group-hover:scale-[1.02]"
                  />
                ) : (
                  <div className="h-44 bg-gradient-to-br from-brand-800 to-cyan-400" />
                )}
                <div className="p-4">
                  <h3 className="font-display text-xl font-extrabold">
                    {experience.title}
                  </h3>
                  <p className="mt-2 text-sm text-slate-500">
                    <MapPinIcon className="mr-1 inline h-4 w-4 text-brand-700" />
                    {experience.county}
                  </p>
                  <p className="mt-2 font-bold text-slate-800 dark:text-slate-100">
                    From ${experience.priceUsd.toFixed(2)}{" "}
                    <ChevronRightIcon className="float-right inline h-5 w-5 text-brand-700" />
                  </p>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
