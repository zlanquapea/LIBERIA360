"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowLeftIcon, ArrowRightIcon, CheckCircleIcon, ShoppingBagIcon } from "@heroicons/react/24/outline";
import { formatBusinessType, formatCost, formatRating } from "@/lib/format";
import { resolveImageUrl } from "@/lib/images";
import { SafeImage } from "@/components/SafeImage";
import { VerificationBadge } from "@/components/VerificationBadge";
import { useAuth } from "@/hooks/useAuth";
import { createFoodOrder } from "@/lib/food-orders-api";
import { HttpError } from "@/lib/http";
import type { Business, FoodOrder, MenuItem } from "@/lib/types";

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

// Anchor id for a category's section heading, so the sticky nav pills
// below can jump straight to it (plain `<a href="#...">`, same mechanism
// as creators/[username]/page.tsx's own profile-section nav — no
// scroll-spy JS needed for a same-page jump to already read well).
function categoryAnchor(category: string): string {
  const slug = category
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
  return `menu-${slug || "section"}`;
}

function MenuItemRow({
  item,
  quantity,
  onChangeQuantity,
}: {
  item: MenuItem;
  quantity: number;
  onChangeQuantity: (next: number) => void;
}) {
  const image = item.image ? resolveImageUrl(item.image) : null;
  return (
    <li className={`flex items-start gap-4 py-4 ${!item.isAvailable ? "opacity-60" : ""}`}>
      <SafeImage
        src={image}
        alt=""
        className="h-20 w-20 shrink-0 rounded-2xl object-cover sm:h-24 sm:w-24"
        fallback={
          <div
            aria-hidden
            className="flex h-20 w-20 shrink-0 items-center justify-center rounded-2xl bg-slate-100 text-2xl dark:bg-slate-800 sm:h-24 sm:w-24"
          >
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
          <p className="mt-1 text-sm leading-6 text-slate-500 dark:text-slate-400">{item.description}</p>
        )}
        {!item.isAvailable ? (
          <span className="mt-2 inline-block rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-500 dark:bg-slate-800 dark:text-slate-400">
            Sold out
          </span>
        ) : (
          <div
            className="mt-3 flex items-center overflow-hidden rounded-full border border-slate-300 dark:border-slate-700"
            style={{ width: "fit-content" }}
          >
            <button
              type="button"
              aria-label={`Remove one ${item.name}`}
              disabled={quantity === 0}
              onClick={() => onChangeQuantity(Math.max(0, quantity - 1))}
              className="flex h-9 w-9 items-center justify-center text-base disabled:cursor-not-allowed disabled:opacity-40"
            >
              −
            </button>
            <strong className="w-8 text-center text-sm">{quantity}</strong>
            <button
              type="button"
              aria-label={`Add one ${item.name}`}
              disabled={quantity >= 20}
              onClick={() => onChangeQuantity(Math.min(20, quantity + 1))}
              className="flex h-9 w-9 items-center justify-center text-base disabled:cursor-not-allowed disabled:opacity-40"
            >
              +
            </button>
          </div>
        )}
      </div>
    </li>
  );
}

