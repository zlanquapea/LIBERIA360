'use client';

import { useState } from 'react';
import { AMENITY_PRESETS } from '@/lib/amenities';

const chipBase =
  'inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors';
const chipOn = 'border-brand-600 bg-brand-50 text-brand-700 dark:border-brand-500 dark:bg-brand-950/40 dark:text-brand-300';
const chipOff =
  'border-slate-300 text-slate-600 hover:border-brand-500 hover:text-brand-700 dark:border-slate-700 dark:text-slate-300 dark:hover:text-brand-300';

// Curated multi-select replacing the old free-text "services offered, comma
// separated" input (product feedback, Aug 2026: "create amenities like
// wifi, pool, etc."). Still produces a plain string[] — the same shape
// Business.servicesOffered already stores — so a preset pick and a custom
// "other" entry are indistinguishable to the backend and to anywhere else
// that renders servicesOffered (e.g. PlaceKeyFacts' amenities chip row via
// iconForAmenity).
export function AmenitiesPicker({
  value,
  onChange,
}: {
  value: string[];
  onChange: (next: string[]) => void;
}) {
  const [other, setOther] = useState('');
  const presetLabels = new Set(AMENITY_PRESETS.map((a) => a.label));
  const customValues = value.filter((v) => !presetLabels.has(v));

  function toggle(label: string) {
    onChange(value.includes(label) ? value.filter((v) => v !== label) : [...value, label]);
  }

  function addOther() {
    const trimmed = other.trim();
    if (!trimmed || value.includes(trimmed)) return;
    onChange([...value, trimmed]);
    setOther('');
  }

  function removeCustom(label: string) {
    onChange(value.filter((v) => v !== label));
  }

  return (
    <div className="flex flex-col gap-2 text-sm font-medium text-slate-700 dark:text-slate-200">
      Amenities
      <div className="flex flex-wrap gap-2">
        {AMENITY_PRESETS.map(({ label, icon: Icon }) => {
          const on = value.includes(label);
          return (
            <button
              key={label}
              type="button"
              aria-pressed={on}
              onClick={() => toggle(label)}
              className={`${chipBase} ${on ? chipOn : chipOff}`}
            >
              <Icon aria-hidden className="h-3.5 w-3.5" />
              {label}
            </button>
          );
        })}
        {customValues.map((label) => (
          <button
            key={label}
            type="button"
            aria-pressed
            onClick={() => removeCustom(label)}
            className={`${chipBase} ${chipOn}`}
          >
            {label}
            <span aria-hidden>×</span>
          </button>
        ))}
      </div>
      <div className="flex gap-2">
        <input
          type="text"
          placeholder="Other amenity…"
          value={other}
          onChange={(e) => setOther(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              addOther();
            }
          }}
          className="flex-1 rounded-lg border border-slate-300 dark:border-slate-700 px-3 py-2 text-sm font-normal outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
        />
        <button
          type="button"
          onClick={addOther}
          className="rounded-full border border-slate-300 dark:border-slate-700 px-3 py-1.5 text-xs font-medium text-slate-600 dark:text-slate-300 hover:border-brand-500 hover:text-brand-700 dark:hover:text-brand-300"
        >
          Add
        </button>
      </div>
    </div>
  );
}
