'use client';

import { PlusIcon } from '@heroicons/react/24/solid';
import { resolveImageUrl, resolveThumbUrl } from '@/lib/images';
import { MENU_KIND_EMOJI, MENU_TAG_LABELS, MENU_TAG_STYLES } from '@/lib/menu';
import { SafeImage } from '@/components/SafeImage';
import type { MenuCurrency, MenuItem } from '@/lib/types';
import { MenuPrice } from './MenuPrice';

export function MenuTagBadges({ item, max = 3 }: { item: MenuItem; max?: number }) {
  if (item.tags.length === 0 && !item.containsAlcohol) return null;
  return (
    <span className="flex flex-wrap gap-1">
      {item.tags.slice(0, max).map((tag) => (
        <span key={tag} className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${MENU_TAG_STYLES[tag]}`}>
          {tag === 'popular' ? '★ ' : tag === 'spicy' ? '🌶 ' : ''}
          {MENU_TAG_LABELS[tag]}
        </span>
      ))}
      {item.containsAlcohol && (
        <span className="rounded-full bg-slate-900 px-2 py-0.5 text-[11px] font-bold text-white dark:bg-slate-100 dark:text-slate-900">
          18+
        </span>
      )}
    </span>
  );
}

export function MenuItemCard({
  item,
  currency,
  rate,
  inCart,
  onOpen,
  onQuickAdd,
}: {
  item: MenuItem;
  currency: MenuCurrency;
  rate: number | null;
  inCart: number;
  onOpen: () => void;
  onQuickAdd: () => void;
}) {
  const soldOut = !item.isAvailable;
  const hasOptions = item.optionGroups.length > 0;

  return (
    <article
      className={`group relative flex gap-4 rounded-3xl border border-slate-200/80 bg-white p-3 shadow-sm transition hover:-translate-y-0.5 hover:border-brand-200 hover:shadow-md motion-reduce:transition-none motion-reduce:hover:translate-y-0 dark:border-slate-800 dark:bg-slate-900 dark:hover:border-brand-800 sm:p-4 ${
        soldOut ? 'opacity-70' : ''
      }`}
    >
      {/* Stretched button: the whole card opens the item, while the + below
          stays its own separate control (no nested buttons). */}
      <button type="button" onClick={onOpen} className="absolute inset-0 z-0 rounded-3xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500">
        <span className="sr-only">View {item.name}</span>
      </button>

      <div className="pointer-events-none relative flex min-w-0 flex-1 flex-col gap-1.5">
        <MenuTagBadges item={item} />
        <h3 className="font-display text-[15px] font-bold leading-snug text-slate-950 dark:text-slate-50 sm:text-base">{item.name}</h3>
        {item.description && (
          <p className="line-clamp-2 text-sm leading-5 text-slate-500 dark:text-slate-400">{item.description}</p>
        )}
        <div className="mt-auto flex flex-wrap items-center gap-x-2 gap-y-1 pt-1">
          <MenuPrice amount={item.price} currency={currency} rate={rate} className="text-[15px] font-bold text-slate-950 dark:text-slate-50" />
          {item.servingSize && <span className="text-xs font-medium text-slate-400">· {item.servingSize}</span>}
          {hasOptions && !soldOut && <span className="text-xs font-medium text-brand-700 dark:text-brand-300">· Customizable</span>}
        </div>
      </div>

      <div className="relative h-28 w-28 shrink-0 sm:h-32 sm:w-32">
        <SafeImage
          src={item.image ? resolveImageUrl(item.image) : null}
          thumbSrc={item.image ? resolveThumbUrl(item.image) : null}
          alt=""
          className={`pointer-events-none h-full w-full rounded-2xl object-cover ${soldOut ? 'grayscale' : ''}`}
          fallback={
            <div
              aria-hidden
              className="pointer-events-none flex h-full w-full items-center justify-center rounded-2xl bg-gradient-to-br from-brand-50 to-gold-100 text-4xl dark:from-brand-950 dark:to-slate-800"
            >
              {MENU_KIND_EMOJI[item.kind]}
            </div>
          }
        />
        {soldOut ? (
          <span className="pointer-events-none absolute inset-x-2 bottom-2 rounded-full bg-slate-900/85 py-1 text-center text-xs font-bold text-white">
            Sold out
          </span>
        ) : (
          <button
            type="button"
            onClick={onQuickAdd}
            aria-label={hasOptions ? `Choose options for ${item.name}` : `Add ${item.name} to order`}
            className="absolute -bottom-2 -end-2 z-10 flex h-11 w-11 items-center justify-center rounded-full bg-brand-700 text-white shadow-lg ring-4 ring-white transition hover:scale-105 hover:bg-brand-800 active:scale-95 motion-reduce:transition-none dark:ring-slate-900"
          >
            {inCart > 0 ? <span className="text-sm font-bold">{inCart}</span> : <PlusIcon aria-hidden className="h-5 w-5" />}
          </button>
        )}
      </div>
    </article>
  );
}
