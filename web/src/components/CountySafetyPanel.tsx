import { useTranslations } from 'next-intl';
import { ExclamationTriangleIcon, HandRaisedIcon, PhoneIcon, ShieldCheckIcon } from '@heroicons/react/24/solid';
import type { County } from '@/lib/types';

// "Before you go" panel for the international-visitor/diaspora audience —
// the one thing missing from a plain catalog-directory experience.
// Renders nothing if an admin hasn't set any of this content yet (see
// PATCH /admin/counties/:id) — no placeholder/guessed content shown to
// visitors, consistent with the API never seeding a guessed
// emergencyNumber. The emergency number is a real tel: link, first, and
// large — it's the line someone may need in a hurry.
export function CountySafetyPanel({ county, headingId = 'before-you-go', className = 'flex' }: { county: County; headingId?: string; className?: string }) {
  const t = useTranslations('countyPage');
  const hasContent = Boolean(county.emergencyNumber) || county.safetyTips.length > 0 || Boolean(county.localCustoms);
  if (!hasContent) return null;
  const dialable = county.emergencyNumber?.replace(/[^\d+]/g, '') ?? '';

  return (
    <section aria-labelledby={headingId} className={`${className} flex-col gap-4 rounded-[2rem] border border-amber-200 bg-amber-50 p-5 dark:border-amber-900/70 dark:bg-amber-950/30`}>
      <h2 id={headingId} className="flex items-center gap-2 font-display text-lg font-bold text-slate-950 dark:text-slate-50">
        <ShieldCheckIcon aria-hidden className="h-5 w-5 text-amber-600 dark:text-amber-400" />
        {t('beforeYouGo')}
      </h2>

      {county.emergencyNumber && (
        dialable ? (
          <a href={`tel:${dialable}`} className="flex items-center gap-3 rounded-2xl bg-red-600 px-4 py-3 text-white shadow-sm transition-colors hover:bg-red-700">
            <PhoneIcon aria-hidden className="h-6 w-6 shrink-0" />
            <span className="min-w-0">
              <span className="block text-[11px] font-bold uppercase tracking-[0.16em] text-white/75">{t('emergency')}</span>
              <span className="block font-display text-xl font-extrabold tabular-nums">{county.emergencyNumber}</span>
            </span>
          </a>
        ) : (
          <p className="rounded-2xl bg-red-600 px-4 py-3 text-white">
            <span className="block text-[11px] font-bold uppercase tracking-[0.16em] text-white/75">{t('emergency')}</span>
            <span className="block font-display text-xl font-extrabold">{county.emergencyNumber}</span>
          </p>
        )
      )}

      {county.safetyTips.length > 0 && (
        <div>
          <p className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-[0.16em] text-amber-800 dark:text-amber-300">
            <ExclamationTriangleIcon aria-hidden className="h-4 w-4" />
            {t('safetyTips')}
          </p>
          <ul className="mt-2 flex flex-col gap-2 text-sm leading-6 text-slate-700 dark:text-slate-200">
            {county.safetyTips.map((tip) => (
              <li key={tip} className="flex gap-2">
                <span aria-hidden className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500" />
                {tip}
              </li>
            ))}
          </ul>
        </div>
      )}

      {county.localCustoms && (
        <div>
          <p className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-[0.16em] text-amber-800 dark:text-amber-300">
            <HandRaisedIcon aria-hidden className="h-4 w-4" />
            {t('localCustoms')}
          </p>
          <p className="mt-2 text-sm leading-6 text-slate-700 dark:text-slate-200">{county.localCustoms}</p>
        </div>
      )}
    </section>
  );
}
