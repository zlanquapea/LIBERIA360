'use client';

import { formatTravelerType } from '@/lib/format';
import type { Category, County, TravelerType } from '@/lib/types';

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

// Same sharing rationale as TravelerTypeSelect above — asked at signup
// (RegisterDto.homeCountyId) and editable afterward on the account page
// (UpdateProfileDto.homeCountyId), both already accepted by the backend
// but never actually collected anywhere in the UI until now. Lists every
// county GET /counties returns, not just rolled-out ones (rolloutStage) —
// someone's home county isn't limited to counties with content live yet.
export function CountySelect({
  value,
  onChange,
  counties,
}: {
  value: string;
  onChange: (value: string) => void;
  counties: County[];
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="rounded-lg border border-slate-300 dark:border-slate-700 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
    >
      <option value="">Prefer not to say</option>
      {counties.map((county) => (
        <option key={county.id} value={county.id}>
          {county.icon ? `${county.icon} ` : ''}
          {county.name}
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
