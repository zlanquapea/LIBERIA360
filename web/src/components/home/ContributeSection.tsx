import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { BuildingStorefrontIcon, MapPinIcon, VideoCameraIcon } from '@heroicons/react/24/outline';

// The standing invitation to help: add a missing place, claim and maintain
// a business listing, or publish as a creator.
export async function ContributeSection() {
  const t = await getTranslations('discover');
  const actions = [
    { href: '/places/submit', icon: MapPinIcon, title: t('addPlace'), hint: t('addPlaceHint') },
    { href: '/account/my-businesses', icon: BuildingStorefrontIcon, title: t('claimBusiness'), hint: t('claimBusinessHint') },
    { href: '/creators/me', icon: VideoCameraIcon, title: t('becomeCreator'), hint: t('becomeCreatorHint') },
  ];
  return (
    <section
      aria-labelledby="contribute-heading"
      className="relative overflow-hidden rounded-[2rem] bg-brand-900 px-5 py-8 text-white sm:px-8 sm:py-10 lg:px-12"
    >
      <div aria-hidden className="pointer-events-none absolute -end-16 -top-16 h-56 w-56 rounded-full bg-sunset-500/25 blur-3xl" />
      <div className="relative grid gap-6 lg:grid-cols-[1fr_1.4fr] lg:items-center">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-sunset-300">{t('contributeEyebrow')}</p>
          <h2 id="contribute-heading" className="mt-1 font-display text-2xl font-extrabold tracking-tight sm:text-3xl">
            {t('contributeTitle')}
          </h2>
          <p className="mt-2 text-sm leading-6 text-white/80 sm:text-base">{t('contributeBody')}</p>
        </div>
        <ul className="grid gap-3 sm:grid-cols-3">
          {actions.map(({ href, icon: Icon, title, hint }) => (
            <li key={href}>
              <Link
                href={href}
                className="flex h-full flex-col gap-2 rounded-2xl border border-white/15 bg-white/5 p-4 transition-colors hover:border-white/40 hover:bg-white/10 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-sunset-300/60"
              >
                <Icon aria-hidden className="h-6 w-6 text-sunset-300" />
                <span className="font-display font-bold">{title}</span>
                <span className="text-xs leading-5 text-white/70">{hint}</span>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
