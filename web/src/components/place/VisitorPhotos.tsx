import { getLocale, getTranslations } from 'next-intl/server';
import { SafeImage } from '@/components/SafeImage';
import { resolveImageUrl, resolveThumbUrl } from '@/lib/images';
import type { Review } from '@/lib/types';

const MAX_PHOTOS = 12;

// Recent photos visitors attached to their reviews, newest first, each
// credited to its reviewer and dated.
export async function VisitorPhotos({ reviews }: { reviews: Review[] }) {
  const t = await getTranslations('placeDetail');
  const locale = await getLocale();
  const photos = [...reviews]
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .flatMap((review) => review.photos.map((photo) => ({ photo, review })))
    .slice(0, MAX_PHOTOS);
  if (photos.length === 0) return null;
  const fmt = new Intl.DateTimeFormat(locale, { month: 'short', year: 'numeric' });

  return (
    <section aria-labelledby="visitor-photos" className="flex flex-col gap-3">
      <h2 id="visitor-photos" className="font-display text-xl font-bold text-slate-950 dark:text-slate-50">
        {t('visitorPhotos')}
      </h2>
      <ul className="-mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0">
        {photos.map(({ photo, review }, i) => (
          <li key={`${review.id}-${i}`} className="w-40 shrink-0 snap-start sm:w-48">
            <a href={resolveImageUrl(photo)} target="_blank" rel="noopener noreferrer" className="block overflow-hidden rounded-2xl">
              <SafeImage
                src={resolveImageUrl(photo)}
                thumbSrc={resolveThumbUrl(photo)}
                alt={t('visitorPhotoAlt', { name: review.user?.name ?? t('aVisitor') })}
                className="aspect-square w-full object-cover transition-transform duration-500 hover:scale-105 motion-reduce:transition-none"
                fallback={<div className="aspect-square w-full bg-slate-200 dark:bg-slate-800" />}
              />
            </a>
            <p className="mt-1 truncate text-xs text-slate-500 dark:text-slate-400">
              {review.user?.name ?? t('aVisitor')} · {fmt.format(new Date(review.createdAt))}
            </p>
          </li>
        ))}
      </ul>
    </section>
  );
}
