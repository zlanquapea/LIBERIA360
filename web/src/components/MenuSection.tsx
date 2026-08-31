"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowRightIcon, CheckCircleIcon, ShoppingBagIcon } from "@heroicons/react/24/outline";
import { formatCost } from "@/lib/format";
import { resolveImageUrl } from "@/lib/images";
import { SafeImage } from "@/components/SafeImage";
import { useAuth } from "@/hooks/useAuth";
import { createFoodOrder } from "@/lib/food-orders-api";
import { HttpError } from "@/lib/http";
import type { FoodOrder, MenuItem } from "@/lib/types";

// Groups a business's menu into its sections in the order the backend
// already returns them (category ASC, then sortOrder — see
// MenuItemsService.findForBusiness), with uncategorized items collected
// under "Menu" at the end rather than scattered by their null category.
function groupMenuByCategory(items: MenuItem[]): { category: string; items: MenuItem[] }[] {
  const groups: { category: string; items: MenuItem[] }[] = [];
  for (const item of items) {
    const category = item.category ?? "Menu";
    const group = groups.find((g) => g.category === category);
    if (group) {
      group.items.push(item);
    } else {
      groups.push({ category, items: [item] });
    }
  }
  return groups;
}

function MenuItemRow({
  item,
  quantity,
  onChangeQuantity,
}: {
  item: MenuItem;
  quantity: number;
  onChangeQuantity: ((next: number) => void) | null;
}) {
  const image = item.image ? resolveImageUrl(item.image) : null;
  return (
    <li className={`flex items-start gap-3 py-3 ${!item.isAvailable ? "opacity-60" : ""}`}>
      <SafeImage
        src={image}
        alt=""
        className="h-14 w-14 shrink-0 rounded-xl object-cover"
        fallback={
          <div aria-hidden className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-lg dark:bg-slate-800">
            🍽️
          </div>
        }
      />
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-3">
          <p className="font-semibold text-slate-900 dark:text-slate-50">{item.name}</p>
          <span className="shrink-0 font-semibold text-slate-900 dark:text-slate-50">{formatCost(item.price)}</span>
        </div>
        {item.description && (
          <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">{item.description}</p>
        )}
        {!item.isAvailable ? (
          <span className="mt-1 inline-block rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-500 dark:bg-slate-800 dark:text-slate-400">
            Sold out
          </span>
        ) : onChangeQuantity ? (
          <div className="mt-2 flex items-center overflow-hidden rounded-full border border-slate-300 dark:border-slate-700" style={{ width: "fit-content" }}>
            <button
              type="button"
              aria-label={`Remove one ${item.name}`}
              disabled={quantity === 0}
              onClick={() => onChangeQuantity(Math.max(0, quantity - 1))}
              className="flex h-8 w-8 items-center justify-center text-base disabled:cursor-not-allowed disabled:opacity-40"
            >
              −
            </button>
            <strong className="w-7 text-center text-sm">{quantity}</strong>
            <button
              type="button"
              aria-label={`Add one ${item.name}`}
              disabled={quantity >= 20}
              onClick={() => onChangeQuantity(Math.min(20, quantity + 1))}
              className="flex h-8 w-8 items-center justify-center text-base disabled:cursor-not-allowed disabled:opacity-40"
            >
              +
            </button>
          </div>
        ) : null}
      </div>
    </li>
  );
}

