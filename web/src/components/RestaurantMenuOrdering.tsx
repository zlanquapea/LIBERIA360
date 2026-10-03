"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeftIcon,
  ArrowRightIcon,
  CheckCircleIcon,
  MagnifyingGlassIcon,
  ShoppingBagIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";
import { StarIcon } from "@heroicons/react/20/solid";
import { formatBusinessType, formatRating } from "@/lib/format";
import { resolveImageUrl } from "@/lib/images";
import { formatMoney } from "@/lib/currency";
import {
  MENU_KIND_EMOJI,
  MENU_KIND_LABELS,
  groupBySection,
  menuKindsInOrder,
} from "@/lib/menu";
import {
  addToCart,
  cartSummary,
  loadCart,
  pruneCart,
  saveCart,
  setLineQuantity,
  type CartLine,
  type CartSelection,
} from "@/lib/menu-cart";
import { SafeImage } from "@/components/SafeImage";
import { VerificationBadge } from "@/components/VerificationBadge";
import { useAuth } from "@/hooks/useAuth";
import { createFoodOrder } from "@/lib/food-orders-api";
import { HttpError } from "@/lib/http";
import type { Business, FoodOrder, MenuCurrency, MenuItem, MenuItemKind } from "@/lib/types";
import { MenuItemCard } from "./menu/MenuItemCard";
import { MenuItemSheet } from "./menu/MenuItemSheet";
import { CartSheet } from "./menu/CartSheet";
import { MenuPrice } from "./menu/MenuPrice";

function sectionAnchor(kind: MenuItemKind, section: string): string {
  const slug = section
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
  return `menu-${kind}-${slug || "section"}`;
}

function PopularRail({
  items,
  currency,
  rate,
  onOpen,
}: {
  items: MenuItem[];
  currency: MenuCurrency;
  rate: number | null;
  onOpen: (item: MenuItem) => void;
}) {
  if (items.length === 0) return null;
  return (
    <section aria-labelledby="menu-popular" className="flex flex-col gap-3">
      <h2 id="menu-popular" className="flex items-center gap-2 font-display text-lg font-bold text-slate-950 dark:text-slate-50">
        <StarIcon aria-hidden className="h-5 w-5 text-gold-500" />
        Most loved
      </h2>
      <div className="-mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-2 sm:-mx-6 sm:px-6">
        {items.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => onOpen(item)}
            className="group relative h-52 w-44 shrink-0 snap-start overflow-hidden rounded-3xl text-start shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 sm:w-52"
          >
            <SafeImage
              src={item.image ? resolveImageUrl(item.image) : null}
              alt=""
              className="h-full w-full object-cover transition duration-500 group-hover:scale-105 motion-reduce:transition-none"
              fallback={
                <div aria-hidden className="flex h-full w-full items-center justify-center bg-gradient-to-br from-brand-700 to-brand-950 text-6xl">
                  {MENU_KIND_EMOJI[item.kind]}
                </div>
              }
            />
            <div aria-hidden className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/20 to-transparent" />
            <div className="absolute inset-x-0 bottom-0 flex flex-col gap-0.5 p-3 text-white">
              <span className="line-clamp-2 font-display text-[15px] font-bold leading-snug">{item.name}</span>
              <MenuPrice amount={item.price} currency={currency} rate={rate} className="text-sm font-semibold" estimateClassName="text-white/70" />
            </div>
          </button>
        ))}
      </div>
    </section>
  );
}

