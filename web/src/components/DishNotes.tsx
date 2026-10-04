import { useTranslations } from 'next-intl';
import { findDishes } from '@/lib/liberian-dishes';
import { LoneStar } from './LoneStar';

/** Explains the Liberian dishes named in a menu item or a place's
 * description, so a first-timer knows what palm butter or dumboy is
 * before they order. Renders nothing when no dish is mentioned. */
export function DishNotes({
  texts,
  variant = 'panel',
  className = '',
}: {
  texts: Array<string | null | undefined>;
  variant?: 'panel' | 'inline';
  className?: string;
}) {
  const t = useTranslations('liberia');
  const dishes = findDishes(...texts);
  if (dishes.length === 0) return null;

  if (variant === 'inline') {
    return (
      <div className={`flex flex-col gap-2 rounded-2xl bg-sunset-50 px-4 py-3 text-sm dark:bg-sunset-900/40 ${className}`}>
        {dishes.map((dish) => (
          <p key={dish.id} className="leading-6 text-slate-700 dark:text-slate-200">
            <span className="font-bold text-slate-900 dark:text-slate-50">{t('whatIs', { dish: dish.name })}</span>{' '}
            {t(`dishes.${dish.id}`)}
          </p>
        ))}
      </div>
    );
  }

  return (
    <aside
      aria-labelledby="dish-notes-heading"
      className={`rounded-[1.5rem] border border-sunset-200 bg-sunset-50/70 p-4 sm:p-5 dark:border-sunset-900 dark:bg-sunset-900/30 ${className}`}
    >
      <h3 id="dish-notes-heading" className="flex items-center gap-2 font-display text-base font-bold text-slate-950 dark:text-slate-50">
        <LoneStar className="h-4 w-4 text-sunset-600 dark:text-sunset-300" />
        {t('dishNotesTitle')}
      </h3>
      <dl className="mt-3 grid gap-3 sm:grid-cols-2">
        {dishes.map((dish) => (
          <div key={dish.id}>
            <dt className="text-sm font-bold text-slate-900 dark:text-slate-50">{dish.name}</dt>
            <dd className="text-sm leading-6 text-slate-600 dark:text-slate-300">{t(`dishes.${dish.id}`)}</dd>
          </div>
        ))}
      </dl>
    </aside>
  );
}
