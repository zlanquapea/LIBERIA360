'use client';

import Image from 'next/image';
import { useTranslations } from 'next-intl';
import type { ComponentType, ReactNode, SVGProps } from 'react';

type IconComponent = ComponentType<SVGProps<SVGSVGElement>>;

// The shared "something's not right" screen for every full-page status
// state that isn't a normal empty result list (that's `.empty-state` in
// globals.css — a quiet dashed box for "no results yet", not a real
// problem). Used by both root trees' error.tsx/not-found.tsx and
// global-error.tsx's own hand-rolled equivalent (that one can't import
// this — see its doc comment) so a crash or a dead link reads as the same
// app that just showed you a polished splash screen and loading state,
// not a plain "Something went wrong" default.
//
// Reuses BrandLoader's own visual grammar — the real logo mark, static,
// sitting in a soft halo — rather than a generic illustration: the halo
// here uses the app's current brand/gold identity and swaps the "loading"
// motion for a small badge icon that says what kind of status this
// actually is, since nothing here is in progress.
//
// 'use client' + useTranslations, not getTranslations (i18n, Sep 2026):
// same reasoning as loading.tsx's own doc comment — not-found.tsx is a
// Next.js file-convention special file with no resolved `params`, so a
// server-side getTranslations() read here would force the entire site
// into fully dynamic rendering. useTranslations reads the
// NextIntlClientProvider already in context instead, with no such cost —
// and error.tsx must be a Client Component regardless, per Next.js's own
// contract for that file.
export function BrandedErrorState({
  icon: Icon,
  iconTone = 'brand',
  title,
  description,
  onRetry,
  retryLabel,
  homeAction,
}: {
  icon: IconComponent;
  // 'brand' for "couldn't find that" (a wrong turn, not a failure) vs.
  // 'gold' for an actual caught error — kept warm rather than reaching for
  // `flag` (red), which this app reserves for destructive actions and
  // real danger states, not "please retry."
  iconTone?: 'brand' | 'gold';
  title: string;
  description: string;
  // Only error.tsx passes this (its `reset()`) — a not-found page has
  // nothing to retry, just somewhere to go instead.
  onRetry?: () => void;
  retryLabel?: string;
  // A fully-rendered Link, not an href string: the [locale] tree needs
  // @/i18n/navigation's locale-aware Link (so "home" stays in the visitor's
  // language) and the (no-locale) tree needs plain next/link (it has no
  // real i18n routing behind it) — see Header.tsx's own doc comment for
  // why those two can't share one Link import. Each call site brings the
  // right one already styled with `button-secondary`.
  homeAction: ReactNode;
}) {
  const t = useTranslations('common');

  return (
    <main className="page-shell flex min-h-[70vh] flex-col items-center justify-center gap-6 text-center">
      <div className="relative flex h-24 w-24 items-center justify-center">
        <span
          aria-hidden
          className="absolute inset-0 rounded-full bg-gradient-to-br from-gold-200 via-brand-100 to-brand-200 opacity-90 blur-md dark:from-gold-900/40 dark:via-brand-900/30 dark:to-brand-900/60"
        />
        <span className="relative flex h-20 w-20 items-center justify-center rounded-full bg-white shadow-card ring-1 ring-black/5 dark:bg-slate-900 dark:ring-white/10">
          <Image src="/logo.png" alt="" width={64} height={64} className="h-14 w-14 object-contain" />
        </span>
        <span
          className={`absolute -bottom-1 -right-1 flex h-9 w-9 items-center justify-center rounded-full bg-white shadow-md ring-4 ring-white dark:bg-slate-800 dark:ring-slate-950 ${
            iconTone === 'gold'
              ? 'text-gold-700 dark:text-gold-300'
              : 'text-brand-700 dark:text-brand-300'
          }`}
        >
          <Icon aria-hidden className="h-5 w-5" />
        </span>
      </div>

      <div className="flex max-w-sm flex-col gap-2">
        <h1 className="font-display text-2xl font-extrabold tracking-[-0.02em] text-slate-950 dark:text-white">
          {title}
        </h1>
        <p className="text-sm leading-6 text-slate-600 dark:text-slate-300">{description}</p>
      </div>

      <div className="flex flex-wrap items-center justify-center gap-3">
        {onRetry && (
          <button type="button" onClick={onRetry} className="button-primary">
            {retryLabel ?? t('tryAgain')}
          </button>
        )}
        {homeAction}
      </div>
    </main>
  );
}