// The full menu + ordering experience behind /businesses/[slug]/menu.
// Food-delivery-app conventions throughout: Food/Drinks/Desserts tabs,
// photo cards with a quick-add +, a detail sheet for customizations, and
// a floating cart that survives a reload (localStorage, per business).
export function RestaurantMenuOrdering({
  business,
  items,
  currency,
  usdToLrdRate,
}: {
  business: Business;
  items: MenuItem[];
  currency: MenuCurrency;
  usdToLrdRate: number | null;
}) {
  const { user, token } = useAuth();
  const kinds = useMemo(() => menuKindsInOrder(items, business.type), [items, business.type]);
  const [activeKind, setActiveKind] = useState<MenuItemKind>(kinds[0] ?? "food");
  const [query, setQuery] = useState("");
  const [openItem, setOpenItem] = useState<MenuItem | null>(null);
  const [cart, setCart] = useState<CartLine[]>([]);
  const [cartLoaded, setCartLoaded] = useState(false);
  const [cartOpen, setCartOpen] = useState(false);
  const [notes, setNotes] = useState("");
  const [ageConfirmed, setAgeConfirmed] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submittedOrder, setSubmittedOrder] = useState<FoodOrder | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setCart(pruneCart(loadCart(business.id), items));
    setCartLoaded(true);
  }, [business.id, items]);

  useEffect(() => {
    if (cartLoaded) saveCart(business.id, cart);
  }, [business.id, cart, cartLoaded]);

  useEffect(() => () => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
  }, []);

  const summary = cartSummary(cart, items);
  const inCartByItem = useMemo(() => {
    const counts = new Map<string, number>();
    for (const line of cart) counts.set(line.menuItemId, (counts.get(line.menuItemId) ?? 0) + line.quantity);
    return counts;
  }, [cart]);

  const trimmedQuery = query.trim().toLowerCase();
  const searchResults = trimmedQuery
    ? items.filter(
        (item) =>
          item.name.toLowerCase().includes(trimmedQuery) ||
          (item.description ?? "").toLowerCase().includes(trimmedQuery) ||
          (item.category ?? "").toLowerCase().includes(trimmedQuery),
      )
    : [];
  const kindItems = items.filter((item) => item.kind === activeKind);
  const sections = groupBySection(kindItems, "More");
  const popular = kindItems.filter((item) => item.tags.includes("popular") && item.isAvailable).slice(0, 8);

  function showToast(message: string) {
    setToast(message);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 2200);
  }

  function handleAdd(item: MenuItem, selections: CartSelection[], quantity: number) {
    setCart((prev) => addToCart(prev, item.id, selections, quantity));
    setOpenItem(null);
    showToast(`Added ${quantity > 1 ? `${quantity} × ` : ""}${item.name}`);
  }

  function quickAdd(item: MenuItem) {
    if (item.optionGroups.length > 0) {
      setOpenItem(item);
      return;
    }
    handleAdd(item, [], 1);
  }

  function selectKind(kind: MenuItemKind) {
    setActiveKind(kind);
    setQuery("");
    contentRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  async function submitOrder() {
    if (!token) return;
    setSubmitting(true);
    setError(null);
    try {
      const order = await createFoodOrder(token, business.id, {
        items: cart.map((line) => ({
          menuItemId: line.menuItemId,
          quantity: line.quantity,
          selections: line.selections.length > 0 ? line.selections : undefined,
        })),
        notes: notes.trim() || undefined,
        ageConfirmed: summary.hasAlcohol ? ageConfirmed : undefined,
      });
      setSubmittedOrder(order);
      setCart([]);
      setNotes("");
      setAgeConfirmed(false);
      setCartOpen(false);
    } catch (err) {
      setError(err instanceof HttpError ? err.message : "Unable to place your order. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  if (submittedOrder) {
    return (
      <main className="mx-auto flex max-w-xl flex-col items-center gap-4 px-4 py-16 text-center sm:py-24">
        <div className="flex h-20 w-20 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 shadow-lg shadow-emerald-500/20 dark:bg-emerald-900/40 dark:text-emerald-300">
          <CheckCircleIcon aria-hidden className="h-11 w-11" />
        </div>
        <h1 className="font-display text-3xl font-bold text-slate-950 dark:text-slate-50">Order sent!</h1>
        <p className="max-w-sm text-sm leading-6 text-slate-600 dark:text-slate-300">
          Your order for <strong>{formatMoney(submittedOrder.totalAmount, submittedOrder.currency)}</strong> is with{" "}
          {business.name}. We&apos;ll notify you the moment they confirm it — you can message them from My Orders in the
          meantime.
        </p>
        <div className="mt-2 flex w-full max-w-xs flex-col gap-2">
          <Link
            href="/account/my-orders"
            className="flex min-h-12 items-center justify-center gap-1.5 rounded-full bg-brand-700 px-5 text-sm font-bold text-white hover:bg-brand-800"
          >
            Track my order <ArrowRightIcon aria-hidden className="h-4 w-4" />
          </Link>
          <button
            type="button"
            onClick={() => setSubmittedOrder(null)}
            className="flex min-h-12 items-center justify-center rounded-full border border-slate-300 px-5 text-sm font-semibold text-slate-700 hover:border-brand-400 dark:border-slate-700 dark:text-slate-200"
          >
            Back to the menu
          </button>
        </div>
      </main>
    );
  }

  const cover = business.images[0] ?? business.linkedPlace.images[0] ?? null;
  const isBar = business.type === "bar";

  return (
    <main className="mx-auto flex w-full max-w-4xl flex-col pb-10">
      <div className="px-4 pt-4 sm:px-6">
        <Link
          href={`/businesses/${business.slug}`}
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-brand-700 hover:underline dark:text-brand-300"
        >
          <ArrowLeftIcon aria-hidden className="h-4 w-4" />
          Back to {business.name}
        </Link>
      </div>

      <header className="relative mx-4 mt-4 h-56 overflow-hidden rounded-[2rem] shadow-xl sm:mx-6 sm:h-72">
        <SafeImage
          src={cover ? resolveImageUrl(cover) : null}
          alt=""
          className="h-full w-full object-cover"
          fallback={
            <div
              aria-hidden
              className={`h-full w-full bg-gradient-to-br ${isBar ? "from-indigo-900 via-purple-900 to-slate-950" : "from-brand-700 via-brand-900 to-brand-950"}`}
            />
          }
        />
        <div aria-hidden className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/25 to-black/10" />
        <div className="absolute inset-x-0 bottom-0 flex flex-col gap-2 p-5 sm:p-7">
          <span className="w-fit rounded-full bg-white/15 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.2em] text-white backdrop-blur">
            {isBar ? "Drinks & bites" : "Menu"}
          </span>
          <h1 className="flex flex-wrap items-center gap-2 font-display text-3xl font-bold leading-tight text-white sm:text-4xl">
            {business.name}
            <VerificationBadge status={business.verificationStatus} compact />
          </h1>
          <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-white/85">
            <span>{formatBusinessType(business.type)}</span>
            <span aria-hidden>·</span>
            <span>{formatRating(business.linkedPlace.rating, business.linkedPlace.reviewCount)}</span>
            <span aria-hidden>·</span>
            <span>
              Prices in {currency === "USD" ? "US$" : "L$"}
              {usdToLrdRate ? ` · ≈ ${currency === "USD" ? "L$" : "US$"} shown at US$1 = L$${usdToLrdRate}` : ""}
            </span>
          </p>
        </div>
      </header>

      <div
        ref={contentRef}
        className="sticky top-[5rem] z-20 mx-4 mt-4 flex scroll-mt-24 flex-col gap-2 rounded-3xl border border-slate-200 bg-white/95 p-2 shadow-sm backdrop-blur dark:border-slate-800 dark:bg-slate-900/95 sm:top-[5.5rem] sm:mx-6"
      >
        <div className="relative">
          <MagnifyingGlassIcon aria-hidden className="pointer-events-none absolute start-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={`Search ${business.name}'s menu`}
            aria-label="Search the menu"
            className="min-h-11 w-full rounded-2xl border-0 bg-slate-100 py-2.5 pe-10 ps-11 text-sm text-slate-900 outline-none focus:ring-2 focus:ring-brand-500 dark:bg-slate-800 dark:text-slate-50"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery("")}
              aria-label="Clear search"
              className="absolute end-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-700"
            >
              <XMarkIcon aria-hidden className="h-4 w-4" />
            </button>
          )}
        </div>

        {!trimmedQuery && kinds.length > 1 && (
          <div role="tablist" aria-label="Menu" className="grid gap-1" style={{ gridTemplateColumns: `repeat(${kinds.length}, minmax(0, 1fr))` }}>
            {kinds.map((kind) => {
              const selected = kind === activeKind;
              return (
                <button
                  key={kind}
                  type="button"
                  role="tab"
                  aria-selected={selected}
                  onClick={() => selectKind(kind)}
                  className={`flex min-h-11 items-center justify-center gap-1.5 rounded-2xl px-3 text-sm font-bold transition ${
                    selected
                      ? "bg-brand-700 text-white shadow-md shadow-brand-700/25"
                      : "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
                  }`}
                >
                  <span aria-hidden>{MENU_KIND_EMOJI[kind]}</span>
                  {MENU_KIND_LABELS[kind]}
                </button>
              );
            })}
          </div>
        )}

        {!trimmedQuery && sections.length > 1 && (
          <nav aria-label="Menu sections" className="-mx-2 overflow-x-auto px-2">
            <div className="flex min-w-max gap-1.5 pb-0.5">
              {sections.map((group) => (
                <a
                  key={group.section}
                  href={`#${sectionAnchor(activeKind, group.section)}`}
                  className="inline-flex min-h-9 items-center rounded-full border border-slate-200 px-3.5 text-xs font-semibold text-slate-600 hover:border-brand-300 hover:text-brand-700 dark:border-slate-700 dark:text-slate-300 dark:hover:text-brand-300"
                >
                  {group.section}
                </a>
              ))}
            </div>
          </nav>
        )}
      </div>

      <div className="flex flex-col gap-8 px-4 pt-6 sm:px-6">
        {trimmedQuery ? (
          <section aria-live="polite" className="flex flex-col gap-3">
            <h2 className="font-display text-lg font-bold text-slate-950 dark:text-slate-50">
              {searchResults.length} result{searchResults.length === 1 ? "" : "s"} for “{query.trim()}”
            </h2>
            {searchResults.length === 0 ? (
              <p className="rounded-3xl bg-slate-50 p-8 text-center text-sm text-slate-500 dark:bg-slate-900 dark:text-slate-400">
                Nothing on the menu matches that. Try another word.
              </p>
            ) : (
              <div className="grid gap-3 md:grid-cols-2">
                {searchResults.map((item) => (
                  <MenuItemCard
                    key={item.id}
                    item={item}
                    currency={currency}
                    rate={usdToLrdRate}
                    inCart={inCartByItem.get(item.id) ?? 0}
                    onOpen={() => setOpenItem(item)}
                    onQuickAdd={() => quickAdd(item)}
                  />
                ))}
              </div>
            )}
          </section>
        ) : (
          <>
            <PopularRail items={popular} currency={currency} rate={usdToLrdRate} onOpen={setOpenItem} />
            {sections.map((group) => (
              <section key={group.section} id={sectionAnchor(activeKind, group.section)} className="flex scroll-mt-56 flex-col gap-3">
                <h2 className="flex items-baseline gap-2 font-display text-xl font-bold text-slate-950 dark:text-slate-50">
                  {group.section}
                  <span className="text-sm font-medium text-slate-400">{group.items.length}</span>
                </h2>
                <div className="grid gap-3 md:grid-cols-2">
                  {group.items.map((item) => (
                    <MenuItemCard
                      key={item.id}
                      item={item}
                      currency={currency}
                      rate={usdToLrdRate}
                      inCart={inCartByItem.get(item.id) ?? 0}
                      onOpen={() => setOpenItem(item)}
                      onQuickAdd={() => quickAdd(item)}
                    />
                  ))}
                </div>
              </section>
            ))}
          </>
        )}
      </div>

      {summary.count > 0 && (
        <>
          <div aria-hidden className="h-24" />
          {/* z-[85] and the BottomNav offset match StickyBookingBar — at a
              lower z-index the language switcher and assistant launcher in
              the same strip swallow taps on this bar. */}
          <div className="fixed inset-x-0 bottom-[calc(5rem+env(safe-area-inset-bottom))] z-[85] flex justify-center px-4 lg:bottom-6">
            <button
              type="button"
              onClick={() => {
                setError(null);
                setCartOpen(true);
              }}
              className="flex min-h-14 w-full max-w-md items-center gap-3 rounded-full bg-brand-700 py-2 pe-5 ps-2 text-white shadow-2xl shadow-brand-900/40 transition hover:bg-brand-800 active:scale-[0.99]"
            >
              <span className="relative flex h-10 w-10 items-center justify-center rounded-full bg-white/15">
                <ShoppingBagIcon aria-hidden className="h-5 w-5" />
                <span className="absolute -end-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-gold-400 px-1 text-[11px] font-black text-slate-950">
                  {summary.count}
                </span>
              </span>
              <span className="flex-1 text-start text-sm font-bold">View order</span>
              <span className="text-sm font-bold">{formatMoney(summary.subtotal, currency)}</span>
            </button>
          </div>
        </>
      )}

      <div aria-live="polite" className="pointer-events-none fixed inset-x-0 top-24 z-[90] flex justify-center px-4">
        {toast && (
          <span className="flex items-center gap-2 rounded-full bg-slate-950/90 px-4 py-2.5 text-sm font-semibold text-white shadow-xl animate-[menu-sheet-up_200ms_ease-out] motion-reduce:animate-none dark:bg-white/95 dark:text-slate-950">
            <CheckCircleIcon aria-hidden className="h-5 w-5 text-emerald-400 dark:text-emerald-600" />
            {toast}
          </span>
        )}
      </div>

      <MenuItemSheet item={openItem} currency={currency} rate={usdToLrdRate} onClose={() => setOpenItem(null)} onAdd={handleAdd} />

      <CartSheet
        open={cartOpen}
        onClose={() => setCartOpen(false)}
        businessName={business.name}
        lines={cart}
        items={items}
        currency={currency}
        rate={usdToLrdRate}
        signedIn={Boolean(user)}
        loginHref={`/login?next=${encodeURIComponent(`/businesses/${business.slug}/menu`)}`}
        notes={notes}
        onNotesChange={setNotes}
        ageConfirmed={ageConfirmed}
        onAgeConfirmedChange={setAgeConfirmed}
        onQuantityChange={(key, quantity) => setCart((prev) => setLineQuantity(prev, key, quantity))}
        onSubmit={submitOrder}
        submitting={submitting}
        error={error}
      />
    </main>
  );
}
