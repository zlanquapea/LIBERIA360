import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { getCreatorGuides } from '@/lib/api';
import { GuideCard } from '@/components/creator-guides/GuideCard';

export const metadata = {
  title: 'Local guides — LIBERIA360',
  description: 'Guides to real places in Liberia, written by local creators.',
};

// Every published creator guide, newest first.
export default async function CreatorGuidesPage() {
  const t = await getTranslations('creatorGuides');
  const guides = await getCreatorGuides({ limit: 48 });

  return (
    <main className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-8 sm:px-6 lg:px-10">
      <div className="max-w-2xl">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-sunset-700 dark:text-sunset-300">{t('eyebrow')}</p>
        <h1 className="mt-1 font-display text-3xl font-extrabold tracking-tight text-slate-950 dark:text-slate-50 sm:text-4xl">{t('title')}</h1>
        <p className="mt-2 text-slate-600 dark:text-slate-300">{t('intro')}</p>
      </div>
      {guides.data.length > 0 ? (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {guides.data.map((guide) => (
            <li key={guide.id}>
              <GuideCard
                guide={guide}
                byLabel={t('byCreator', { name: guide.creator.name })}
                placesLabel={t('placeCount', { count: guide.stops.length })}
              />
            </li>
          ))}
        </ul>
      ) : (
        <div className="flex flex-col items-start gap-3 rounded-[1.75rem] border border-dashed border-slate-300 p-6 dark:border-slate-700">
          <p className="font-display text-lg font-bold text-slate-900 dark:text-slate-50">{t('emptyTitle')}</p>
          <p className="text-sm text-slate-600 dark:text-slate-300">{t('emptyBody')}</p>
          <Link href="/creators/me/guides" className="inline-flex min-h-11 items-center rounded-full bg-brand-700 px-4 text-sm font-semibold text-white hover:bg-brand-800">
            {t('writeGuide')}
          </Link>
        </div>
      )}
    </main>
  );
}
