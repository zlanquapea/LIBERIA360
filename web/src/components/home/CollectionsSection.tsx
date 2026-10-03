import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { ArrowRightIcon } from '@heroicons/react/24/outline';
import { SafeImage } from '@/components/SafeImage';
import { resolveImageUrl, resolveThumbUrl } from '@/lib/images';
import { collectionHref, type Collection, type CollectionSummary } from '@/lib/home-discovery';
import { SectionHeading } from './SectionHeading';


const FALLBACK_TINT: Record<Collection['id'], string> = {
  beach: 'from-sky-700 via-brand-700 to-brand-950',
  food: 'from-sunset-600 via-sunset-800 to-slate-950',
  nature: 'from-brand-500 via-brand-800 to-brand-950',
  culture: 'from-gold-700 via-sunset-900 to-slate-950',
};

// Four ways into the catalog by mood. Covers are genuine catalog photos
// (credited to their place); with no photo yet, a tinted panel stands in
// rather than an unrelated stock image.
export async function CollectionsSection({ summaries }: { summaries: CollectionSummary[] }) {
  const t = await getTranslations('discover');
  return (
    <section aria-labelledby="collections-heading" className="flex flex-col gap-5">
      <SectionHeading id="collections-heading" eyebrow={t('collectionsEyebrow')} title={t('collectionsTitle')} />
      <ul className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        {summaries.map(({ collection, count, cover, coverPlaceName }) => {
          const href = count > 0 ? collectionHref(collection) : '/places/submit';
          return (
            <li key={collection.id}>
              <Link
                href={href}
                className="group relative flex aspect-[4/5] flex-col justify-end overflow-hidden rounded-[1.75rem] bg-brand-950 text-white shadow-card transition-all hover:-translate-y-1 hover:shadow-float motion-reduce:transition-none motion-reduce:hover:translate-y-0 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-sunset-300 sm:aspect-[3/4]"
              >
                <SafeImage
                  src={cover ? resolveImageUrl(cover) : null}
                  thumbSrc={cover ? resolveThumbUrl(cover) : null}
                  alt=""
                  className="absolute inset-0 h-full w-full object-cover transition-transform duration-700 group-hover:scale-105 motion-reduce:transition-none"
                  fallback={<div aria-hidden className={`absolute inset-0 bg-gradient-to-br ${FALLBACK_TINT[collection.id]}`} />}
                />
                <div aria-hidden className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/30 to-transparent" />
                <div className="relative flex flex-col gap-1 p-4 sm:p-5">
                  <h3 className="font-display text-lg font-extrabold leading-tight sm:text-2xl">{t(`collection_${collection.id}`)}</h3>
                  <p className="line-clamp-2 text-xs text-white/80 sm:text-sm">{t(`collection_${collection.id}_desc`)}</p>
                  <p className="mt-1 inline-flex items-center gap-1 text-xs font-semibold text-sunset-200">
                    {t('collectionCount', { count })}
                    <ArrowRightIcon aria-hidden className="h-3.5 w-3.5 rtl:-scale-x-100" />
                  </p>
                  {cover && coverPlaceName && (
                    <p className="text-[10px] text-white/60">{coverPlaceName}</p>
                  )}
                </div>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
