import Link from "next/link";
import { getGuide, getExperiences } from "@/lib/api";
import { ChevronRightIcon, MapPinIcon } from "@heroicons/react/24/solid";
import { GuideProfileHero } from "@/components/GuideProfileHero";

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
      <GuideProfileHero guide={guide} name={name} />
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
