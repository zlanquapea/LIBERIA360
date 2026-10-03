import { getTranslations } from 'next-intl/server';
import { GuideCard } from './GuideCard';
import type { CreatorGuide } from '@/lib/types';

// Published creator guides that include this place.
export async function PlaceInGuides({ guides }: { guides: CreatorGuide[] }) {
  if (guides.length === 0) return null;
  const t = await getTranslations('creatorGuides');
  return (
    <section aria-labelledby="place-guides" className="flex flex-col gap-3">
      <h2 id="place-guides" className="font-display text-xl font-bold text-slate-950 dark:text-slate-50">
        {t('inLocalGuides')}
      </h2>
      <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {guides.map((g) => (
          <li key={g.id}>
            <GuideCard guide={g} byLabel={t('byCreator', { name: g.creator.name })} placesLabel={t('placeCount', { count: g.stops.length })} />
          </li>
        ))}
      </ul>
    </section>
  );
}
