'use client';

import { useEffect, useState } from 'react';
import { MinusIcon, PlusIcon } from '@heroicons/react/24/outline';
import { resolveImageUrl } from '@/lib/images';
import { MENU_KIND_EMOJI } from '@/lib/menu';
import { MAX_LINE_QUANTITY, selectionError, unitPriceFor, type CartSelection } from '@/lib/menu-cart';
import { formatMoney } from '@/lib/currency';
import { SafeImage } from '@/components/SafeImage';
import type { MenuCurrency, MenuItem, MenuOptionGroup } from '@/lib/types';
import { MenuSheet } from './MenuSheet';
import { MenuTagBadges } from './MenuItemCard';
import { MenuPrice } from './MenuPrice';
import { DishNotes } from '@/components/DishNotes';

function defaultSelections(item: MenuItem): CartSelection[] {
  // Pre-pick the first choice of a required pick-one group (usually the
  // regular size) so the common order is a single tap.
  return item.optionGroups
    .filter((g) => g.required && g.maxSelections === 1 && g.choices.length > 0)
    .map((g) => ({ groupId: g.id, choiceIds: [g.choices[0].id] }));
}

function OptionGroupPicker({
  group,
  chosen,
  currency,
  onChange,
}: {
  group: MenuOptionGroup;
  chosen: string[];
  currency: MenuCurrency;
  onChange: (choiceIds: string[]) => void;
}) {
  const single = group.maxSelections === 1;
  const atLimit = !single && chosen.length >= group.maxSelections;

  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="mb-2 flex w-full items-center justify-between gap-2">
        <span className="font-display text-base font-bold text-slate-950 dark:text-slate-50">{group.name}</span>
        <span
          className={`rounded-full px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide ${
            group.required
              ? 'bg-brand-50 text-brand-800 dark:bg-brand-950/60 dark:text-brand-200'
              : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'
          }`}
        >
          {group.required ? 'Required' : single ? 'Optional' : `Up to ${group.maxSelections}`}
        </span>
      </legend>
      {group.choices.map((choice) => {
        const checked = chosen.includes(choice.id);
        const disabled = !checked && atLimit;
        return (
          <label
            key={choice.id}
            className={`flex min-h-12 cursor-pointer items-center gap-3 rounded-2xl border px-4 py-2.5 transition ${
              checked
                ? 'border-brand-600 bg-brand-50/60 dark:border-brand-400 dark:bg-brand-950/40'
                : 'border-slate-200 hover:border-slate-300 dark:border-slate-700'
            } ${disabled ? 'cursor-not-allowed opacity-50' : ''}`}
          >
            <input
              type={single ? 'radio' : 'checkbox'}
              name={`group-${group.id}`}
              checked={checked}
              disabled={disabled}
              onChange={() => {
                if (single) onChange([choice.id]);
                else onChange(checked ? chosen.filter((id) => id !== choice.id) : [...chosen, choice.id]);
              }}
              className={`h-5 w-5 border-slate-300 text-brand-700 accent-brand-700 focus:ring-brand-500 dark:border-slate-600 ${single ? '' : 'rounded'}`}
            />
            <span className="flex-1 text-sm font-medium text-slate-800 dark:text-slate-100">{choice.name}</span>
            {choice.priceDelta > 0 && (
              <span className="text-sm font-semibold text-slate-500 dark:text-slate-400">+{formatMoney(choice.priceDelta, currency)}</span>
            )}
          </label>
        );
      })}
      {single && !group.required && chosen.length > 0 && (
        <button type="button" onClick={() => onChange([])} className="self-start text-xs font-semibold text-brand-700 hover:underline dark:text-brand-300">
          Clear choice
        </button>
      )}
    </fieldset>
  );
}

