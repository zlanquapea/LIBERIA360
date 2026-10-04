'use client';

import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  BanknotesIcon,
  CheckBadgeIcon,
  CheckCircleIcon,
  MagnifyingGlassIcon,
  MapPinIcon,
  PhoneIcon,
  ShieldCheckIcon,
  ShoppingBagIcon,
  TruckIcon,
} from '@heroicons/react/24/outline';
import { useAuth } from '@/hooks/useAuth';
import { resolveImageUrl } from '@/lib/images';
import { SafeImage } from '@/components/SafeImage';
import { HoursStatus } from '@/components/place/HoursStatus';
import type { Pharmacy, PharmacyOrder, PharmacyProduct } from '@/lib/pharmacy-api';
import {
  MAX_PER_PRODUCT,
  PAYMENT_LABELS,
  acceptedPaymentMethods,
  cartTotals,
  loadCart,
  money,
  pharmacyOpeningPeriods,
  saveCart,
  stockOf,
  type PharmacyCart,
} from '@/lib/pharmacy-ordering';
import { PharmacyProductCard } from './PharmacyProductCard';
import { PharmacyCheckoutSheet } from './PharmacyCheckoutSheet';

const chip =
  'inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200';

/**
 * A pharmacy's shop, built like the restaurant menu: who they are and
 * whether they're open, how you can get your medicines and pay, then the
 * shelf by category with a "+" on every pack and a cart bar that follows
 * you down the page. The cart is kept per pharmacy on this device, so a
 * reload — or "Order again" from a past order — picks up where you were.
 */
