'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import type { Category, County } from '@/lib/types';

export function SearchFilters({ categories, counties }: { categories: Category[]; counties: County[] }) {
  const t = useTranslations('search');
  const tCommon = useTranslations('common');
  const router = useRouter();
  const searchParams = useSearchParams();
  const [previous, setPrevious] = useState("");
  const current = searchParams.toString();
  useEffect(() => {
    try {
      const filters = new URLSearchParams();
      for (const key of [
        "category",
        "county",
        "sort",
        "priceMin",
        "priceMax",
        "amenity",
        "openNow",
      ]) {
        const value = searchParams.get(key);
        if (value) filters.set(key, value);
      }
      if (filters.size) {
        sessionStorage.setItem("liberia360:search-filters", filters.toString());
        setPrevious("");
      } else setPrevious(sessionStorage.getItem("liberia360:search-filters") || "");
    } catch {
      // URL filters remain usable when storage is unavailable.
    }
  }, [current, searchParams]);

  function updateParam(key: string, value: string) {
    updateParams({ [key]: value });
  }

  // Price is set as a single "bucket" selection but maps to two separate
  // query params (priceMin/priceMax, matching PlacesQuery) — updating both
  // atomically avoids a round trip that briefly has only one of them set.
  function updateParams(updates: Record<string, string>) {
    const params = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(updates)) {
      if (value) {
        params.set(key, value);
      } else {
        params.delete(key);
      }
    }
    params.delete('page'); // filters changing means results changed — back to page 1
    router.push(`/search?${params.toString()}`);
  }

  const priceBucket =
    searchParams.get('priceMin') != null || searchParams.get('priceMax') != null
      ? `${searchParams.get('priceMin') ?? ''}-${searchParams.get('priceMax') ?? ''}`
      : '';

  return (
    <div className="flex flex-wrap gap-2">
      {previous && (
        <button
          type="button"
          className="min-h-11 rounded-full border px-4 text-sm"
          onClick={() => {
            const params = new URLSearchParams(previous);
            const q = searchParams.get("q");
            if (q) params.set("q", q);
            router.push(`/search?${params}`);
          }}
        >
          Restore previous filters
        </button>
      )}
      <select
        aria-label="Amenity"
        className="min-h-11 rounded-full border border-slate-300 bg-transparent px-3 text-sm dark:border-slate-700"
        value={searchParams.get("amenity") ?? ""}
        onChange={(event) => updateParam("amenity", event.target.value)}
      >
        <option value="">Any amenities</option>
        {[
          "parking",
          "restrooms",
          "drinking_water",
          "food_on_site",
          "wifi",
          "power_backup",
          "card_payments",
          "mobile_money",
          "guided_tours",
          "lifeguard",
          "changing_rooms",
          "shade_seating",
          "family_friendly",
          "pet_friendly",
        ].map((value) => (
          <option value={value} key={value}>
            {value.replaceAll("_", " ")}
          </option>
        ))}
      </select>
      <select
        aria-label={t('categoryAriaLabel')}
        className="min-h-11 rounded-full border border-slate-300 dark:border-slate-700 px-3 py-1.5 text-sm text-slate-700 dark:text-slate-200"
        value={searchParams.get('category') ?? ''}
        onChange={(e) => updateParam('category', e.target.value)}
      >
        <option value="">{t('allCategories')}</option>
        {categories.map((c) => (
          <option key={c.id} value={c.slug}>
            {c.name}
          </option>
        ))}
      </select>

      <select
        aria-label={t('countyAriaLabel')}
        className="min-h-11 rounded-full border border-slate-300 dark:border-slate-700 px-3 py-1.5 text-sm text-slate-700 dark:text-slate-200"
        value={searchParams.get('county') ?? ''}
        onChange={(e) => updateParam('county', e.target.value)}
      >
        <option value="">{t('allCounties')}</option>
        {counties.map((c) => (
          <option key={c.id} value={c.slug}>
            {c.name}
          </option>
        ))}
      </select>

      <select
        aria-label={t('sortByAriaLabel')}
        className="min-h-11 rounded-full border border-slate-300 dark:border-slate-700 px-3 py-1.5 text-sm text-slate-700 dark:text-slate-200"
        value={searchParams.get('sort') ?? 'featured'}
        onChange={(e) => updateParam('sort', e.target.value)}
      >
        <option value="featured">{t('sortFeatured')}</option>
        <option value="rating">{t('sortRating')}</option>
        <option value="distance">{t('sortDistance')}</option>
        <option value="name">{t('sortName')}</option>
      </select>

      <select
        aria-label={t('priceAriaLabel')}
        className="min-h-11 rounded-full border border-slate-300 dark:border-slate-700 px-3 py-1.5 text-sm text-slate-700 dark:text-slate-200"
        value={priceBucket}
        onChange={(e) => {
          const [priceMin, priceMax] = e.target.value.split('-');
          updateParams({ priceMin: priceMin ?? '', priceMax: priceMax ?? '' });
        }}
      >
        <option value="">{tCommon('priceBucketAny')}</option>
        <option value="0-0">{tCommon('priceBucketFree')}</option>
        <option value="0-10">{tCommon('priceBucketUnder10')}</option>
        <option value="10-50">{tCommon('priceBucket10To50')}</option>
        <option value="50-">{tCommon('priceBucket50Plus')}</option>
      </select>

      <label className="flex cursor-pointer items-center gap-1.5 rounded-full border border-slate-300 dark:border-slate-700 px-3 py-1.5 text-sm text-slate-700 dark:text-slate-200">
        <input
          type="checkbox"
          checked={searchParams.get('openNow') === 'true'}
          onChange={(e) => updateParam('openNow', e.target.checked ? 'true' : '')}
          className="h-4 w-4 rounded border-slate-300 text-brand-700 focus:ring-brand-500 dark:border-slate-600"
        />
        {t('openNow')}
      </label>
    </div>
  );
}
