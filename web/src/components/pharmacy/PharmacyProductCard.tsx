'use client';

import { MinusIcon, PlusIcon } from '@heroicons/react/24/solid';
import { DocumentTextIcon } from '@heroicons/react/24/outline';
import { resolveImageUrl, resolveThumbUrl } from '@/lib/images';
import { SafeImage } from '@/components/SafeImage';
import { MAX_PER_PRODUCT, money, stockOf } from '@/lib/pharmacy-ordering';
import type { PharmacyProduct } from '@/lib/pharmacy-api';

/**
 * A medicine as a menu card: name, badges and price on the left, the pack
 * photo on the right with a round "+" — the same shape as a restaurant
 * dish, so ordering medicine feels as easy as ordering food. Once in the
 * cart the "+" becomes a − / count / + stepper capped at stock.
 */
export function PharmacyProductCard({
  product,
  quantity,
  onChange,
}: {
  product: PharmacyProduct;
  quantity: number;
  onChange: (next: number) => void;
}) {
  const stock = stockOf(product);
  const soldOut = stock <= 0;
  const max = Math.min(stock, MAX_PER_PRODUCT);
  const low = !soldOut && stock <= 5;

  return (
    <article
      className={`relative flex gap-4 rounded-3xl border border-slate-200/80 bg-white p-3 shadow-sm transition hover:border-emerald-200 hover:shadow-md motion-reduce:transition-none dark:border-slate-800 dark:bg-slate-900 sm:p-4 ${
        soldOut ? 'opacity-70' : ''
      }`}
    >
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <span className="flex flex-wrap gap-1">
          {product.prescriptionRequired ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-bold text-amber-900 dark:bg-amber-900/40 dark:text-amber-200">
              <DocumentTextIcon aria-hidden className="h-3.5 w-3.5" />
              Prescription
            </span>
          ) : (
            <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300">
              Over the counter
            </span>
          )}
          {low && (
            <span className="rounded-full bg-rose-50 px-2 py-0.5 text-[11px] font-semibold text-rose-700 dark:bg-rose-950/50 dark:text-rose-300">
              Only {stock} left
            </span>
          )}
        </span>
        <h3 className="font-display text-[15px] font-bold leading-snug text-slate-950 [overflow-wrap:anywhere] dark:text-slate-50 sm:text-base">
          {product.name}
        </h3>
        {product.prescriptionRequired && (
          <p className="text-xs leading-5 text-slate-500 dark:text-slate-400">A pharmacist checks your prescription first.</p>
        )}
        <p className="mt-auto pt-1 text-[15px] font-bold text-slate-950 dark:text-slate-50">{money(product.price)}</p>
      </div>

      <div className="relative h-24 w-24 shrink-0 sm:h-28 sm:w-28">
        <SafeImage
          src={product.imageUrl ? resolveImageUrl(product.imageUrl) : null}
          thumbSrc={product.imageUrl ? resolveThumbUrl(product.imageUrl) : null}
          alt=""
          className={`h-full w-full rounded-2xl object-cover ${soldOut ? 'grayscale' : ''}`}
          fallback={
            <div
              aria-hidden
              className="flex h-full w-full items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-50 to-sky-50 text-4xl dark:from-emerald-950/50 dark:to-slate-800"
            >
              💊
            </div>
          }
        />
        {soldOut ? (
          <span className="absolute inset-x-2 bottom-2 rounded-full bg-slate-900/85 py-1 text-center text-xs font-bold text-white">
            Out of stock
          </span>
        ) : quantity > 0 ? (
          <div className="absolute -bottom-2 -end-2 flex items-center rounded-full bg-emerald-700 text-white shadow-lg ring-4 ring-white dark:ring-slate-900">
            <button
              type="button"
              onClick={() => onChange(quantity - 1)}
              aria-label={`Remove one ${product.name}`}
              className="flex h-10 w-10 items-center justify-center rounded-full hover:bg-emerald-800"
            >
              <MinusIcon aria-hidden className="h-4 w-4" />
            </button>
            <span aria-live="polite" className="min-w-6 text-center text-sm font-bold tabular-nums">
              {quantity}
            </span>
            <button
              type="button"
              onClick={() => onChange(quantity + 1)}
              disabled={quantity >= max}
              aria-label={`Add one more ${product.name}`}
              className="flex h-10 w-10 items-center justify-center rounded-full hover:bg-emerald-800 disabled:opacity-40"
            >
              <PlusIcon aria-hidden className="h-4 w-4" />
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => onChange(1)}
            aria-label={`Add ${product.name} to cart`}
            className="absolute -bottom-2 -end-2 flex h-11 w-11 items-center justify-center rounded-full bg-emerald-700 text-white shadow-lg ring-4 ring-white transition hover:scale-105 hover:bg-emerald-800 active:scale-95 motion-reduce:transition-none dark:ring-slate-900"
          >
            <PlusIcon aria-hidden className="h-5 w-5" />
          </button>
        )}
      </div>
    </article>
  );
}