// Shared by both the Place page (a visitor's primary destination — where a
// restaurant's menu belongs, per the "menu is information about the place,
// not about the business entity" product decision) and the Business page
// (kept for anyone who lands there directly, e.g. via an old link). Neither
// page duplicates groupMenuByCategory/MenuItemRow anymore.
//
// `businessId` turns this from a read-only menu display into an ordering
// cart: quantity steppers appear on every in-stock item, and a running
// order summary lets the visitor place the order without leaving the page.
// Omit it (or pass no items) to fall back to the plain read-only menu.
export function MenuSection({ items, businessId }: { items: MenuItem[]; businessId?: string }) {
  const { user, token } = useAuth();
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submittedOrder, setSubmittedOrder] = useState<FoodOrder | null>(null);

  if (items.length === 0) return null;

  const cartEntries = Object.entries(quantities).filter(([, qty]) => qty > 0);
  const cartCount = cartEntries.reduce((sum, [, qty]) => sum + qty, 0);
  const cartTotal = cartEntries.reduce((sum, [itemId, qty]) => {
    const item = items.find((i) => i.id === itemId);
    return sum + (item ? item.price * qty : 0);
  }, 0);

  function resetCart() {
    setQuantities({});
    setNotes("");
    setError(null);
    setCheckoutOpen(false);
    setSubmittedOrder(null);
  }

  async function submitOrder() {
    if (!token || !businessId) return;
    setSubmitting(true);
    setError(null);
    try {
      const order = await createFoodOrder(token, businessId, {
        items: cartEntries.map(([menuItemId, quantity]) => ({ menuItemId, quantity })),
        notes: notes.trim() || undefined,
      });
      setSubmittedOrder(order);
    } catch (err) {
      setError(err instanceof HttpError ? err.message : "Unable to place your order. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  if (submittedOrder) {
    return (
      <section className="flex flex-col items-center gap-3 rounded-[2rem] border border-slate-200 bg-white p-6 text-center shadow-card dark:border-slate-800 dark:bg-slate-900">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">
          <CheckCircleIcon aria-hidden className="h-8 w-8" />
        </div>
        <h2 className="font-display text-xl font-bold text-slate-950 dark:text-slate-50">Order sent!</h2>
        <p className="max-w-sm text-sm leading-6 text-slate-600 dark:text-slate-300">
          Your order for {formatCost(submittedOrder.totalAmount)} has been sent to the restaurant. You&apos;ll be
          notified once they confirm it — you can message them directly from My Orders in the meantime.
        </p>
        <div className="mt-2 flex w-full max-w-xs flex-col gap-2">
          <Link
            href="/account/my-orders"
            className="flex min-h-11 items-center justify-center gap-1.5 rounded-full bg-brand-700 px-5 text-sm font-semibold text-white hover:bg-brand-800"
          >
            View my orders <ArrowRightIcon aria-hidden className="h-4 w-4" />
          </Link>
          <button
            type="button"
            onClick={resetCart}
            className="flex min-h-11 items-center justify-center rounded-full border border-slate-300 px-5 text-sm font-semibold text-slate-700 hover:border-brand-400 dark:border-slate-700 dark:text-slate-200"
          >
            Order again
          </button>
        </div>
      </section>
    );
  }

  return (
    <section className="flex flex-col gap-4 rounded-[2rem] border border-slate-200 bg-white p-5 shadow-card dark:border-slate-800 dark:bg-slate-900 sm:p-7">
      <p className="text-xs font-bold uppercase tracking-[0.2em] text-brand-700 dark:text-brand-300">What&apos;s on offer</p>
      <h2 className="font-display text-2xl font-bold text-slate-950 dark:text-slate-50">Menu</h2>
      <div className="grid gap-x-8 gap-y-2 sm:grid-cols-2">
        {groupMenuByCategory(items).map((group) => (
          <div key={group.category} className="min-w-0">
            <h3 className="border-b border-slate-100 pb-2 font-display text-sm font-bold uppercase tracking-wide text-brand-700 dark:border-slate-800 dark:text-brand-300">
              {group.category}
            </h3>
            <ul className="divide-y divide-slate-100 dark:divide-slate-800">
              {group.items.map((item) => (
                <MenuItemRow
                  key={item.id}
                  item={item}
                  quantity={quantities[item.id] ?? 0}
                  onChangeQuantity={
                    businessId ? (next) => setQuantities((all) => ({ ...all, [item.id]: next })) : null
                  }
                />
              ))}
            </ul>
          </div>
        ))}
      </div>

      {businessId && cartCount > 0 && (
        <div className="sticky bottom-4 flex flex-col gap-3 rounded-2xl border border-brand-200 bg-brand-50 p-4 dark:border-brand-800 dark:bg-brand-950/40">
          <div className="flex items-center justify-between gap-3">
            <span className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-slate-50">
              <ShoppingBagIcon aria-hidden className="h-5 w-5 text-brand-700 dark:text-brand-300" />
              {cartCount} item{cartCount === 1 ? "" : "s"} · {formatCost(cartTotal)}
            </span>
            {!checkoutOpen && (
              <button
                type="button"
                onClick={() => setCheckoutOpen(true)}
                className="rounded-full bg-brand-700 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-800"
              >
                Review order
              </button>
            )}
          </div>

          {checkoutOpen && !user && (
            <div className="flex flex-col gap-2 rounded-xl bg-white p-3 text-sm dark:bg-slate-900">
              <p className="text-slate-600 dark:text-slate-300">Log in to send this order to the restaurant.</p>
              <Link href="/login" className="flex items-center gap-1 font-semibold text-brand-700 hover:underline dark:text-brand-300">
                Log in to continue <ArrowRightIcon aria-hidden className="h-4 w-4" />
              </Link>
            </div>
          )}

          {checkoutOpen && user && (
            <div className="flex flex-col gap-3">
              <label className="flex flex-col gap-1 text-sm">
                <span className="font-medium text-slate-700 dark:text-slate-200">
                  Note for the restaurant <em className="font-normal text-slate-400">optional</em>
                </span>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={2}
                  maxLength={500}
                  placeholder="Allergies, spice level, delivery vs pickup…"
                  className="rounded-xl border border-slate-300 p-2 text-sm dark:border-slate-700 dark:bg-slate-800"
                />
              </label>
              {error && (
                <p role="alert" className="text-sm font-medium text-red-600 dark:text-red-400">
                  {error}
                </p>
              )}
              <button
                type="button"
                disabled={submitting}
                onClick={submitOrder}
                className="flex min-h-11 items-center justify-center gap-1.5 rounded-full bg-brand-700 px-5 text-sm font-semibold text-white hover:bg-brand-800 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {submitting ? "Sending order…" : `Place order · ${formatCost(cartTotal)}`}
                <ArrowRightIcon aria-hidden className="h-4 w-4" />
              </button>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
