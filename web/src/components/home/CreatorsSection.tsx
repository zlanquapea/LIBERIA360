import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { VideoCameraIcon } from '@heroicons/react/24/outline';
import type { Creator, CreatorGuide } from '@/lib/types';
import { GuideCard } from '@/components/creator-guides/GuideCard';
import { SectionHeading } from './SectionHeading';
import { CreatorCollectible } from './CreatorCollectible';

// Local voices: their newest guides to real places first, then the
// creators themselves. With nobody listed yet, the section becomes an
// invitation instead.
export async function CreatorsSection({ creators, guides = [] }: { creators: Creator[]; guides?: CreatorGuide[] }) {
  const t = await getTranslations('discover');
  const tg = await getTranslations('creatorGuides');
  return (
    <section aria-labelledby="creators-heading" className="flex flex-col gap-5">
      <SectionHeading
        id="creators-heading"
        eyebrow={t('creatorsEyebrow')}
        title={t('creatorsTitle')}
        body={t('creatorsBody')}
        href={creators.length > 0 ? '/creators' : undefined}
        linkLabel={t('creatorsSeeAll')}
      />
      {guides.length > 0 && (
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between gap-2">
            <h3 className="font-display text-lg font-bold text-slate-900 dark:text-slate-50">{tg('latestGuides')}</h3>
            <Link href="/creator-guides" className="text-sm font-semibold text-brand-700 hover:underline dark:text-brand-300">
              {tg('allGuides')}
            </Link>
          </div>
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {guides.map((g) => (
              <li key={g.id}>
                <GuideCard guide={g} byLabel={tg('byCreator', { name: g.creator.name })} placesLabel={tg('placeCount', { count: g.stops.length })} />
              </li>
            ))}
          </ul>
        </div>
      )}
      {creators.length > 0 ? (
        <ul className="-mx-4 flex snap-x snap-mandatory gap-4 overflow-x-auto px-4 pb-2 sm:mx-0 sm:grid sm:grid-cols-2 sm:overflow-visible sm:px-0 lg:grid-cols-3">
          {creators.map((creator) => (
            <li key={creator.id} className="reveal-on-scroll w-[72vw] max-w-xs shrink-0 snap-start sm:w-auto sm:max-w-none">
              <CreatorCollectible creator={creator} />
            </li>
          ))}
        </ul>
      ) : (
        <div className="flex flex-col gap-3 rounded-[1.75rem] border border-dashed border-slate-300 bg-white/60 p-5 sm:flex-row sm:items-center sm:justify-between dark:border-slate-700 dark:bg-slate-900/60">
          <p className="text-sm text-slate-600 dark:text-slate-300">{t('creatorsEmpty')}</p>
          <Link
            href="/creators/me"
            className="inline-flex min-h-11 shrink-0 items-center gap-1.5 self-start rounded-full bg-brand-700 px-4 text-sm font-semibold text-white hover:bg-brand-800"
          >
            <VideoCameraIcon aria-hidden className="h-4 w-4" />
            {t('becomeCreator')}
          </Link>
        </div>
      )}
    </section>
  );
}
