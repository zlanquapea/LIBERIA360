import { getTranslations } from 'next-intl/server';
import { PageHeader } from '@/components/PageHeader';
import { LiberiaFlag, LoneStar } from '@/components/LoneStar';
import { PHRASES, phraseOfTheDay } from '@/lib/liberian-english';
import { DISHES } from '@/lib/liberian-dishes';

export async function generateMetadata() {
  const t = await getTranslations('liberia');
  return { title: `${t('pageTitle')} — LIBERIA360`, description: t('pageIntro') };
}

// A pocket phrasebook of everyday Liberian English, and the dishes you'll
// meet on menus, so visitors can greet people properly and order with
// confidence. Phrases stay as they're said; meanings are translated.
export default async function LiberianEnglishPage() {
  const t = await getTranslations('liberia');
  const today = phraseOfTheDay();

  return (
    <main className="page-shell max-w-4xl">
      <PageHeader eyebrow={t('pageEyebrow')} title={t('pageTitle')} description={t('pageIntro')} />

      <section aria-labelledby="phrases-heading" className="flex flex-col gap-4">
        <h2 id="phrases-heading" className="flex items-center gap-2 font-display text-xl font-bold text-slate-950 dark:text-slate-50">
          <LiberiaFlag className="h-4 w-auto" />
          {t('phrasesTitle')}
        </h2>
        <ul className="grid gap-3 sm:grid-cols-2">
          {PHRASES.map((p) => {
            const isToday = p.id === today.id;
            return (
              <li
                key={p.id}
                className={`flex flex-col gap-1 rounded-2xl border bg-white p-4 dark:bg-slate-900 ${
                  isToday ? 'border-sunset-300 ring-2 ring-sunset-200 dark:border-sunset-700 dark:ring-sunset-900' : 'border-slate-200 dark:border-slate-800'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <p className="font-display text-lg font-bold text-slate-950 dark:text-slate-50" lang="en-LR">
                    {p.phrase}
                  </p>
                  {isToday && (
                    <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-sunset-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-sunset-800 dark:bg-sunset-900 dark:text-sunset-100">
                      <LoneStar className="h-3 w-3" />
                      {t('today')}
                    </span>
                  )}
                </div>
                <p className="text-sm leading-6 text-slate-600 dark:text-slate-300">{t(`phrases.${p.id}`)}</p>
                {p.example && (
                  <p className="text-sm italic text-slate-500 dark:text-slate-400" lang="en-LR">
                    “{p.example}”
                  </p>
                )}
              </li>
            );
          })}
        </ul>
      </section>

      <section aria-labelledby="dishes-heading" className="flex flex-col gap-4">
        <div>
          <h2 id="dishes-heading" className="font-display text-xl font-bold text-slate-950 dark:text-slate-50">
            {t('dishesTitle')}
          </h2>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{t('dishesIntro')}</p>
        </div>
        <dl className="grid gap-3 sm:grid-cols-2">
          {DISHES.map((dish) => (
            <div key={dish.id} className="rounded-2xl border border-sunset-200 bg-sunset-50/60 p-4 dark:border-sunset-900 dark:bg-sunset-900/20">
              <dt className="font-display font-bold text-slate-950 dark:text-slate-50">{dish.name}</dt>
              <dd className="mt-1 text-sm leading-6 text-slate-600 dark:text-slate-300">{t(`dishes.${dish.id}`)}</dd>
            </div>
          ))}
        </dl>
      </section>

      <p className="text-xs leading-5 text-slate-500 dark:text-slate-400">{t('usageNote')}</p>
    </main>
  );
}
