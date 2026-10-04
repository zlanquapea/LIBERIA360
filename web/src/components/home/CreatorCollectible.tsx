import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { MapPinIcon, StarIcon } from '@heroicons/react/20/solid';
import { CheckBadgeIcon } from '@heroicons/react/24/solid';
import { InteractiveCard } from '@/components/InteractiveCard';
import { SafeImage } from '@/components/SafeImage';
import { colorForCreator } from '@/lib/category-colors';
import { formatCreatorCategory } from '@/lib/format';
import { resolveImageUrl, resolveThumbUrl } from '@/lib/images';
import type { Creator } from '@/lib/types';

/**
 * A local creator as a collectible card: a coloured frame, their work in
 * the art window, their portrait on the edge of it, a "type" line, and a
 * stats bar (followers, rating, years). Verified creators get a gold frame
 * and a holographic foil that follows the pointer. Every number shown is
 * real; anything missing is left out rather than invented.
 */
export function CreatorCollectible({ creator }: { creator: Creator }) {
  const t = useTranslations('creatorCard');
  const verified = creator.verificationStatus === 'verified';
  const art = creator.coverImage ?? creator.profileImage;
  const tint = colorForCreator(creator.username);
  const where = creator.county?.name ?? creator.locationsCovered.slice(0, 2).join(', ');

  const stats = [
    creator.followerCount > 0 && { label: t('followers'), value: creator.followerCount.toLocaleString() },
    creator.reviewCount > 0 && { label: t('rating'), value: Number(creator.rating).toFixed(1), star: true },
    creator.yearsExperience != null && creator.yearsExperience > 0 && { label: t('years'), value: String(creator.yearsExperience) },
  ].filter(Boolean) as Array<{ label: string; value: string; star?: boolean }>;

  return (
    <InteractiveCard
      className={`group relative isolate h-full rounded-[1.6rem] p-[7px] shadow-card ${verified ? 'bg-gradient-to-br from-gold-300 via-gold-500 to-amber-700' : ''}`}
      style={verified ? undefined : { backgroundColor: tint }}
    >
      <Link
        href={`/creators/${creator.username}`}
        className="flex h-full flex-col overflow-hidden rounded-[1.2rem] bg-white focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-inset focus-visible:ring-brand-300 dark:bg-slate-900"
      >
        {/* Name bar, like the top of a trading card. */}
        <div className="flex items-center justify-between gap-2 px-3 pb-2 pt-2.5">
          <h3 className="flex min-w-0 items-center gap-1 font-display text-base font-black text-slate-950 dark:text-white">
            <span className="truncate">{creator.name}</span>
            {verified && (
              <>
                <CheckBadgeIcon aria-hidden className="h-4 w-4 shrink-0 text-gold-500" />
                <span className="sr-only">{t('verified')}</span>
              </>
            )}
          </h3>
          {creator.featured && (
            <span className="shrink-0 rounded-full bg-gold-400 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-slate-950">{t('featured')}</span>
          )}
        </div>

        {/* Art window. */}
        <div className="relative mx-3 aspect-[4/3] overflow-hidden rounded-xl bg-slate-200 ring-1 ring-black/10 dark:bg-slate-800">
          <SafeImage
            src={art ? resolveImageUrl(art) : null}
            thumbSrc={art ? resolveThumbUrl(art) : null}
            alt=""
            className="absolute inset-0 h-full w-full object-cover transition-transform duration-[900ms] ease-out group-hover:scale-[1.06] motion-reduce:transition-none"
            fallback={<div aria-hidden className="absolute inset-0" style={{ background: `linear-gradient(135deg, ${tint}, #082e21)` }} />}
          />
          <span
            aria-hidden
            className="absolute bottom-2 start-2 flex h-12 w-12 items-center justify-center overflow-hidden rounded-full text-lg font-bold text-white ring-[3px] ring-white dark:ring-slate-900"
            style={{ backgroundColor: tint }}
          >
            <SafeImage
              src={creator.profileImage ? resolveImageUrl(creator.profileImage) : null}
              thumbSrc={creator.profileImage ? resolveThumbUrl(creator.profileImage) : null}
              alt=""
              className="h-full w-full object-cover"
              fallback={<>{creator.name.trim().charAt(0).toUpperCase() || '?'}</>}
            />
          </span>
        </div>

        {/* Type line. */}
        <div className="mx-3 mt-2 flex items-center justify-between gap-2 rounded-lg px-2 py-1 text-[11px] font-bold uppercase tracking-wider text-white" style={{ backgroundColor: tint }}>
          <span className="truncate">{formatCreatorCategory(creator.category)}</span>
          {where && (
            <span className="flex min-w-0 items-center gap-0.5 normal-case tracking-normal opacity-90">
              <MapPinIcon aria-hidden className="h-3 w-3 shrink-0" />
              <span className="truncate">{where}</span>
            </span>
          )}
        </div>

        {creator.bio && <p className="mx-3 mt-2 line-clamp-2 text-xs italic leading-5 text-slate-600 dark:text-slate-300">“{creator.bio}”</p>}

        {stats.length > 0 && (
          <dl className="mx-3 mb-3 mt-auto grid gap-1 pt-2" style={{ gridTemplateColumns: `repeat(${stats.length}, minmax(0, 1fr))` }}>
            {stats.map((s) => (
              <div key={s.label} className="rounded-lg bg-slate-100 px-1 py-1.5 text-center dark:bg-slate-800">
                <dd className="flex items-center justify-center gap-0.5 font-display text-sm font-black tabular-nums text-slate-950 dark:text-white">
                  {s.star && <StarIcon aria-hidden className="h-3.5 w-3.5 text-gold-500" />}
                  {s.value}
                </dd>
                <dt className="text-[9px] font-bold uppercase tracking-[0.14em] text-slate-500">{s.label}</dt>
              </div>
            ))}
          </dl>
        )}
        {stats.length === 0 && <span className="mb-3" />}
      </Link>
      {verified && <span aria-hidden className="lib-holo" />}
    </InteractiveCard>
  );
}
