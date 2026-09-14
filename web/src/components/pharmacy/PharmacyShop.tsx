"use client";
import Link from "next/link";
import { useMemo, useRef, useState } from "react";
import { SafeImage } from "@/components/SafeImage";
import { SuccessCheck } from "@/components/SuccessCheck";
import { resolveImageUrl, resolveThumbUrl } from "@/lib/images";
import type { Pharmacy, PharmacyProduct } from "@/lib/pharmacy-api";
import {
  createPharmacyOrder,
  deleteUnattachedPrescription,
  uploadPrescription,
} from "@/lib/pharmacy-api";

// A product with no photo on file — most customers recognize a medication
// by its box/blister pack on sight, so the shop leans on this rather than a
// generic "no image" icon wherever one is missing.
function ProductImagePlaceholder({ className }: { className: string }) {
  return (
    <div
      aria-hidden
      className={`flex items-center justify-center rounded-xl bg-gradient-to-br from-emerald-50 to-brand-50 text-3xl dark:from-emerald-950/40 dark:to-brand-950/40 ${className}`}
    >
      💊
    </div>
  );
}
function ProductThumbnail({
  product,
  className,
}: {
  product: Pick<PharmacyProduct, "imageUrl">;
  className: string;
}) {
  return product.imageUrl ? (
    <SafeImage
      src={resolveImageUrl(product.imageUrl)}
      thumbSrc={resolveThumbUrl(product.imageUrl)}
      alt=""
      className={`object-cover ${className}`}
      fallback={<ProductImagePlaceholder className={className} />}
    />
  ) : (
    <ProductImagePlaceholder className={className} />
  );
}

// Matches CartItemDto's @Max(100) on the API — without this cap, a product
// with more than 100 units in stock let this button stay enabled past
// quantity 100, building a cart line the server was always going to reject
// at checkout.
const MAX_CART_QUANTITY_PER_ITEM = 100;

// Pickup-first only when both are actually offered — a delivery-only
// pharmacy (pickupEnabled=false) previously still opened on "pickup", so
// its own delivery radio sat unchecked and checkout rejected the
// unselected default until the customer noticed and switched it by hand.
// PharmacyProfileDto permits neither flag being set; the result there
// doesn't matter because hasFulfillmentMethod() below disables ordering
// entirely in that case rather than letting a phantom method through.
function defaultFulfillmentMethod(pharmacy: Pick<Pharmacy, "pickupEnabled" | "deliveryEnabled">) {
  return pharmacy.pickupEnabled ? "pickup" : "delivery";
}

