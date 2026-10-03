import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getLocale, getTranslations } from 'next-intl/server';
import { CheckBadgeIcon } from '@heroicons/react/24/solid';
import { ApiError, getCreatorGuide } from '@/lib/api';
import { absoluteImageUrl, resolveImageUrl, resolveThumbUrl } from '@/lib/images';
import { DEFAULT_OG_IMAGE, absoluteUrl } from '@/lib/site';
import { formatCreatorCategory } from '@/lib/format';
import { SafeImage } from '@/components/SafeImage';
import { PlaceCardCompact } from '@/components/PlaceCardCompact';
import { GuideActions } from '@/components/creator-guides/GuideActions';
import { GuideVideo } from '@/components/creator-guides/GuideVideo';

async function load(slug: string) {
  return getCreatorGuide(slug).catch((err) => {
    if (err instanceof ApiError && err.status === 404) return null;
    throw err;
  });
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const guide = await load(slug).catch(() => null);
  if (!guide) return { title: 'Guide — LIBERIA360' };
  const title = `${guide.title} — a guide by ${guide.creator.name}`;
  const image = (guide.coverImage ? absoluteImageUrl(guide.coverImage) : null) ?? DEFAULT_OG_IMAGE;
  return {
    title,
    description: guide.summary.slice(0, 160),
    openGraph: { type: 'article', title, url: absoluteUrl(`/creator-guides/${guide.slug}`), images: [{ url: image }] },
  };
}

// A published creator guide: who wrote it, the video (on demand), and its
// places day by day with the creator's notes.
export default async function CreatorGuidePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const guide = await load(slug);
  if (!guide) notFound();
  const t = await getTranslations('creatorGuides');
  const locale = await getLocale();
  const days = [...new Set(guide.stops.map((s) => s.day))].sort((a, b) => a - b);
  const multiDay = days.length > 1;
  const published = guide.publishedAt
    ? new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(guide.publishedAt))
    : null;
  const avatar = guide.creator.profileImage;

  return (
    <main className="mx-auto flex max-w-4xl flex-col gap-6 px-4 py-8 sm:px-6">
      {guide.coverImage && (
        <SafeImage
          src={resolveImageUrl(guide.coverImage)}
          thumbSrc={resolveThumbUrl(guide.coverImage)}
          alt=""
          loading="eager"
          className="aspect-[16/9] w-full rounded-[2rem] object-cover"
          fallback={null}
        />
      )}

      <header className="flex flex-col gap-3">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-sunset-700 dark:text-sunset-300">{t('eyebrow')}</p>
        <h1 className="font-display text-3xl font-extrabold tracking-tight text-slate-950 dark:text-slate-50 sm:text-4xl">{guide.title}</h1>
        <Link href={`/creators/${guide.creator.username}`} className="flex w-fit items-center gap-3 rounded-full pe-3 hover:bg-slate-100 dark:hover:bg-slate-800">
          <SafeImage
            src={avatar ? resolveImageUrl(avatar) : null}
            thumbSrc={avatar ? resolveThumbUrl(avatar) : null}
            alt=""
            className="h-10 w-10 rounded-full object-cover"
            fallback={<span aria-hidden className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-700 font-bold text-white">{guide.creator.name.slice(0, 1)}</span>}
          />
          <span className="text-sm">
            <span className="flex items-center gap-1 font-semibold text-slate-900 dark:text-slate-50">
              {guide.creator.name}
              {guide.creator.verificationStatus === 'verified' && <CheckBadgeIcon aria-label={t('verifiedCreator')} className="h-4 w-4 text-brand-600" />}
            </span>
            <span className="text-slate-500 dark:text-slate-400">
              {formatCreatorCategory(guide.creator.category)}
              {published && ` · ${t('publishedOn', { date: published })}`}
            </span>
          </span>
        </Link>
        <p className="whitespace-pre-line leading-7 text-slate-700 dark:text-slate-200">{guide.summary}</p>
        <GuideActions guideId={guide.id} title={guide.title} />
      </header>

      {guide.videoUrl && <GuideVideo url={guide.videoUrl} title={guide.title} poster={guide.coverImage} />}

      <section aria-labelledby="guide-places" className="flex flex-col gap-5">
        <h2 id="guide-places" className="font-display text-2xl font-bold text-slate-950 dark:text-slate-50">
          {t('placesInGuide', { count: guide.stops.length })}
        </h2>
        {days.map((day) => (
          <div key={day} className="flex flex-col gap-3">
            {multiDay && <h3 className="font-semibold text-slate-700 dark:text-slate-200">{t('day', { day })}</h3>}
            <ol className="flex flex-col gap-3">
              {guide.stops
                .filter((s) => s.day === day)
                .map((stop) => (
                  <li key={stop.place.id} className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900 sm:grid-cols-[12rem_1fr]">
                    <PlaceCardCompact place={stop.place} />
                    <div className="flex flex-col gap-1">
                      {stop.note ? (
                        <blockquote className="border-s-4 border-sunset-400 ps-3 text-slate-700 dark:text-slate-200">
                          <p className="whitespace-pre-line">{stop.note}</p>
                          <footer className="mt-1 text-xs text-slate-500 dark:text-slate-400">— {guide.creator.name}</footer>
                        </blockquote>
                      ) : (
                        <p className="text-sm text-slate-500 dark:text-slate-400">{t('noNote')}</p>
                      )}
                    </div>
                  </li>
                ))}
            </ol>
          </div>
        ))}
      </section>

      <p className="rounded-xl bg-slate-100 px-3 py-2 text-xs leading-5 text-slate-600 dark:bg-slate-800 dark:text-slate-300">
        {t('attributionNote', { name: guide.creator.name })}
      </p>
    </main>
  );
}