export function MenuItemSheet({
  item,
  currency,
  rate,
  onClose,
  onAdd,
}: {
  item: MenuItem | null;
  currency: MenuCurrency;
  rate: number | null;
  onClose: () => void;
  onAdd: (item: MenuItem, selections: CartSelection[], quantity: number) => void;
}) {
  const [selections, setSelections] = useState<CartSelection[]>([]);
  const [quantity, setQuantity] = useState(1);
  const [showErrors, setShowErrors] = useState(false);

  useEffect(() => {
    if (!item) return;
    setSelections(defaultSelections(item));
    setQuantity(1);
    setShowErrors(false);
  }, [item]);

  if (!item) return null;

  const error = selectionError(item, selections);
  const lineTotal = unitPriceFor(item, selections) * quantity;
  const soldOut = !item.isAvailable;

  function setGroup(groupId: string, choiceIds: string[]) {
    setSelections((prev) => [...prev.filter((s) => s.groupId !== groupId), { groupId, choiceIds }]);
  }

  function add() {
    if (!item) return;
    if (error) {
      setShowErrors(true);
      return;
    }
    onAdd(item, selections, quantity);
  }

  return (
    <MenuSheet
      open
      onClose={onClose}
      label={item.name}
      footer={
        soldOut ? (
          <p className="text-center text-sm font-semibold text-slate-500">Sold out right now — check back later.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {showErrors && error && (
              <p role="alert" className="text-center text-sm font-semibold text-flag-700 dark:text-flag-300">
                {error}
              </p>
            )}
            <div className="flex items-center gap-3">
              <div className="flex items-center rounded-full border border-slate-300 dark:border-slate-700">
                <button
                  type="button"
                  aria-label="Decrease quantity"
                  disabled={quantity <= 1}
                  onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                  className="flex h-11 w-11 items-center justify-center disabled:opacity-30"
                >
                  <MinusIcon aria-hidden className="h-4 w-4" />
                </button>
                <span aria-live="polite" className="w-7 text-center font-bold">
                  {quantity}
                </span>
                <button
                  type="button"
                  aria-label="Increase quantity"
                  disabled={quantity >= MAX_LINE_QUANTITY}
                  onClick={() => setQuantity((q) => Math.min(MAX_LINE_QUANTITY, q + 1))}
                  className="flex h-11 w-11 items-center justify-center disabled:opacity-30"
                >
                  <PlusIcon aria-hidden className="h-4 w-4" />
                </button>
              </div>
              <button
                type="button"
                onClick={add}
                className="flex min-h-12 flex-1 items-center justify-between gap-2 rounded-full bg-brand-700 px-5 text-sm font-bold text-white shadow-lg shadow-brand-700/25 transition hover:bg-brand-800 active:scale-[0.99]"
              >
                <span>Add to order</span>
                <span>{formatMoney(lineTotal, currency)}</span>
              </button>
            </div>
          </div>
        )
      }
    >
      <div className="relative h-56 w-full sm:h-64">
        <SafeImage
          src={item.image ? resolveImageUrl(item.image) : null}
          alt=""
          className={`h-full w-full object-cover ${soldOut ? 'grayscale' : ''}`}
          fallback={
            <div aria-hidden className="flex h-full w-full items-center justify-center bg-gradient-to-br from-brand-100 via-gold-100 to-brand-50 text-7xl dark:from-brand-950 dark:via-slate-900 dark:to-slate-800">
              {MENU_KIND_EMOJI[item.kind]}
            </div>
          }
        />
      </div>

      <div className="flex flex-col gap-5 px-5 py-5">
        <div className="flex flex-col gap-2">
          <MenuTagBadges item={item} max={7} />
          <h2 className="font-display text-2xl font-bold leading-tight text-slate-950 dark:text-slate-50">{item.name}</h2>
          <div className="flex flex-wrap items-center gap-x-2 text-sm">
            <MenuPrice amount={item.price} currency={currency} rate={rate} className="text-lg font-bold text-slate-950 dark:text-slate-50" />
            {item.servingSize && <span className="font-medium text-slate-500">· {item.servingSize}</span>}
          </div>
          {item.description && <p className="text-[15px] leading-6 text-slate-600 dark:text-slate-300">{item.description}</p>}
          <DishNotes texts={[item.name, item.description]} variant="inline" />
          {item.containsAlcohol && (
            <p className="rounded-2xl bg-slate-100 px-4 py-3 text-xs font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300">
              Contains alcohol. You&apos;ll be asked to confirm you&apos;re 18 or older at checkout.
            </p>
          )}
        </div>

        {item.optionGroups.map((group) => (
          <OptionGroupPicker
            key={group.id}
            group={group}
            currency={currency}
            chosen={selections.find((s) => s.groupId === group.id)?.choiceIds ?? []}
            onChange={(ids) => setGroup(group.id, ids)}
          />
        ))}
      </div>
    </MenuSheet>
  );
}
