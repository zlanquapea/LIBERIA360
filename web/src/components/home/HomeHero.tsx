import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import {
  BriefcaseIcon,
  CalendarDaysIcon,
  MagnifyingGlassIcon,
  ViewfinderCircleIcon,
} from '@heroicons/react/24/outline';
import { HeroBackground } from '@/components/HeroBackground';
import { LoneStar } from '@/components/LoneStar';

export interface HeroStats {
  places: number;
  countiesCovered: number;
  creators: number;
}

// Full-bleed photo hero: the promise, one prominent search, and the three
// ways in — what's near, what's on this weekend, and planning a trip.
// Every number underneath comes from the live catalog on this request.
export async function HomeHero({ weekendCount, stats }: { weekendCount: number; stats: HeroStats }) {
  const t = await getTranslations('discover');
  const entries = [
    { href: '/near-me', icon: ViewfinderCircleIcon, title: t('nearMe'), hint: t('nearMeHint'), accent: true },
    { href: '#this-weekend', icon: CalendarDaysIcon, title: t('thisWeekend'), hint: t('thisWeekendHint', { count: weekendCount }) },
    { href: '/trips/new', icon: BriefcaseIcon, title: t('planTrip'), hint: t('planTripHint') },
  ];

  return (
    <section
      aria-labelledby="hero-heading"
      className="relative isolate overflow-hidden px-4 pb-10 pt-14 text-white sm:px-6 sm:pb-14 sm:pt-20 lg:px-10 lg:pb-20 lg:pt-28"
    >
      <HeroBackground />
      {/* Darkest at the bottom-left where the text sits, so it stays
          legible over any of the photos. */}
      <div aria-hidden className="absolute inset-0 bg-gradient-to-t from-brand-950 via-brand-950/75 to-brand-900/30" />
      <div aria-hidden className="absolute inset-0 bg-gradient-to-r from-brand-950/70 via-transparent to-transparent" />

      <div className="relative mx-auto flex max-w-6xl flex-col gap-7">
        <div className="flex max-w-3xl flex-col gap-4">
          <p className="flex w-fit items-center gap-2 rounded-full border border-white/25 bg-white/10 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.2em] text-sunset-200 backdrop-blur-sm sm:text-xs">
            <LoneStar className="h-3.5 w-3.5 text-white" />
            {t('eyebrow')}
          </p>
          <h1
            id="hero-heading"
            className="font-display text-[2.6rem] font-black leading-[0.98] tracking-tight drop-shadow-[0_2px_18px_rgba(0,0,0,0.45)] sm:text-6xl lg:text-7xl"
          >
            {t.rich('headline', {
              highlight: (chunks) => <span className="text-sunset-300">{chunks}</span>,
              br: () => <br />,
            })}
          </h1>
          <p className="max-w-2xl text-base leading-7 text-white/85 sm:text-lg">{t('subheadline')}</p>
        </div>

        {/* Plain GET form to /search: works before any JS loads. */}
        <form action="/search" method="GET" role="search" className="w-full max-w-2xl">
          <label htmlFor="hero-search" className="sr-only">
            {t('searchLabel')}
          </label>
          <div className="flex items-center gap-2 rounded-full bg-white p-1.5 shadow-[0_20px_50px_-12px_rgba(0,0,0,0.5)] ring-1 ring-black/5 transition-shadow focus-within:ring-4 focus-within:ring-sunset-300/70">
            <MagnifyingGlassIcon aria-hidden className="ms-3 h-5 w-5 shrink-0 text-slate-500" />
            <input
              id="hero-search"
              type="search"
              name="q"
              placeholder={t('searchPlaceholder')}
              className="min-w-0 flex-1 bg-transparent py-3 text-base text-slate-900 outline-none placeholder:text-slate-500"
            />
            <button
              type="submit"
              className="min-h-12 shrink-0 rounded-full bg-sunset-600 px-5 text-sm font-bold text-white transition-colors hover:bg-sunset-700 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-sunset-200 sm:px-7"
            >
              {t('searchButton')}
            </button>
          </div>
        </form>

        <nav aria-label={t('entryPointsLabel')} className="grid max-w-3xl grid-cols-1 gap-3 sm:grid-cols-3">
          {entries.map(({ href, icon: Icon, title, hint, accent }) => (
            <Link
              key={href}
              href={href}
              className={`group flex min-h-16 items-center gap-3 rounded-2xl border px-4 py-3 backdrop-blur-md transition-all hover:-translate-y-0.5 motion-reduce:transition-none motion-reduce:hover:translate-y-0 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-sunset-300/70 ${
                accent
                  ? 'border-brand-400/50 bg-brand-600/80 hover:bg-brand-600'
                  : 'border-white/20 bg-white/10 hover:border-white/40 hover:bg-white/15'
              }`}
            >
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/15">
                <Icon aria-hidden className="h-5 w-5" />
              </span>
              <span className="min-w-0">
                <span className="block font-display text-base font-bold leading-tight">{title}</span>
                <span className="block truncate text-xs text-white/75">{hint}</span>
              </span>
            </Link>
          ))}
        </nav>

        <ul className="flex flex-wrap gap-x-5 gap-y-1 text-sm font-medium text-white/75">
          <li>{t('statPlaces', { count: stats.places })}</li>
          <li>{t('statCounties', { count: stats.countiesCovered })}</li>
          {stats.creators > 0 && <li>{t('statCreators', { count: stats.creators })}</li>}
        </ul>
      </div>
    </section>
  );
}
