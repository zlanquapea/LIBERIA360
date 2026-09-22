import Link from "next/link";
import { getGuide, getExperiences } from "@/lib/api";
import { PageHeader } from "@/components/PageHeader";

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
    twitter: {
      card: "summary_large_image",
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
  return (
    <main className="page-shell max-w-4xl pb-32">
      <PageHeader
        eyebrow="Trip Guides & Hosts"
        title={guide.slug}
        description={`${guide.city}${guide.county?.name ? ` · ${guide.county.name}` : ""}`}
        action={
          <Link href="/guides" className="button-secondary">
            All guides
          </Link>
        }
      />
      <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-7">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
          <div className="flex h-28 w-28 shrink-0 items-center justify-center overflow-hidden rounded-3xl bg-brand-100 text-4xl font-bold text-brand-800 dark:bg-brand-950 dark:text-brand-200">
            {guide.profileImageUrl ? (
              <img
                src={guide.profileImageUrl}
                alt=""
                className="h-full w-full object-cover"
              />
            ) : (
              guide.slug.charAt(0).toUpperCase()
            )}
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="font-display text-2xl font-extrabold">
                {guide.slug}
              </h1>
              <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-200">
                ✓ Verified
              </span>
            </div>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              {guide.guideType.replaceAll("_", " ")} · {guide.city}
            </p>
            <p className="mt-3 font-semibold text-accent-700 dark:text-accent-300">
              ★ {guide.rating.toFixed(1)} · {guide.reviewCount} reviews
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              {guide.languages.map((language) => (
                <span
                  key={language}
                  className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold dark:bg-slate-800"
                >
                  {language}
                </span>
              ))}
            </div>
          </div>
        </div>
        <div className="mt-7 grid gap-3 sm:grid-cols-2">
          <a
            href={
              guide.whatsappNumber
                ? `https://wa.me/${guide.whatsappNumber.replace(/\D/g, "")}`
                : undefined
            }
            className={`button-primary min-h-11 ${!guide.whatsappNumber ? "pointer-events-none opacity-50" : ""}`}
          >
            Message on WhatsApp
          </a>
          <a href="#experiences" className="button-secondary min-h-11">
            View Experiences
          </a>
        </div>
      </section>
      <section className="mt-6 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <h2 className="font-display text-xl font-bold">About</h2>
        <p className="mt-3 whitespace-pre-line text-sm leading-7 text-slate-600 dark:text-slate-300">
          {guide.bio}
        </p>
      </section>
      <section id="experiences" className="mt-6">
        <div className="mb-3 flex items-end justify-between gap-3">
          <div>
            <p className="eyebrow">Book with this guide</p>
            <h2 className="font-display text-2xl font-bold">
              Featured experiences
            </h2>
          </div>
        </div>
        {experiences.length === 0 ? (
          <p className="empty-state">
            This guide has no published experiences yet.
          </p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {experiences.map((experience) => (
              <article
                key={experience.id}
                className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900"
              >
                <p className="text-xs font-bold uppercase tracking-wider text-brand-700 dark:text-brand-300">
                  {experience.category}
                </p>
                <h3 className="mt-2 font-display text-lg font-bold">
                  {experience.title}
                </h3>
                <p className="mt-2 line-clamp-3 text-sm text-slate-600 dark:text-slate-300">
                  {experience.description}
                </p>
                <p className="mt-4 text-sm font-semibold">
                  From ${experience.priceUsd.toFixed(2)} ·{" "}
                  {experience.durationMinutes} min
                </p>
                <Link
                  href={`/experiences/${experience.id}`}
                  className="button-secondary mt-4 min-h-11 w-full"
                >
                  View experience
                </Link>
              </article>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
