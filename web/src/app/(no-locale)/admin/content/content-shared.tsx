'use client';

import { useState } from 'react';
import { HttpError } from '@/lib/http';

export const inputClass =
  'rounded-lg border border-slate-300 dark:border-slate-700 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500';

// Mirrors the API's slug validation (CreatePlaceDto/CreateCategoryDto:
// lowercase, kebab-case) so what's auto-filled here always passes
// server-side validation as-is.
export function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

// A styled "Delete X" button with its own loading/error handling — used
// both for super-admin-only structural deletes (places, categories,
// activities, businesses, counties — the caller checks isSuperAdmin
// before rendering it) and for the pre-existing any-admin moderation
// deletes (events, reviews). The permission boundary lives in whether the
// caller renders this at all, not in this component.
export function DeleteButton({
  label,
  onDelete,
  onDeleted,
}: {
  label: string;
  onDelete: () => Promise<void>;
  onDeleted: () => void;
}) {
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleClick() {
    setDeleting(true);
    setError(null);
    try {
      await onDelete();
      onDeleted();
    } catch (err) {
      setError(err instanceof HttpError ? err.message : 'Something went wrong. Please try again.');
      setDeleting(false);
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        disabled={deleting}
        onClick={handleClick}
        className="rounded-full border border-flag-600 px-3 py-1.5 text-xs font-semibold text-flag-700 dark:text-flag-300 hover:bg-flag-600 hover:text-white disabled:opacity-60"
      >
        {deleting ? 'Deleting…' : label}
      </button>
      {error && <p className="max-w-xs text-right text-xs text-flag-700 dark:text-flag-300">{error}</p>}
    </div>
  );
}

// Every tab (Categories/Places/Events/Counties) is list-first: a table of
// what exists, a "+ New" button, click a row to edit. This is the shared
// header row for that list view — title, count, and the create button.
export function TabListHeader({
  title,
  count,
  createLabel,
  onCreate,
}: {
  title: string;
  count: number;
  createLabel?: string;
  onCreate?: () => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <h2 className="flex items-center gap-2 font-semibold text-slate-800 dark:text-slate-100">
        {title}
        <span className="rounded-full bg-slate-100 dark:bg-slate-800 px-2 py-0.5 text-xs font-medium text-slate-500 dark:text-slate-400">{count}</span>
      </h2>
      {createLabel && onCreate && (
        <button
          type="button"
          onClick={onCreate}
          className="rounded-full bg-brand-700 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-800"
        >
          {createLabel}
        </button>
      )}
    </div>
  );
}

export function BackToListLink({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center gap-1 self-start text-sm font-medium text-brand-700 dark:text-brand-300 hover:underline"
    >
      ← {label}
    </button>
  );
}