export function PharmacyStorefront({
  pharmacy,
  products,
  categories,
}: {
  pharmacy: Pharmacy;
  products: PharmacyProduct[];
  categories: Array<{ id: string; name: string }>;
}) {
  const { user } = useAuth();
  const [cart, setCart] = useState<PharmacyCart>({});
  const [loaded, setLoaded] = useState(false);
  const [query, setQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [placed, setPlaced] = useState<PharmacyOrder | null>(null);
  const sectionRefs = useRef<Record<string, HTMLElement | null>>({});

  // Restore the saved cart, keeping only what this shop still sells and has.
  useEffect(() => {
    const saved = loadCart(pharmacy.id);
    const byId = new Map(products.map((p) => [p.id, p]));
    const valid: PharmacyCart = {};
    for (const [id, q] of Object.entries(saved)) {
      const p = byId.get(id);
      if (!p) continue;
      const capped = Math.min(q, stockOf(p), MAX_PER_PRODUCT);
      if (capped > 0) valid[id] = capped;
    }
    setCart(valid);
    setLoaded(true);
  }, [pharmacy.id, products]);

  useEffect(() => {
    if (loaded) saveCart(pharmacy.id, cart);
  }, [cart, loaded, pharmacy.id]);

  const methods = acceptedPaymentMethods(pharmacy);
  const hours = pharmacyOpeningPeriods(pharmacy.openingHours);
  const totals = cartTotals(cart, products, 'pickup', 0);
  const verified = pharmacy.status === 'approved';

  const sections = useMemo(() => {
    const q = query.trim().toLowerCase();
    const shown = products.filter((p) => !q || p.name.toLowerCase().includes(q));
    const names = new Map(categories.map((c) => [c.id, c.name]));
    const groups = new Map<string, PharmacyProduct[]>();
    for (const p of shown) {
      const list = groups.get(p.categoryId) ?? [];
      list.push(p);
      groups.set(p.categoryId, list);
    }
    return [...groups.entries()]
      .map(([id, items]) => ({
        id,
        name: names.get(id) ?? items[0]?.category?.name ?? 'Other',
        // In stock first, then by name.
        items: items.sort((a, b) => Number(stockOf(b) > 0) - Number(stockOf(a) > 0) || a.name.localeCompare(b.name)),
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [products, categories, query]);

  function setQuantity(productId: string, quantity: number) {
    setCart((prev) => {
      const next = { ...prev };
      if (quantity <= 0) delete next[productId];
      else next[productId] = quantity;
      return next;
    });
  }

  function jumpTo(id: string) {
    setActiveCategory(id);
    sectionRefs.current[id]?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  return (
    <div className="flex flex-col gap-6">
      {/* ── Hero ─────────────────────────────────────────────────── */}
      <header className="relative isolate overflow-hidden rounded-[2rem] bg-gradient-to-br from-emerald-800 via-emerald-900 to-slate-950 p-5 text-white shadow-card sm:p-8">
        {pharmacy.coverUrl && (
          <SafeImage src={resolveImageUrl(pharmacy.coverUrl)} alt="" className="absolute inset-0 -z-10 h-full w-full object-cover opacity-30" fallback={null} />
        )}
        <span aria-hidden className="absolute -end-10 -top-10 -z-10 text-[12rem] leading-none opacity-[0.07]">✚</span>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="flex min-w-0 items-start gap-4">
            <span className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-white text-3xl shadow-lg">
              {pharmacy.logoUrl ? (
                <SafeImage src={resolveImageUrl(pharmacy.logoUrl)} alt="" className="h-full w-full object-cover" fallback={<span aria-hidden>💊</span>} />
              ) : (
                <span aria-hidden>💊</span>
              )}
            </span>
            <div className="min-w-0">
              {verified && (
                <p className="mb-1 inline-flex items-center gap-1 rounded-full bg-white/15 px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.16em] ring-1 ring-inset ring-white/25">
                  <CheckBadgeIcon aria-hidden className="h-4 w-4 text-emerald-300" />
                  Licensed &amp; verified
                </p>
              )}
              <h1 className="font-display text-3xl font-extrabold leading-tight tracking-tight [overflow-wrap:anywhere] sm:text-4xl">{pharmacy.name}</h1>
              <p className="mt-1 flex items-start gap-1 text-sm text-white/75">
                <MapPinIcon aria-hidden className="mt-0.5 h-4 w-4 shrink-0" />
                {pharmacy.address}, {pharmacy.location}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {hours && <HoursStatus hours={hours} />}
            <a href={`tel:${pharmacy.telephone.replace(/[^\d+]/g, '')}`} className="inline-flex min-h-10 items-center gap-2 rounded-full bg-white px-4 text-sm font-bold text-emerald-900 hover:bg-emerald-50">
              <PhoneIcon aria-hidden className="h-4 w-4" />
              Call
            </a>
          </div>
        </div>
      </header>

      {/* ── How it works here ────────────────────────────────────── */}
      <div className="flex flex-wrap gap-2">
        {pharmacy.deliveryEnabled && (
          <span className={chip}>
            <TruckIcon aria-hidden className="h-4 w-4 text-emerald-700" />
            Delivery {Number(pharmacy.deliveryFee) > 0 ? money(pharmacy.deliveryFee) : 'free'}
          </span>
        )}
        {pharmacy.pickupEnabled && (
          <span className={chip}>
            <ShoppingBagIcon aria-hidden className="h-4 w-4 text-emerald-700" />
            Pickup
          </span>
        )}
        {methods.map((m) => (
          <span key={m} className={chip}>
            {m === 'cash' ? (
              <BanknotesIcon aria-hidden className="h-4 w-4 text-emerald-700" />
            ) : (
              <span aria-hidden className={`h-2.5 w-2.5 rounded-full ${m === 'mtn_momo' ? 'bg-yellow-400' : 'bg-orange-500'}`} />
            )}
            {PAYMENT_LABELS[m]}
          </span>
        ))}
        <span className={chip}>
          <ShieldCheckIcon aria-hidden className="h-4 w-4 text-emerald-700" />
          Pharmacist checks every prescription
        </span>
      </div>

      {placed && (
        <div role="status" className="flex flex-col gap-3 rounded-3xl border border-emerald-200 bg-emerald-50 p-5 dark:border-emerald-900 dark:bg-emerald-950/40 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <CheckCircleIcon aria-hidden className="h-8 w-8 shrink-0 text-emerald-600" />
            <div>
              <p className="font-display text-lg font-bold text-emerald-950 dark:text-emerald-100">Order sent to {pharmacy.name}</p>
              <p className="text-sm text-emerald-900/80 dark:text-emerald-200/80">
                {placed.status === 'under_review'
                  ? 'A pharmacist is checking your prescription. We’ll notify you when it’s approved.'
                  : placed.paymentStatus === 'awaiting_verification'
                    ? 'The pharmacy is checking your payment, then they’ll prepare your order.'
                    : 'You’ll get a notification as your order moves along.'}
              </p>
            </div>
          </div>
          <Link href="/account/my-orders" className="inline-flex min-h-11 shrink-0 items-center justify-center rounded-full bg-emerald-700 px-5 text-sm font-bold text-white hover:bg-emerald-800">
            Track order
          </Link>
        </div>
      )}

      {/* ── Search + categories ──────────────────────────────────── */}
      <div className="sticky top-[4.5rem] z-10 -mx-4 flex flex-col gap-2 border-b border-slate-200/70 bg-[var(--surface-canvas)] px-4 py-3 backdrop-blur-md dark:border-slate-800 sm:mx-0 sm:rounded-3xl sm:border sm:px-3">
        <label className="relative">
          <span className="sr-only">Search medicines</span>
          <MagnifyingGlassIcon aria-hidden className="pointer-events-none absolute start-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={`Search ${pharmacy.name}`}
            className="h-12 w-full rounded-full border border-slate-200 bg-white pe-4 ps-11 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 dark:border-slate-700 dark:bg-slate-900"
          />
        </label>
        {sections.length > 1 && (
          <nav aria-label="Categories" className="flex gap-2 overflow-x-auto [scrollbar-width:none]">
            {sections.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => jumpTo(s.id)}
                className={`shrink-0 rounded-full px-4 py-2 text-sm font-semibold transition ${
                  activeCategory === s.id
                    ? 'bg-emerald-700 text-white'
                    : 'bg-white text-slate-700 hover:bg-emerald-50 dark:bg-slate-900 dark:text-slate-200'
                }`}
              >
                {s.name}
              </button>
            ))}
          </nav>
        )}
      </div>

      {/* ── Shelf ────────────────────────────────────────────────── */}
      {sections.length === 0 ? (
        <p className="rounded-3xl border border-dashed border-slate-300 p-8 text-center text-slate-500 dark:border-slate-700">
          {query ? `Nothing matches “${query}”. Try another name, or call the pharmacy.` : 'This pharmacy hasn’t listed any medicines yet.'}
        </p>
      ) : (
        sections.map((s) => (
          <section
            key={s.id}
            ref={(el) => {
              sectionRefs.current[s.id] = el;
            }}
            aria-labelledby={`cat-${s.id}`}
            className="scroll-mt-48"
          >
            <h2 id={`cat-${s.id}`} className="mb-3 flex items-baseline gap-2 font-display text-xl font-bold text-slate-950 dark:text-slate-50">
              {s.name}
              <span className="text-sm font-semibold text-slate-400">{s.items.length}</span>
            </h2>
            <div className="grid gap-4 md:grid-cols-2">
              {s.items.map((p) => (
                <PharmacyProductCard key={p.id} product={p} quantity={cart[p.id] ?? 0} onChange={(q) => setQuantity(p.id, Math.min(q, stockOf(p), MAX_PER_PRODUCT))} />
              ))}
            </div>
          </section>
        ))
      )}

      <aside className="rounded-3xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-950 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-100">
        Prescriptions are approved only by this pharmacy&apos;s licensed pharmacist, under Liberian law. LIBERIA360 doesn&apos;t diagnose, advise on doses or swap medicines. In an emergency, go to the nearest hospital.
      </aside>

      {totals.count > 0 && (
        <>
          <div aria-hidden className="h-24" />
          <div className="fixed inset-x-0 bottom-[calc(5rem+env(safe-area-inset-bottom))] z-[85] flex justify-center px-4 lg:bottom-6">
            <button
              type="button"
              onClick={() => setSheetOpen(true)}
              className="flex min-h-14 w-full max-w-md items-center gap-3 rounded-full bg-emerald-700 py-2 pe-5 ps-2 text-white shadow-2xl shadow-emerald-900/40 transition hover:bg-emerald-800 active:scale-[0.99]"
            >
              <span className="relative flex h-10 w-10 items-center justify-center rounded-full bg-white/15">
                <ShoppingBagIcon aria-hidden className="h-5 w-5" />
                <span className="absolute -end-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-gold-400 px-1 text-[11px] font-black text-slate-950">
                  {totals.count}
                </span>
              </span>
              <span className="flex-1 text-start text-sm font-bold">View cart</span>
              <span className="text-sm font-bold">{money(totals.subtotal)}</span>
            </button>
          </div>
        </>
      )}

      <PharmacyCheckoutSheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        pharmacy={pharmacy}
        products={products}
        cart={cart}
        onQuantityChange={setQuantity}
        signedIn={Boolean(user)}
        loginHref={`/login?next=${encodeURIComponent(`/pharmacies/${pharmacy.slug}`)}`}
        onPlaced={(order) => {
          setCart({});
          setSheetOpen(false);
          setPlaced(order);
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }}
      />
    </div>
  );
}