// The dedicated full-menu + ordering experience — see
// web/src/app/[locale]/businesses/[slug]/menu/page.tsx, and
// MenuPreviewSection's doc comment for why this moved off the profile
// page. Everything the old inline MenuSection did (cart, checkout,
// order submission) still happens here; it just finally has a whole page
// to do it in, with room for real photos and a sticky per-category jump
// nav instead of a cramped two-column grid.
export function RestaurantMenuOrdering({ business, items }: { business: Business; items: MenuItem[] }) {
  const { user, token } = useAuth();
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submittedOrder, setSubmittedOrder] = useState<FoodOrder | null>(null);

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
    if (!token) return;
    setSubmitting(true);
    setError(null);
    try {
      const order = await createFoodOrder(token, business.id, {
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
      <main className="mx-auto flex max-w-xl flex-col items-center gap-4 px-4 py-16 text-center sm:py-24">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">
          <CheckCircleIcon aria-hidden className="h-9 w-9" />
        </div>
        <h1 className="font-display text-2xl font-bold text-slate-950 dark:text-slate-50">Order sent!</h1>
        <p className="max-w-sm text-sm leading-6 text-slate-600 dark:text-slate-300">
          Your order for {formatCost(submittedOrder.totalAmount)} has been sent to {business.name}. You&apos;ll be
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
          <Link
            href={`/businesses/${business.slug}`}
            className="flex min-h-11 items-center justify-center text-sm font-semibold text-brand-700 hover:underline dark:text-brand-300"
          >
            Back to {business.name}
          </Link>
        </div>
      </main>
    );
  }

  const groups = groupMenuByCategory(items);
  const cover = business.images[0] ?? business.linkedPlace.images[0] ?? null;

  return (
    <main className="mx-auto flex max-w-3xl flex-col">
      <div className="px-4 pt-4 sm:px-6">
        <Link
          href={`/businesses/${business.slug}`}
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-brand-700 hover:underline dark:text-brand-300"
        >
          <ArrowLeftIcon aria-hidden className="h-4 w-4" />
          Back to {business.name}
        </Link>
      </div>

      <div className="relative mx-4 mt-4 h-40 overflow-hidden rounded-[2rem] sm:mx-6 sm:h-56">
        <SafeImage
          src={cover ? resolveImageUrl(cover) : null}
          alt=""
          className="h-full w-full object-cover"
          fallback={<div aria-hidden className="h-full w-full bg-gradient-to-br from-brand-800 to-brand-950" />}
        />
        <div aria-hidden className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/10 to-transparent" />
        <div className="absolute inset-x-0 bottom-0 p-4 sm:p-6">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-white/80">Full menu</p>
          <h1 className="mt-1 flex flex-wrap items-center gap-2 font-display text-2xl font-bold text-white sm:text-3xl">
            {business.name}
            <VerificationBadge status={business.verificationStatus} compact />
          </h1>
          <p className="mt-1 text-sm text-white/80">
            {formatBusinessType(business.type)} · {formatRating(business.linkedPlace.rating, business.linkedPlace.reviewCount)}
          </p>
        </div>
      </div>

      {groups.length > 1 && (
        <nav
          aria-label="Menu sections"
          className="sticky top-16 z-10 mx-4 mt-4 overflow-x-auto rounded-2xl border border-slate-200 bg-white/95 p-1 shadow-sm backdrop-blur dark:border-slate-800 dark:bg-slate-900/95 sm:top-[5.5rem] sm:mx-6"
        >
          <div className="flex min-w-max gap-1">
            {groups.map((group) => (
              <a
                key={group.category}
                href={`#${categoryAnchor(group.category)}`}
                className="inline-flex min-h-10 shrink-0 items-center justify-center rounded-xl px-3.5 py-2 text-xs font-semibold text-slate-600 hover:bg-brand-50 hover:text-brand-700 dark:text-slate-300 dark:hover:bg-brand-950/30 dark:hover:text-brand-300 sm:text-sm"
              >
                {group.category}
              </a>
            ))}
          </div>
        </nav>
      )}

      <div className="flex flex-col gap-6 px-4 pt-6 sm:px-6">
        {groups.map((group) => (
          <section key={group.category} id={categoryAnchor(group.category)} className="scroll-mt-28">
            <h2 className="border-b border-slate-100 pb-2 font-display text-lg font-bold text-slate-950 dark:border-slate-800 dark:text-slate-50">
              {group.category}
            </h2>
            <ul className="divide-y divide-slate-100 dark:divide-slate-800">
              {group.items.map((item) => (
                <MenuItemRow
                  key={item.id}
                  item={item}
                  quantity={quantities[item.id] ?? 0}
                  onChangeQuantity={(next) => setQuantities((all) => ({ ...all, [item.id]: next }))}
                />
              ))}
            </ul>
          </section>
        ))}
      </div>

      {cartCount > 0 && (
        <>
          {/* Reserves the space the fixed cart bar below covers, so it never
              hides the last item in the list. */}
          <div aria-hidden className="h-28 sm:h-24" />
          {/* z-[85] (not the plainer z-30 this shipped with — caught live,
              via Playwright, before merge): the reserved strip above
              BottomNav on mobile is also where the global LanguageSwitcher
              (z-40) and Liberia360Assistant launcher (z-[80]) sit by
              default. At z-30 the switcher's dropdown sat on top of this
              bar's own "Review order"/checkout controls and silently ate
              every tap in that corner — a real click, not a rendering
              glitch, so no screenshot alone would have shown it. Matches
              StickyBookingBar's own z-[85] fix for the identical strip. */}
          <div className="fixed inset-x-0 bottom-[calc(5rem+env(safe-area-inset-bottom))] z-[85] border-t border-brand-200 bg-brand-50/95 px-4 py-3 shadow-[0_-8px_24px_rgba(15,23,42,0.12)] backdrop-blur supports-[backdrop-filter]:bg-brand-50/85 dark:border-brand-800 dark:bg-brand-950/90 lg:bottom-0">
            <div className="mx-auto flex max-w-3xl flex-col gap-3">
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
                  <p className="text-slate-600 dark:text-slate-300">Log in to send this order to {business.name}.</p>
                  <Link
                    href="/login"
                    className="flex items-center gap-1 font-semibold text-brand-700 hover:underline dark:text-brand-300"
                  >
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
                      className="rounded-xl border border-slate-300 bg-white p-2 text-sm dark:border-slate-700 dark:bg-slate-800"
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
          </div>
        </>
      )}
    </main>
  );
}
