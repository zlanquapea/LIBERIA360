'use client';

import Link from 'next/link';
import { ArrowRightIcon, MinusIcon, PlusIcon, TrashIcon } from '@heroicons/react/24/outline';
import { resolveThumbUrl } from '@/lib/images';
import { MENU_KIND_EMOJI } from '@/lib/menu';
import { MAX_LINE_QUANTITY, cartSummary, describeSelections, unitPriceFor, type CartLine } from '@/lib/menu-cart';
import { formatMoney } from '@/lib/currency';
import { SafeImage } from '@/components/SafeImage';
import type { MenuCurrency, MenuItem } from '@/lib/types';
import { MenuSheet } from './MenuSheet';
import { MenuPrice } from './MenuPrice';

export function CartSheet({
  open,
  onClose,
  businessName,
  lines,
  items,
  currency,
  rate,
  signedIn,
  loginHref,
  notes,
  onNotesChange,
  ageConfirmed,
  onAgeConfirmedChange,
  onQuantityChange,
  onSubmit,
  submitting,
  error,
}: {
  open: boolean;
  onClose: () => void;
  businessName: string;
  lines: CartLine[];
  items: MenuItem[];
  currency: MenuCurrency;
  rate: number | null;
  signedIn: boolean;
  // Returns here after login; the cart survives via localStorage.
  loginHref: string;
  notes: string;
  onNotesChange: (value: string) => void;
  ageConfirmed: boolean;
  onAgeConfirmedChange: (value: boolean) => void;
  onQuantityChange: (key: string, quantity: number) => void;
  onSubmit: () => void;
  submitting: boolean;
  error: string | null;
}) {
  const byId = new Map(items.map((i) => [i.id, i]));
  const { count, subtotal, hasAlcohol } = cartSummary(lines, items);
  const blockedByAge = hasAlcohol && !ageConfirmed;

  return (
    <MenuSheet
      open={open}
      onClose={onClose}
      label="Your order"
      footer={
        count === 0 ? null : signedIn ? (
          <div className="flex flex-col gap-2">
            {error && (
              <p role="alert" className="text-center text-sm font-semibold text-flag-700 dark:text-flag-300">
                {error}
              </p>
            )}
            <button
              type="button"
              disabled={submitting || blockedByAge}
              onClick={onSubmit}
              className="flex min-h-12 items-center justify-between gap-2 rounded-full bg-brand-700 px-5 text-sm font-bold text-white shadow-lg shadow-brand-700/25 transition hover:bg-brand-800 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <span>{submitting ? 'Sending order…' : 'Place order'}</span>
              <span>{formatMoney(subtotal, currency)}</span>
            </button>
          </div>
        ) : (
          <Link
            href={loginHref}
            className="flex min-h-12 items-center justify-center gap-2 rounded-full bg-brand-700 px-5 text-sm font-bold text-white hover:bg-brand-800"
          >
            Log in to place your order <ArrowRightIcon aria-hidden className="h-4 w-4" />
          </Link>
        )
      }
    >
      <div className="flex flex-col gap-5 px-5 pb-5 pt-6">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-brand-700 dark:text-brand-300">Your order</p>
          <h2 className="mt-1 font-display text-2xl font-bold text-slate-950 dark:text-slate-50">{businessName}</h2>
        </div>

        {count === 0 ? (
          <p className="rounded-2xl bg-slate-50 p-6 text-center text-sm text-slate-500 dark:bg-slate-800/60 dark:text-slate-400">
            Your order is empty. Tap + on anything you&apos;d like.
          </p>
        ) : (
          <ul className="flex flex-col divide-y divide-slate-100 dark:divide-slate-800">
            {lines.map((line) => {
              const item = byId.get(line.menuItemId);
              if (!item) return null;
              const description = describeSelections(item, line.selections);
              return (
                <li key={line.key} className="flex gap-3 py-3">
                  <SafeImage
                    src={item.image ? resolveThumbUrl(item.image) : null}
                    alt=""
                    className="h-14 w-14 shrink-0 rounded-xl object-cover"
                    fallback={
                      <div aria-hidden className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-2xl dark:bg-slate-800">
                        {MENU_KIND_EMOJI[item.kind]}
                      </div>
                    }
                  />
                  <div className="flex min-w-0 flex-1 flex-col gap-1">
                    <div className="flex items-start justify-between gap-2">
                      <p className="font-semibold leading-snug text-slate-900 dark:text-slate-50">{item.name}</p>
                      <span className="shrink-0 text-sm font-bold text-slate-900 dark:text-slate-50">
                        {formatMoney(unitPriceFor(item, line.selections) * line.quantity, currency)}
                      </span>
                    </div>
                    {description && <p className="text-xs leading-5 text-slate-500 dark:text-slate-400">{description}</p>}
                    <div className="mt-1 flex items-center gap-1">
                      <button
                        type="button"
                        aria-label={line.quantity === 1 ? `Remove ${item.name}` : `Remove one ${item.name}`}
                        onClick={() => onQuantityChange(line.key, line.quantity - 1)}
                        className="flex h-8 w-8 items-center justify-center rounded-full border border-slate-300 text-slate-600 hover:border-brand-400 dark:border-slate-700 dark:text-slate-300"
                      >
                        {line.quantity === 1 ? <TrashIcon aria-hidden className="h-4 w-4" /> : <MinusIcon aria-hidden className="h-4 w-4" />}
                      </button>
                      <span className="w-7 text-center text-sm font-bold">{line.quantity}</span>
                      <button
                        type="button"
                        aria-label={`Add one ${item.name}`}
                        disabled={line.quantity >= MAX_LINE_QUANTITY}
                        onClick={() => onQuantityChange(line.key, line.quantity + 1)}
                        className="flex h-8 w-8 items-center justify-center rounded-full border border-slate-300 text-slate-600 hover:border-brand-400 disabled:opacity-30 dark:border-slate-700 dark:text-slate-300"
                      >
                        <PlusIcon aria-hidden className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}

        {count > 0 && (
          <>
            <div className="flex items-center justify-between rounded-2xl bg-slate-50 px-4 py-3 dark:bg-slate-800/60">
              <span className="text-sm font-semibold text-slate-600 dark:text-slate-300">
                Subtotal · {count} item{count === 1 ? '' : 's'}
              </span>
              <MenuPrice amount={subtotal} currency={currency} rate={rate} className="justify-end text-base font-bold text-slate-950 dark:text-slate-50" />
            </div>

            <label className="flex flex-col gap-1.5 text-sm">
              <span className="font-semibold text-slate-700 dark:text-slate-200">
                Note for {businessName} <span className="font-normal text-slate-400">optional</span>
              </span>
              <textarea
                value={notes}
                onChange={(e) => onNotesChange(e.target.value)}
                rows={2}
                maxLength={500}
                placeholder="Allergies, spice level, where to find you…"
                className="rounded-2xl border border-slate-300 bg-white p-3 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100 dark:border-slate-700 dark:bg-slate-800 dark:focus:ring-brand-900/40"
              />
            </label>

            {hasAlcohol && (
              <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-slate-200 p-4 text-sm dark:border-slate-700">
                <input
                  type="checkbox"
                  checked={ageConfirmed}
                  onChange={(e) => onAgeConfirmedChange(e.target.checked)}
                  className="mt-0.5 h-5 w-5 rounded border-slate-300 text-brand-700 accent-brand-700 focus:ring-brand-500"
                />
                <span className="text-slate-700 dark:text-slate-200">
                  <strong>I&apos;m 18 or older.</strong> This order includes alcohol, and the venue may ask for ID.
                </span>
              </label>
            )}

            <p className="text-xs leading-5 text-slate-500 dark:text-slate-400">
              {businessName} confirms your order before preparing it, and you can message them from My Orders.
            </p>
          </>
        )}
      </div>
    </MenuSheet>
  );
}
