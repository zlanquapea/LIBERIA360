'use client';

import { formatTravelerType } from '@/lib/format';
import type { Category, TravelerType } from '@/lib/types';

const TRAVELER_TYPES: TravelerType[] = ['diaspora', 'tourist', 'expat', 'business_traveler', 'local_resident'];

// Shared between signup and the account-page profile editor — same fields,
// same reason they exist (Business Plan §8.4's traveler-type segmentation
// for the B2B analytics product), so one place defines how they're asked.
export function TravelerTypeSelect({
  value,
  onChange,
}: {
  value: TravelerType | '';
  onChange: (value: TravelerType | '') => void;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value as TravelerType | '')}
      className="rounded-lg border border-slate-300 dark:border-slate-700 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
    >
      <option value="">Prefer not to say</option>
      {TRAVELER_TYPES.map((t) => (
        <option key={t} value={t}>
          {formatTravelerType(t)}
        </option>
      ))}
    </select>
  );
}

export function InterestChips({
  categories,
  selected,
  onToggle,
}: {
  categories: Category[];
  selected: string[];
  onToggle: (slug: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {categories.map((category) => {
        const isSelected = selected.includes(category.slug);
        return (
          <button
            key={category.id}
            type="button"
            onClick={() => onToggle(category.slug)}
            aria-pressed={isSelected}
            className={`rounded-full border px-3 py-1.5 text-xs font-medium transition ${
              isSelected
                ? 'border-transparent bg-brand-700 text-white'
                : 'border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:border-brand-500'
            }`}
          >
            {category.icon} {category.name}
          </button>
        );
      })}
    </div>
  );
}
