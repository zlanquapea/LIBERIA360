import Link from "next/link";
import { getExperience } from "@/lib/api";
import { PageHeader } from "@/components/PageHeader";
import { GuideBookingForm } from "@/components/GuideBookingForm";

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
    twitter: {
      card: "summary_large_image",
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
    <main className="page-shell max-w-4xl pb-32">
      <PageHeader
        eyebrow="Book a local experience"
        title={experience.title}
        description={`${experience.category} · ${experience.county}`}
        action={
          <Link
            href={`/guides/${experience.guide.slug}`}
            className="button-secondary"
          >
            View guide
          </Link>
        }
      />
      <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
        {experience.coverImageUrl ? (
          <img
            src={experience.coverImageUrl}
            alt=""
            className="h-56 w-full object-cover sm:h-72"
          />
        ) : (
          <div className="h-32 bg-gradient-to-br from-brand-800 to-accent-500 sm:h-44" />
        )}
        <div className="p-5 sm:p-7">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-200">
              ✓ Verified host
            </span>
            <span className="text-sm text-slate-500 dark:text-slate-400">
              Hosted by {experience.guide.slug}
            </span>
          </div>
          <div className="mt-4 grid gap-3 text-sm sm:grid-cols-3">
            <div>
              <span className="block text-slate-500 dark:text-slate-400">
                From
              </span>
              <strong className="text-lg">
                ${experience.priceUsd.toFixed(2)}
              </strong>
              {experience.priceLrd != null && (
                <span className="ml-2 text-slate-500">
                  / LRD {experience.priceLrd.toLocaleString()}
                </span>
              )}
            </div>
            <div>
              <span className="block text-slate-500 dark:text-slate-400">
                Duration
              </span>
              <strong>{experience.durationMinutes} minutes</strong>
            </div>
            <div>
              <span className="block text-slate-500 dark:text-slate-400">
                Group
              </span>
              <strong>
                {experience.groupType.replaceAll("_", " ")} · max{" "}
                {experience.maxGroupSize}
              </strong>
            </div>
          </div>
          <p className="mt-6 whitespace-pre-line text-sm leading-7 text-slate-600 dark:text-slate-300">
            {experience.description}
          </p>
          <div className="mt-6 grid gap-5 sm:grid-cols-2">
            <div>
              <h2 className="font-display text-lg font-bold">Meeting point</h2>
              <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
                {experience.meetingPointText}
              </p>
            </div>
            <div>
              <h2 className="font-display text-lg font-bold">
                What&apos;s included
              </h2>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-600 dark:text-slate-300">
                {experience.includes.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
          </div>
          <div className="mt-6 border-t border-slate-200 pt-5 dark:border-slate-800">
            <h2 className="font-display text-lg font-bold">
              Cancellation policy
            </h2>
            <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">
              {experience.cancellationPolicy}
            </p>
          </div>
        </div>
      </section>
      <div className="mt-6">
        <GuideBookingForm
          experienceId={experience.id}
          maxGroupSize={experience.maxGroupSize}
        />
      </div>
    </main>
  );
}
