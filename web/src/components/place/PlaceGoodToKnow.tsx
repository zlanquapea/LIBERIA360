import { getTranslations } from 'next-intl/server';
import { CheckCircleIcon } from '@heroicons/react/24/outline';
import type { Place } from '@/lib/types';

// Amenities, accessibility and transport notes — only what's documented.
// Renders nothing at all for a place with none of them.
// `showTransport={false}` when PlaceVisitPlan already covers getting there.
export async function PlaceGoodToKnow({ place, showTransport = true }: { place: Place; showTransport?: boolean }) {
  const t = await getTranslations('placeDetail');
  const amenities = place.amenities ?? [];
  const transport = showTransport ? place.transportNotes : null;
  if (amenities.length === 0 && !place.accessibilityNotes && !transport) return null;

  return (
    <section
      aria-labelledby="good-to-know"
      className="flex flex-col gap-5 rounded-[2rem] border border-slate-200 bg-white p-5 shadow-card dark:border-slate-800 dark:bg-slate-900 sm:p-7"
    >
      <div>
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-brand-700 dark:text-brand-300">{t('beforeYouGo')}</p>
        <h2 id="good-to-know" className="mt-1 font-display text-2xl font-bold text-slate-950 dark:text-slate-50">
          {t('goodToKnow')}
        </h2>
      </div>
      {amenities.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200">{t('amenities')}</h3>
          <ul className="mt-2 flex flex-wrap gap-2">
            {amenities.map((amenity) => (
              <li
                key={amenity}
                className="inline-flex items-center gap-1.5 rounded-full bg-brand-50 px-3 py-1.5 text-sm text-brand-900 dark:bg-brand-950/40 dark:text-brand-100"
              >
                <CheckCircleIcon aria-hidden className="h-4 w-4" />
                {t(`amenity_${amenity}`)}
              </li>
            ))}
          </ul>
        </div>
      )}
      <div className="grid gap-5 sm:grid-cols-2">
        {place.accessibilityNotes && (
          <div>
            <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200">{t('accessibility')}</h3>
            <p className="mt-1 whitespace-pre-line text-sm leading-6 text-slate-700 dark:text-slate-300">{place.accessibilityNotes}</p>
          </div>
        )}
        {transport && (
          <div>
            <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200">{t('gettingThereHeading')}</h3>
            <p className="mt-1 whitespace-pre-line text-sm leading-6 text-slate-700 dark:text-slate-300">{transport}</p>
          </div>
        )}
      </div>
    </section>
  );
}
