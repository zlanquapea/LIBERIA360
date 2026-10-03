import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { CheckBadgeIcon } from '@heroicons/react/24/solid';
import { MapPinIcon, VideoCameraIcon } from '@heroicons/react/24/outline';
import { SafeImage } from '@/components/SafeImage';
import { formatCreatorCategory } from '@/lib/format';
import { resolveImageUrl, resolveThumbUrl } from '@/lib/images';
import type { Creator } from '@/lib/types';
import { SectionHeading } from './SectionHeading';

// Local creators with their own cover photo and the places they cover.
// With nobody listed yet, the section becomes an invitation instead.
export async function CreatorsSection({ creators }: { creators: Creator[] }) {
  const t = await getTranslations('discover');
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
      {creators.length > 0 ? (
        <ul className="-mx-4 flex snap-x snap-mandatory gap-4 overflow-x-auto px-4 pb-2 sm:mx-0 sm:grid sm:grid-cols-2 sm:overflow-visible sm:px-0 lg:grid-cols-3">
          {creators.map((creator) => {
            const cover = creator.coverImage ?? creator.profileImage;
            const where = creator.county?.name ?? creator.locationsCovered.slice(0, 2).join(', ');
            return (
              <li key={creator.id} className="w-[78vw] max-w-sm shrink-0 snap-start sm:w-auto sm:max-w-none">
                <Link
                  href={`/creators/${creator.username}`}
                  className="group flex h-full flex-col overflow-hidden rounded-[1.5rem] border border-slate-200 bg-white shadow-card transition-all hover:-translate-y-0.5 hover:shadow-card-hover motion-reduce:transition-none motion-reduce:hover:translate-y-0 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-300 dark:border-slate-800 dark:bg-slate-900"
                >
                  <div className="relative h-36 overflow-hidden bg-brand-900">
                    <SafeImage
                      src={cover ? resolveImageUrl(cover) : null}
                      thumbSrc={cover ? resolveThumbUrl(cover) : null}
                      alt=""
                      className="h-36 w-full object-cover transition-transform duration-500 group-hover:scale-105 motion-reduce:transition-none"
                      fallback={<div aria-hidden className="h-36 bg-gradient-to-br from-brand-700 to-brand-950" />}
                    />
                  </div>
                  <div className="flex flex-1 flex-col gap-1.5 p-4">
                    <p className="flex items-center gap-1 font-display text-base font-bold text-slate-900 dark:text-slate-50">
                      <span className="truncate">{creator.name}</span>
                      {creator.verificationStatus === 'verified' && (
                        <CheckBadgeIcon aria-label="Verified" className="h-4 w-4 shrink-0 text-brand-600" />
                      )}
                    </p>
                    <p className="text-xs font-semibold uppercase tracking-wide text-sunset-700 dark:text-sunset-300">
                      {formatCreatorCategory(creator.category)}
                    </p>
                    {creator.bio && <p className="line-clamp-2 text-sm text-slate-600 dark:text-slate-300">{creator.bio}</p>}
                    {where && (
                      <p className="mt-auto flex items-center gap-1 pt-1 text-xs text-slate-500 dark:text-slate-400">
                        <MapPinIcon aria-hidden className="h-3.5 w-3.5" />
                        <span className="truncate">{where}</span>
                      </p>
                    )}
                  </div>
                </Link>
              </li>
            );
          })}
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