export function PharmacyShop({
  pharmacy,
  products,
  categories,
}: {
  pharmacy: Pharmacy;
  products: PharmacyProduct[];
  categories: Array<{ id: string; name: string }>;
}) {
  const [search, setSearch] = useState(""),
    [category, setCategory] = useState(""),
    [cart, setCart] = useState<Record<string, number>>({}),
    [method, setMethod] = useState(() => defaultFulfillmentMethod(pharmacy)),
    [address, setAddress] = useState(""),
    [prescriptionFile, setPrescriptionFile] = useState<File | null>(null),
    [consent, setConsent] = useState(false),
    [placing, setPlacing] = useState(false),
    [notice, setNotice] = useState(""),
    [orderPlaced, setOrderPlaced] = useState(false);
  // Caches the id from a successful uploadPrescription() call, keyed by
  // the exact File it was uploaded for — checkout() reuses it on a retry
  // (e.g. after the order itself is rejected for stock/pharmacy-status
  // reasons unrelated to the prescription) instead of uploading another
  // copy every attempt. Each copy is a private object plus a database row
  // that stays orphaned until an order attaches it — an unlucky sequence
  // of retries, or simply picking a different file after a successful
  // upload, would otherwise leave one behind for good. See
  // handlePrescriptionFileChange(), which deletes the cached upload (via
  // deleteUnattachedPrescription()) whenever the selected file changes,
  // since the cached id no longer matches what's selected at that point.
  const uploadedPrescriptionRef = useRef<{ file: File; id: string } | null>(
    null,
  );
  const shown = products.filter(
    (p) =>
      (!category || p.categoryId === category) &&
      p.name.toLowerCase().includes(search.toLowerCase()),
  );
  // Whether the cart holds anything is a question about quantities, not
  // money — ProductDto allows a zero price (@Min(0)), so a cart of only
  // free items would have a $0 subtotal and read as "empty" if that were
  // used as the signal, even though checkout has real items to submit.
  const cartIsEmpty = Object.values(cart).every((q) => !q);
  // ProductDto/PharmacyProfileDto permit a pharmacy with neither flag set —
  // the API always rejects an order whose fulfillmentMethod isn't actually
  // enabled, so ordering must be disabled up front rather than defaulting
  // "method" to a value that's guaranteed to fail at checkout.
  const hasFulfillmentMethod = pharmacy.pickupEnabled || pharmacy.deliveryEnabled;
  const subtotal = useMemo(
      () =>
        products.reduce((s, p) => s + Number(p.price) * (cart[p.id] || 0), 0),
      [cart, products],
    ),
    delivery = method === "delivery" ? Number(pharmacy.deliveryFee) : 0,
    total = subtotal + delivery,
    needsPrescription = products.some(
      (p) => cart[p.id] && p.prescriptionRequired,
    );
  async function checkout() {
    if (!hasFulfillmentMethod) {
      setNotice("This pharmacy isn't currently accepting orders.");
      return;
    }
    if (needsPrescription && (!prescriptionFile || !consent)) {
      setNotice(
        "Prescription items require a secure prescription upload and your consent before they can be submitted.",
      );
      return;
    }
    setPlacing(true);
    setNotice("Placing order…");
    setOrderPlaced(false);
    try {
      // Reuse a prescription already uploaded for this exact file (e.g. a
      // retry after createPharmacyOrder() below rejected for stock or
      // pharmacy-status reasons unrelated to the prescription itself)
      // instead of uploading another copy — see uploadedPrescriptionRef's
      // doc comment. A prescription still attaches to at most one order
      // (PharmaciesService.createOrder), so reusing the id here is safe:
      // nothing else could have consumed it between attempts.
      const cached = uploadedPrescriptionRef.current;
      // The cart can lose its only prescription-required item (e.g. the
      // customer removes it but keeps other products) after an earlier
      // checkout attempt already uploaded and cached one — without this,
      // that cached upload is simply abandoned here (never attached to an
      // order, never deleted), permanently orphaning the sensitive row and
      // its storage object. Clean it up before dropping the reference.
      if (!needsPrescription && cached) {
        uploadedPrescriptionRef.current = null;
        deleteUnattachedPrescription(cached.id).catch(() => {});
      }
      const prescriptionId = !needsPrescription
        ? undefined
        : cached && cached.file === prescriptionFile
          ? cached.id
          : await uploadPrescription(pharmacy.id, prescriptionFile!).then(
              (id) => {
                uploadedPrescriptionRef.current = {
                  file: prescriptionFile!,
                  id,
                };
                return id;
              },
            );
      await createPharmacyOrder({
        pharmacyId: pharmacy.id,
        fulfillmentMethod: method,
        deliveryAddress: method === "delivery" ? address : undefined,
        items: Object.entries(cart)
          .filter(([, q]) => q)
          .map(([productId, quantity]) => ({ productId, quantity })),
        prescriptionId,
        consentToPrescriptionProcessing: needsPrescription ? consent : undefined,
      });
      uploadedPrescriptionRef.current = null;
      setCart({});
      setPrescriptionFile(null);
      setConsent(false);
      setNotice(
        needsPrescription
          ? "Order submitted for pharmacist review. Uploading a prescription does not guarantee approval."
          : "Order placed successfully.",
      );
      setOrderPlaced(true);
    } catch (e) {
      setNotice(e instanceof Error ? e.message : "Could not place the order.");
    } finally {
      setPlacing(false);
    }
  }
  // Selecting a different file (or clearing the input) orphans whatever
  // the ref was still caching — that upload's id no longer matches what's
  // selected, so checkout() would upload a fresh copy and never revisit
  // the old one. Delete it best-effort (it's housekeeping, not something
  // worth blocking file selection on) before dropping the reference.
  function handlePrescriptionFileChange(file: File | null) {
    const cached = uploadedPrescriptionRef.current;
    if (cached && cached.file !== file) {
      uploadedPrescriptionRef.current = null;
      deleteUnattachedPrescription(cached.id).catch(() => {});
    }
    setPrescriptionFile(file);
  }
  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_22rem]">
      <section>
        <div className="mb-4 grid gap-3 sm:grid-cols-2">
          <label>
            Search products
            <input
              className="input mt-1 w-full"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </label>
          <label>
            Category
            <select
              className="input mt-1 w-full"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
            >
              <option value="">All categories</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
        </div>
        {!shown.length ? (
          <p className="empty-state">No available products match.</p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {shown.map((p) => (
              <article
                key={p.id}
                className="flex gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:shadow-md dark:border-slate-800 dark:bg-slate-900"
              >
                <ProductThumbnail product={p} className="h-20 w-20 shrink-0 rounded-xl" />
                <div className="min-w-0 flex-1">
                  <h3 className="font-bold text-slate-900 dark:text-slate-50">{p.name}</h3>
                  <p className="text-sm text-slate-600 dark:text-slate-400">
                    L${Number(p.price).toFixed(2)} ·{" "}
                    {p.inventory?.quantity
                      ? `${p.inventory.quantity} available`
                      : "Out of stock"}
                  </p>
                  {p.prescriptionRequired && (
                    <p className="mt-2 text-xs font-semibold text-amber-700 dark:text-amber-400">
                      Prescription required · pharmacist review only
                    </p>
                  )}
                <button
                  disabled={
                    !p.inventory?.quantity ||
                    (cart[p.id] || 0) >=
                      Math.min(p.inventory.quantity, MAX_CART_QUANTITY_PER_ITEM)
                  }
                  onClick={() =>
                    setCart((x) => {
                      const next = (x[p.id] || 0) + 1;
                      // The server enforces this same cap at checkout —
                      // stopping here just avoids building a cart that's
                      // guaranteed to fail there.
                      const max = Math.min(
                        p.inventory?.quantity ?? 0,
                        MAX_CART_QUANTITY_PER_ITEM,
                      );
                      if (next > max) return x;
                      return { ...x, [p.id]: next };
                    })
                  }
                    className="btn-secondary mt-3 min-h-11 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Add to cart
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
      <aside className="h-fit rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <h2 className="flex items-center gap-2 text-xl font-bold text-slate-900 dark:text-slate-50">
          🛒 Your cart
        </h2>
        {cartIsEmpty ? (
          <p className="my-4 text-sm text-slate-500">Your cart is empty.</p>
        ) : (
          <ul className="my-4 space-y-3 text-sm">
            {products
              .filter((p) => cart[p.id])
              .map((p) => (
                <li key={p.id} className="flex items-center gap-3">
                  <ProductThumbnail product={p} className="h-12 w-12 shrink-0 rounded-lg" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium text-slate-800 dark:text-slate-200">
                      {p.name}
                    </p>
                    <div className="mt-1 flex items-center gap-2">
                      <button
                        type="button"
                        aria-label={`Remove one ${p.name}`}
                        onClick={() =>
                          setCart((x) => {
                            const next = { ...x };
                            if (next[p.id] <= 1) delete next[p.id];
                            else next[p.id] -= 1;
                            return next;
                          })
                        }
                        className="flex h-7 w-7 items-center justify-center rounded-full border border-slate-300 text-base leading-none dark:border-slate-700"
                      >
                        −
                      </button>
                      <span className="w-5 text-center">{cart[p.id]}</span>
                      <button
                        type="button"
                        aria-label={`Add one more ${p.name}`}
                        disabled={
                          !p.inventory?.quantity ||
                          cart[p.id] >=
                            Math.min(p.inventory.quantity, MAX_CART_QUANTITY_PER_ITEM)
                        }
                        onClick={() =>
                          setCart((x) => {
                            const next = (x[p.id] || 0) + 1;
                            const max = Math.min(
                              p.inventory?.quantity ?? 0,
                              MAX_CART_QUANTITY_PER_ITEM,
                            );
                            if (next > max) return x;
                            return { ...x, [p.id]: next };
                          })
                        }
                        className="flex h-7 w-7 items-center justify-center rounded-full border border-slate-300 text-base leading-none disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-700"
                      >
                        +
                      </button>
                    </div>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    <span className="font-semibold text-slate-900 dark:text-slate-50">
                      L${(Number(p.price) * cart[p.id]).toFixed(2)}
                    </span>
                    <button
                      type="button"
                      aria-label={`Remove all ${p.name} from cart`}
                      onClick={() =>
                        setCart((x) => {
                          const next = { ...x };
                          delete next[p.id];
                          return next;
                        })
                      }
                      className="text-xs text-slate-500 underline"
                    >
                      Remove
                    </button>
                  </div>
                </li>
              ))}
          </ul>
        )}
        {hasFulfillmentMethod ? (
          <fieldset className="border-t border-slate-100 pt-4 dark:border-slate-800">
            <legend className="mb-2 text-sm font-semibold text-slate-700 dark:text-slate-200">
              Fulfillment
            </legend>
            <div className="flex gap-2">
              {pharmacy.pickupEnabled && (
                <label
                  className={`flex flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-xl border px-3 py-2 text-sm font-medium transition ${
                    method === "pickup"
                      ? "border-brand-600 bg-brand-50 text-brand-800 dark:border-brand-400 dark:bg-brand-950/40 dark:text-brand-200"
                      : "border-slate-200 text-slate-600 dark:border-slate-700 dark:text-slate-300"
                  }`}
                >
                  <input
                    type="radio"
                    className="sr-only"
                    checked={method === "pickup"}
                    onChange={() => setMethod("pickup")}
                  />
                  🏬 Pickup
                </label>
              )}
              {pharmacy.deliveryEnabled && (
                <label
                  className={`flex flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-xl border px-3 py-2 text-sm font-medium transition ${
                    method === "delivery"
                      ? "border-brand-600 bg-brand-50 text-brand-800 dark:border-brand-400 dark:bg-brand-950/40 dark:text-brand-200"
                      : "border-slate-200 text-slate-600 dark:border-slate-700 dark:text-slate-300"
                  }`}
                >
                  <input
                    type="radio"
                    className="sr-only"
                    checked={method === "delivery"}
                    onChange={() => setMethod("delivery")}
                  />
                  🚴 Delivery
                </label>
              )}
            </div>
          </fieldset>
        ) : (
          <p className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-300">
            This pharmacy isn&apos;t currently accepting orders (no pickup or delivery is enabled).
          </p>
        )}
        {method === "delivery" && (
          <label className="mt-3 block">
            Delivery address
            <textarea
              required
              className="input mt-1 w-full"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
            />
          </label>
        )}
        {needsPrescription && (
          <div className="mt-3 space-y-2 rounded-xl border border-amber-300 bg-amber-50 p-3 dark:border-amber-800 dark:bg-amber-950/30">
            <p className="text-xs font-semibold text-amber-800 dark:text-amber-300">
              This cart includes a prescription item — upload your
              prescription for the pharmacist to review before this order can
              be submitted.
            </p>
            <label className="block text-sm">
              Prescription photo or PDF
              <input
                type="file"
                required
                accept="image/jpeg,image/png,image/webp,application/pdf"
                className="input mt-1 w-full"
                onChange={(e) =>
                  handlePrescriptionFileChange(e.target.files?.[0] ?? null)
                }
              />
            </label>
            <label className="flex items-start gap-2 text-xs">
              <input
                type="checkbox"
                className="mt-0.5"
                checked={consent}
                onChange={(e) => setConsent(e.target.checked)}
              />
              I consent to sharing this prescription with the pharmacy for
              review. Uploading it does not guarantee approval.
            </label>
          </div>
        )}
        <dl className="my-4 space-y-1.5 rounded-xl bg-slate-50 p-3 text-sm dark:bg-slate-800/50">
          <div className="flex justify-between text-slate-600 dark:text-slate-300">
            <dt>Product subtotal</dt>
            <dd>L${subtotal.toFixed(2)}</dd>
          </div>
          <div className="flex justify-between text-slate-600 dark:text-slate-300">
            <dt>Delivery fee</dt>
            <dd>L${delivery.toFixed(2)}</dd>
          </div>
          <div className="flex justify-between text-slate-600 dark:text-slate-300">
            <dt>Platform fee</dt>
            <dd>L$0.00</dd>
          </div>
          <div className="flex justify-between border-t border-slate-200 pt-2 text-base font-bold text-slate-900 dark:border-slate-700 dark:text-slate-50">
            <dt>Final total</dt>
            <dd>L${total.toFixed(2)}</dd>
          </div>
        </dl>
        <button
          disabled={
            !hasFulfillmentMethod ||
            cartIsEmpty ||
            placing ||
            (method === "delivery" && !address) ||
            (needsPrescription && (!prescriptionFile || !consent))
          }
          onClick={checkout}
          className="btn-primary min-h-12 w-full text-base shadow-sm disabled:cursor-not-allowed disabled:opacity-50"
        >
          {placing ? "Placing order…" : `Place order · L$${total.toFixed(2)}`}
        </button>
        {notice && (
          <div
            role="status"
            className={`mt-3 flex items-start gap-3 rounded-xl border p-3 text-sm ${
              placing
                ? "border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-800 dark:bg-slate-800/50 dark:text-slate-300"
                : orderPlaced
                  ? "border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-300"
                  : "border-red-300 bg-red-50 text-red-800 dark:border-red-800 dark:bg-red-950/30 dark:text-red-300"
            }`}
          >
            {/* The one moment on this whole page worth a beat of its own —
                everything up to here has been filling a cart; this is the
                payoff. See SuccessCheck's own doc comment for why it's a
                one-shot checkmark draw rather than anything busier. */}
            {orderPlaced && (
              <SuccessCheck className="mt-0.5 h-6 w-6 shrink-0 text-emerald-600 dark:text-emerald-400" />
            )}
            <p>
              {notice}
              {orderPlaced && (
                <>
                  {" "}
                  <Link
                    href="/account/my-orders"
                    className="font-semibold underline"
                  >
                    Track your order →
                  </Link>
                </>
              )}
            </p>
          </div>
        )}
        <p className="mt-4 text-xs text-slate-500">
          Payment provider checkout will be enabled later. Raw card details are
          never collected here.
        </p>
      </aside>
    </div>
  );
}
