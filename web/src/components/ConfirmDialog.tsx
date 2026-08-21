'use client';

import { useEffect, useRef, useState } from 'react';
import { ExclamationTriangleIcon } from '@heroicons/react/24/outline';

// Reusable destructive-action confirmation — replaces window.confirm()
// everywhere it was used for anything permanent (delete a trip, remove
// content, leave a shared trip, ...). Every destructive flow in this app
// should render one of these instead of calling confirm() directly, so
// the experience is consistent: clear title → consequences → irreversible
// warning → cancel → destructive action, with a loading state on confirm
// and (for the highest-stakes actions) a type-to-confirm safeguard.
export interface ConfirmDialogProps {
  open: boolean;
  title: string;
  /** One line explaining what the action does, in plain language. */
  description?: string;
  /** Specific consequences worth calling out individually — "N
   * collaborators will lose access", "This removes 12 saved stops", etc.
   * Rendered as a bullet list under the description. */
  consequences?: string[];
  /** When set, the confirm button stays disabled until the user types
   * this exact string into a text field — an extra safeguard for
   * particularly destructive actions (a trip with real content in it, a
   * shared trip, an account). Omit for routine deletes; requiring this
   * for every delete would make the everyday case unnecessarily
   * frustrating. */
  confirmationPhrase?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Shown on the confirm button while isLoading. */
  loadingLabel?: string;
  isLoading?: boolean;
  /** An already-translated, user-safe error from a failed previous
   * attempt — shown inline so the dialog stays open and the user can
   * retry without losing context (never a raw backend message). */
  error?: string | null;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({
  open,
  title,
  description,
  consequences,
  confirmationPhrase,
  confirmLabel = 'Delete',
  cancelLabel = 'Cancel',
  loadingLabel = 'Deleting…',
  isLoading = false,
  error,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const [typedValue, setTypedValue] = useState('');
  const cancelButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (open) setTypedValue('');
  }, [open]);

  // Default focus lands on Cancel, not the destructive action — a safer
  // default for a dialog whose whole purpose is an action that can't be
  // undone. Skipped when there's a type-to-confirm field, which should
  // get focus instead since that's the only thing left to do.
  useEffect(() => {
    if (open && !confirmationPhrase) cancelButtonRef.current?.focus();
  }, [open, confirmationPhrase]);

  useEffect(() => {
    if (!open) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape' && !isLoading) onCancel();
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, isLoading, onCancel]);

  if (!open) return null;

  const needsTypedConfirmation = Boolean(confirmationPhrase);
  const canConfirm = !isLoading && (!needsTypedConfirmation || typedValue === confirmationPhrase);

  return (
    <div
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="confirm-dialog-title"
      className="fixed inset-0 z-[2000] flex items-center justify-center bg-black/50 p-4"
      onClick={() => !isLoading && onCancel()}
    >
      <div
        className="flex w-full max-w-md flex-col gap-4 rounded-2xl bg-white p-5 shadow-xl dark:bg-slate-900"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-flag-500/10 text-flag-600 dark:text-flag-400">
            <ExclamationTriangleIcon aria-hidden className="h-5 w-5" />
          </span>
          <div className="flex flex-col gap-1 pt-1">
            <h2 id="confirm-dialog-title" className="text-lg font-bold text-slate-900 dark:text-slate-50">
              {title}
            </h2>
            {description && <p className="text-sm text-slate-600 dark:text-slate-300">{description}</p>}
          </div>
        </div>

        {consequences && consequences.length > 0 && (
          <ul className="flex flex-col gap-1.5 rounded-lg bg-slate-50 p-3 text-sm text-slate-600 dark:bg-slate-800/60 dark:text-slate-300">
            {consequences.map((c) => (
              <li key={c} className="flex gap-2">
                <span aria-hidden>•</span>
                <span>{c}</span>
              </li>
            ))}
          </ul>
        )}

        <p className="text-xs font-medium text-flag-700 dark:text-flag-300">This action cannot be undone.</p>

        {needsTypedConfirmation && (
          <label className="flex flex-col gap-1.5">
            <span className="text-xs text-slate-500 dark:text-slate-400">
              To confirm, type <span className="font-semibold text-slate-700 dark:text-slate-200">{confirmationPhrase}</span>{' '}
              below.
            </span>
            <input
              type="text"
              value={typedValue}
              onChange={(e) => setTypedValue(e.target.value)}
              disabled={isLoading}
              autoFocus
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 dark:border-slate-700 dark:bg-slate-800"
            />
          </label>
        )}

        {error && (
          <p role="alert" className="rounded-lg bg-flag-500/10 px-3 py-2 text-sm text-flag-700 dark:text-flag-300">
            {error}
          </p>
        )}

        <div className="mt-1 flex justify-end gap-2">
          <button
            ref={cancelButtonRef}
            type="button"
            onClick={onCancel}
            disabled={isLoading}
            className="rounded-full border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:border-slate-400 disabled:opacity-60 dark:border-slate-700 dark:text-slate-200 dark:hover:border-slate-500"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={!canConfirm}
            className="rounded-full bg-flag-600 px-4 py-2 text-sm font-semibold text-white hover:bg-flag-700 disabled:opacity-60"
          >
            {isLoading ? loadingLabel : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
