'use client';

import { useEffect, useMemo, useState } from 'react';
import { PageHeader } from '@/components/PageHeader';
import { BrandLoader } from '@/components/BrandLoader';
import { getTravelerInfo } from '@/lib/traveler-info-api';
import { getFriendlyErrorMessage } from '@/lib/errors';
import type { TravelerInfoSettings } from '@/lib/types';

// Practical traveler tools — a plain catalog directory has no currency,
// visa, or seasonal info anywhere. Public, unauthenticated. Every block
// below renders nothing until an admin has set it (see
// TravelerInfoSettings' own "admin-owned, never guessed" doc comment) —
// no placeholder/guessed content shown to visitors.
export default function TravelInfoPage() {
  const [settings, setSettings] = useState<TravelerInfoSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    getTravelerInfo()
      .then((s) => {
        if (!cancelled) setSettings(s);
      })
      .catch((err) => {
        if (!cancelled) setLoadError(getFriendlyErrorMessage(err, { context: { action: 'load-traveler-info' } }));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const hasAnyContent = Boolean(
    settings &&
      (settings.usdToLrdRate !== null ||
        settings.visaInfo ||
        settings.entryRequirements ||
        settings.currentSeasonNote),
  );

  return (
    <main className="page-shell max-w-3xl">
      <PageHeader
        eyebrow="Plan your trip"
        title="Travel Info"
        description="Practical, up-to-date information for visitors coming to Liberia — currency, visa requirements, and what to expect this season."
      />

      {loading ? (
        <div className="empty-state">
          <BrandLoader />
        </div>
      ) : loadError ? (
        <p role="alert" className="error-state">
          {loadError}
        </p>
      ) : !hasAnyContent ? (
        <p className="empty-state">Travel info isn&apos;t available yet — check back soon.</p>
      ) : (
        <div className="flex flex-col gap-4">
          {settings?.usdToLrdRate !== null && settings?.usdToLrdRate !== undefined && (
            <CurrencyConverter rate={settings.usdToLrdRate} />
          )}

          {settings?.currentSeasonNote && (
            <section className="surface-card p-5">
              <h2 className="page-title text-lg">Right now in Liberia</h2>
              <p className="page-description mt-2">{settings.currentSeasonNote}</p>
            </section>
          )}

          {settings?.visaInfo && (
            <section className="surface-card p-5">
              <h2 className="page-title text-lg">Visa</h2>
              <p className="page-description mt-2 whitespace-pre-line">{settings.visaInfo}</p>
            </section>
          )}

          {settings?.entryRequirements && (
            <section className="surface-card p-5">
              <h2 className="page-title text-lg">Entry requirements</h2>
              <p className="page-description mt-2 whitespace-pre-line">{settings.entryRequirements}</p>
            </section>
          )}
        </div>
      )}
    </main>
  );
}

function CurrencyConverter({ rate }: { rate: number }) {
  const [usd, setUsd] = useState('1');

  const lrd = useMemo(() => {
    const parsed = Number(usd);
    if (!usd.trim() || Number.isNaN(parsed)) return null;
    return parsed * rate;
  }, [usd, rate]);

  return (
    <section className="surface-card p-5">
      <h2 className="page-title text-lg">Currency converter</h2>
      <p className="page-description mt-1">1 US$ ≈ L${rate.toFixed(2)}</p>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <label className="flex flex-col gap-1 text-sm font-medium text-slate-700 dark:text-slate-200">
          US Dollars
          <input
            inputMode="decimal"
            value={usd}
            onChange={(e) => setUsd(e.target.value)}
            className="input"
            aria-label="Amount in US dollars"
          />
        </label>
        <span className="mt-5 text-slate-400">=</span>
        <div className="flex flex-col gap-1 text-sm font-medium text-slate-700 dark:text-slate-200">
          Liberian Dollars
          <p className="input flex items-center bg-slate-50 dark:bg-slate-800" aria-live="polite">
            {lrd === null ? '—' : `L$${lrd.toFixed(2)}`}
          </p>
        </div>
      </div>
    </section>
  );
}
