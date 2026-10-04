import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { ArrowRightIcon } from '@heroicons/react/24/outline';
import { phraseOfTheDay } from '@/lib/liberian-english';
import { LoneStar } from '@/components/LoneStar';

// A small daily dose of Liberian English, so the site sounds like home
// to Liberians and gives visitors one phrase to try today.
export async function PhraseOfTheDay() {
  const t = await getTranslations('liberia');
  const phrase = phraseOfTheDay();
  return (
    <aside
      aria-labelledby="phrase-heading"
      className="relative overflow-hidden rounded-[1.75rem] bg-brand-950 px-5 py-5 text-white shadow-card sm:px-7"
    >
      <LoneStar className="pointer-events-none absolute -end-6 -top-8 h-36 w-36 text-white/[0.06]" />
      <div className="relative flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
        <div className="min-w-0">
          <p id="phrase-heading" className="text-[11px] font-bold uppercase tracking-[0.2em] text-sunset-300">
            {t('phraseOfTheDay')}
          </p>
          <p className="mt-1 font-display text-2xl font-black tracking-tight sm:text-3xl" lang="en-LR">
            “{phrase.phrase}”
          </p>
          <p className="mt-1 text-sm leading-6 text-white/80">{t(`phrases.${phrase.id}`)}</p>
        </div>
        <Link
          href="/liberian-english"
          className="inline-flex min-h-11 shrink-0 items-center gap-1.5 self-start rounded-full bg-white/10 px-4 text-sm font-semibold text-white ring-1 ring-white/20 transition-colors hover:bg-white/20 sm:self-center"
        >
          {t('openPhrasebook')}
          <ArrowRightIcon aria-hidden className="h-4 w-4 rtl:-scale-x-100" />
        </Link>
      </div>
    </aside>
  );
}
