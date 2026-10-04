'use client';

import Link from 'next/link';
import { CheckCircleIcon, ClipboardDocumentCheckIcon, ExclamationTriangleIcon } from '@heroicons/react/24/outline';
import type { OrderDraft } from '@/lib/clinic-api';

/** "Your doctor's prescription is in the cart": what was found on this shelf and what wasn't. */
export function PrescriptionDraftBanner({
  draft,
  error,
  signedIn,
  loginHref,
  onReview,
}: {
  draft: OrderDraft | null;
  error: string;
  signedIn: boolean;
  loginHref: string;
  onReview: () => void;
}) {
  if (!signedIn)
    return (
      <div className="flex flex-wrap items-center gap-3 rounded-3xl border border-brand-200 bg-brand-50 p-4 text-sm text-brand-950 dark:border-brand-900 dark:bg-brand-950/30 dark:text-brand-50">
        <ClipboardDocumentCheckIcon aria-hidden className="h-6 w-6 shrink-0" />
        <span className="min-w-0 flex-1">Log in to fill your prescription here.</span>
        <Link href={loginHref} className="btn-primary min-h-10">
          Log in
        </Link>
      </div>
    );
  if (error)
    return (
      <p role="alert" className="flex items-start gap-2 rounded-3xl bg-amber-50 p-4 text-sm text-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
        <ExclamationTriangleIcon aria-hidden className="mt-0.5 h-5 w-5 shrink-0" />
        {error}
      </p>
    );
  if (!draft) return null;
  const found = draft.lines.filter((l) => l.product && l.product.stock > 0);
  const missing = draft.lines.filter((l) => !l.product || l.product.stock === 0);
  return (
    <section
      aria-label="Your prescription"
      className="flex flex-col gap-3 rounded-3xl border border-brand-200 bg-white p-5 shadow-sm dark:border-brand-900 dark:bg-slate-900"
    >
      <div className="flex flex-wrap items-start gap-3">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-brand-50 font-serif text-2xl font-black italic text-brand-800 dark:bg-brand-950/50 dark:text-brand-200">
          ℞
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="font-display text-lg font-bold text-slate-950 dark:text-slate-50">
            {draft.doctorName ? `Dr ${draft.doctorName}'s prescription` : 'Your prescription'}
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {draft.clinicName ? `${draft.clinicName} · ` : ''}code <span className="font-mono">{draft.code}</span> ·{' '}
            {found.length} of {draft.lines.length} found here
          </p>
        </div>
      </div>
      <ul className="flex flex-col gap-1.5 text-sm">
        {draft.lines.map((line, i) => {
          const ok = Boolean(line.product && line.product.stock > 0);
          return (
            <li key={i} className="flex items-start gap-2">
              {ok ? (
                <CheckCircleIcon aria-hidden className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />
              ) : (
                <ExclamationTriangleIcon aria-hidden className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
              )}
              <span className="min-w-0">
                <span className="font-semibold text-slate-900 dark:text-slate-50">{line.medicine}</span>
                <span className="text-slate-500 dark:text-slate-400">
                  {ok
                    ? ` → ${line.product!.name} × ${Math.min(line.quantity, line.product!.stock)}`
                    : line.product
                      ? ' · out of stock here'
                      : ' · not sold here'}
                </span>
              </span>
            </li>
          );
        })}
      </ul>
      {missing.length > 0 && (
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Not everything is on this shelf. Ordering here uses up the prescription, so if you need the rest,
          go back and choose a pharmacy that has it all, or ask the pharmacist to call your doctor.
        </p>
      )}
      {found.length > 0 && (
        <button type="button" onClick={onReview} className="btn-primary min-h-11 self-start">
          Review &amp; order
        </button>
      )}
    </section>
  );
}
