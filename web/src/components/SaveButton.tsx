'use client';

import { useSavedPlaces } from '@/hooks/useSavedPlaces';

export function SaveButton({ slug, className = '' }: { slug: string; className?: string }) {
  const { isSaved, toggle } = useSavedPlaces();
  const saved = isSaved(slug);

  return (
    <button
      type="button"
      onClick={() => toggle(slug)}
      aria-pressed={saved}
      className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium transition ${
        saved ? 'border-transparent bg-amber-500 text-white' : 'border-slate-300 text-slate-700 hover:border-brand-500'
      } ${className}`}
    >
      <span aria-hidden>{saved ? '🔖' : '📑'}</span>
      {saved ? 'Saved' : 'Save'}
    </button>
  );
}
