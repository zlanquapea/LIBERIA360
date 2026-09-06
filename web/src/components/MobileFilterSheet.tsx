'use client';

import { useEffect } from 'react';
import { ClockIcon, XMarkIcon } from '@heroicons/react/24/outline';
import type { Category, County } from '@/lib/types';
import { colorForCategory } from '@/lib/category-colors';
import { CategoryIcon } from '@/lib/icons';

// Single-select price buckets — same ranges SearchFilters offers, reused
// here (and by ExploreMapClient's own desktop Price dropdown) so "Under
// $10" means the same thing everywhere. `id: ''` is the "Any price" reset
// state; a place with no listed cost never matches a specific bucket
// (there's nothing to confirm it against), same as the backend's own
// priceMin/priceMax filtering.
export const PRICE_BUCKETS: { id: string; label: string; min?: number; max?: number }[] = [
  { id: '', label: 'Any price' },
  { id: 'free', label: 'Free', min: 0, max: 0 },
  { id: 'under10', label: 'Under $10', min: 0, max: 10 },
  { id: '10-50', label: '$10 – $50', min: 10, max: 50 },
  { id: '50plus', label: '$50+', min: 50 },
];

export function DropdownOption({ label, selected, onClick }: { label: string; selected: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full rounded-lg px-2 py-1.5 text-left text-sm transition-colors ${
        selected
          ? 'font-semibold text-brand-700 dark:text-brand-300'
          : 'text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-800'
      }`}
    >
      {label}
    </button>
  );
}

function FilterSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2 border-b border-slate-100 py-4 first:pt-0 last:border-b-0 last:pb-0 dark:border-slate-800">
      <h3 className="text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">{title}</h3>
      {children}
    </div>
  );
}

// Mobile-only ("lg:hidden" everywhere this is used) full-width bottom
// sheet consolidating Category/County/Open now/Price into one "Filters"
// trigger, in place of ExploreMapClient's FilterPopover small anchored
// dropdowns — a phone-width dropdown anchored under a filter pill is
// awkward to use one-handed and easy to lose track of once open; a sheet
// that slides up from the bottom is the idiomatic mobile pattern (desktop,
// with room for several dropdowns side by side, keeps FilterPopover
// unchanged). Filters apply live as each control is toggled — same as the
// desktop dropdowns already do — so this has no separate "Apply" step,
// just a "Show N places" button that closes the sheet once you're happy
// with the live-updating count.
export function MobileFilterSheet({
  open,
  onClose,
  categories,
  activeSlugs,
  allCategoriesActive,
  onToggleCategory,
  onSelectAllCategories,
  counties,
  countySlug,
  onSelectCounty,
  openNowOnly,
  onToggleOpenNow,
  priceBucketId,
  onSelectPriceBucket,
  hasActiveFilters,
  onClear,
  resultCount,
}: {
  open: boolean;
  onClose: () => void;
  categories: Category[];
  activeSlugs: Set<string>;
  allCategoriesActive: boolean;
  onToggleCategory: (slug: string) => void;
  onSelectAllCategories: () => void;
  counties: County[];
  countySlug: string | null;
  onSelectCounty: (slug: string | null) => void;
  openNowOnly: boolean;
  onToggleOpenNow: () => void;
  priceBucketId: string;
  onSelectPriceBucket: (id: string) => void;
  hasActiveFilters: boolean;
  onClear: () => void;
  resultCount: number;
}) {
  // Same lock-scroll + Escape-to-close pattern as the app's other
  // full-screen overlays (MobileMenu, OnboardingTour).
  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', onKey);
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div role="dialog" aria-modal="true" aria-label="Filter places" className="fixed inset-0 z-[150] flex flex-col justify-end lg:hidden">
      <button type="button" aria-hidden tabIndex={-1} onClick={onClose} className="absolute inset-0 cursor-default bg-black/40" />
      <div className="relative flex max-h-[85vh] flex-col rounded-t-3xl bg-white shadow-2xl dark:bg-slate-900">
        <div className="mx-auto mt-3 h-1 w-10 shrink-0 rounded-full bg-slate-300 dark:bg-slate-700" />
        <div className="flex shrink-0 items-center justify-between px-5 pt-3">
          <h2 className="font-display text-lg font-bold text-slate-900 dark:text-slate-50">Filters</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close filters"
            className="rounded-full p-2 text-slate-500 transition-colors hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-100"
          >
            <XMarkIcon aria-hidden className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5">
          <FilterSection title="Category">
            <div className="flex flex-col gap-0.5">
              <label className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-sm text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-800">
                <input
                  type="checkbox"
                  checked={allCategoriesActive}
                  onChange={onSelectAllCategories}
                  className="h-4 w-4 rounded border-slate-300 text-brand-700 focus:ring-brand-500 dark:border-slate-600"
                />
                All categories
              </label>
              {categories.map((category) => (
                <label
                  key={category.id}
                  className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-sm text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-800"
                >
                  <input
                    type="checkbox"
                    checked={activeSlugs.has(category.slug)}
                    onChange={() => onToggleCategory(category.slug)}
                    className="h-4 w-4 rounded border-slate-300 text-brand-700 focus:ring-brand-500 dark:border-slate-600"
                  />
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center" style={{ color: colorForCategory(category.slug) }}>
                    <CategoryIcon iconKey={category.icon} categorySlug={category.slug} className="h-4 w-4" />
                  </span>
                  {category.name}
                </label>
              ))}
            </div>
          </FilterSection>

          <FilterSection title="County">
            <div className="flex flex-col gap-0.5">
              <DropdownOption label="All counties" selected={countySlug === null} onClick={() => onSelectCounty(null)} />
              {counties.map((county) => (
                <DropdownOption
                  key={county.id}
                  label={county.name}
                  selected={countySlug === county.slug}
                  onClick={() => onSelectCounty(county.slug)}
                />
              ))}
            </div>
          </FilterSection>

          <FilterSection title="Hours">
            <button
              type="button"
              onClick={onToggleOpenNow}
              aria-pressed={openNowOnly}
              className={`flex w-fit items-center gap-1.5 rounded-full border px-3.5 py-2 text-sm font-medium transition-colors ${
                openNowOnly
                  ? 'border-brand-600 bg-brand-50 text-brand-700 dark:border-brand-400 dark:bg-brand-900/40 dark:text-brand-300'
                  : 'border-slate-300 bg-white text-slate-600 hover:border-slate-400 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300'
              }`}
            >
              <ClockIcon aria-hidden className="h-4 w-4" />
              Open now
            </button>
          </FilterSection>

          <FilterSection title="Price">
            <div className="flex flex-col gap-0.5">
              {PRICE_BUCKETS.map((bucket) => (
                <DropdownOption
                  key={bucket.id}
                  label={bucket.label}
                  selected={priceBucketId === bucket.id}
                  onClick={() => onSelectPriceBucket(bucket.id)}
                />
              ))}
            </div>
          </FilterSection>
        </div>

        <div className="flex shrink-0 items-center gap-3 border-t border-slate-100 px-5 py-4 pb-[calc(1rem+env(safe-area-inset-bottom))] dark:border-slate-800">
          {hasActiveFilters && (
            <button type="button" onClick={onClear} className="text-sm font-semibold text-brand-700 hover:underline dark:text-brand-300">
              Clear all
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            className="ml-auto flex min-h-12 flex-1 items-center justify-center rounded-2xl bg-brand-700 px-4 text-sm font-semibold text-white transition-colors hover:bg-brand-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-400 focus-visible:ring-offset-2"
          >
            Show {resultCount} {resultCount === 1 ? 'place' : 'places'}
          </button>
        </div>
      </div>
    </div>
  );
}
