'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useAuth } from '@/hooks/useAuth';
import { getSavedGuides } from '@/lib/creator-guides-api';
import { GuideCard } from './GuideCard';
import type { CreatorGuide } from '@/lib/types';

// Guides the signed-in traveler saved. Renders nothing when signed out or
// when nothing is saved, so the Saved page stays about places first.
export function SavedGuidesSection() {
  const t = useTranslations('creatorGuides');
  const { token, ready } = useAuth();
  const [guides, setGuides] = useState<CreatorGuide[]>([]);

  useEffect(() => {
    if (!ready || !token) return;
    getSavedGuides(token)
      .then(setGuides)
      .catch(() => setGuides([]));
  }, [ready, token]);

  if (guides.length === 0) return null;
  return (
    <section aria-labelledby="saved-guides-heading" className="flex flex-col gap-4">
      <h2 id="saved-guides-heading" className="text-xl font-bold text-slate-900 dark:text-slate-50">
        {t('savedGuides')}
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
