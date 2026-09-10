"use client";
import { useMemo, useState } from "react";
import type { Pharmacy, PharmacyProduct } from "@/lib/pharmacy-api";
import { createPharmacyOrder, uploadPrescription } from "@/lib/pharmacy-api";

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
    [notice, setNotice] = useState("");
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
    try {
      // Uploaded fresh for this order, right before checkout — the
      // pharmacist reviews it against this specific order once it exists,
      // and a prescription attaches to at most one order (see
      // PharmaciesService.createOrder), so a leftover upload from an
      // earlier abandoned attempt is never silently reused here.
      const prescriptionId = needsPrescription
        ? await uploadPrescription(pharmacy.id, prescriptionFile!)
        : undefined;
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
      setCart({});
      setPrescriptionFile(null);
      setConsent(false);
      setNotice(
        needsPrescription
          ? "Order submitted for pharmacist review. Uploading a prescription does not guarantee approval."
          : "Order placed successfully.",
      );
    } catch (e) {
      setNotice(e instanceof Error ? e.message : "Could not place the order.");
    } finally {
      setPlacing(false);
    }
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
                className="rounded-2xl border bg-white p-4 dark:bg-slate-900"
              >
                <h3 className="font-bold">{p.name}</h3>
                <p className="text-sm">
                  L${Number(p.price).toFixed(2)} ·{" "}
                  {p.inventory?.quantity
                    ? `${p.inventory.quantity} available`
                    : "Out of stock"}
                </p>
                {p.prescriptionRequired && (
                  <p className="mt-2 text-xs font-semibold text-amber-700">
                    Prescription required · pharmacist review only
                  </p>
                )}
                <button
                  disabled={
                    !p.inventory?.quantity ||
                    (cart[p.id] || 0) >= p.inventory.quantity
                  }
                  onClick={() =>
                    setCart((x) => {
                      const next = (x[p.id] || 0) + 1;
                      // The server enforces this same cap at checkout —
                      // stopping here just avoids building a cart that's
                      // guaranteed to fail there.
                      if (next > (p.inventory?.quantity ?? 0)) return x;
                      return { ...x, [p.id]: next };
                    })
                  }
                  className="btn-secondary mt-3 min-h-11 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Add to cart
                </button>
              </article>
            ))}
          </div>
        )}
      </section>
      <aside className="h-fit rounded-2xl border bg-white p-5 dark:bg-slate-900">
        <h2 className="text-xl font-bold">Your cart</h2>
        {cartIsEmpty ? (
          <p className="my-4 text-sm text-slate-500">Your cart is empty.</p>
        ) : (
          <ul className="my-4 space-y-2 text-sm">
            {products
              .filter((p) => cart[p.id])
              .map((p) => (
                <li key={p.id} className="flex justify-between">
                  <span>
                    {p.name} × {cart[p.id]}
                  </span>
                  <span>L${(Number(p.price) * cart[p.id]).toFixed(2)}</span>
                </li>
              ))}
          </ul>
        )}
        {hasFulfillmentMethod ? (
          <fieldset className="space-y-2">
            <legend className="font-semibold">Fulfillment</legend>
            {pharmacy.pickupEnabled && (
              <label className="block">
                <input
                  type="radio"
                  checked={method === "pickup"}
                  onChange={() => setMethod("pickup")}
                />{" "}
                Pickup
              </label>
            )}
            {pharmacy.deliveryEnabled && (
              <label className="block">
                <input
                  type="radio"
                  checked={method === "delivery"}
                  onChange={() => setMethod("delivery")}
                />{" "}
                Delivery
              </label>
            )}
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
                onChange={(e) => setPrescriptionFile(e.target.files?.[0] ?? null)}
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
        <dl className="my-4 space-y-1 text-sm">
          <div className="flex justify-between">
            <dt>Product subtotal</dt>
            <dd>L${subtotal.toFixed(2)}</dd>
          </div>
          <div className="flex justify-between">
            <dt>Delivery fee</dt>
            <dd>L${delivery.toFixed(2)}</dd>
          </div>
          <div className="flex justify-between">
            <dt>Platform fee</dt>
            <dd>L$0.00</dd>
          </div>
          <div className="flex justify-between border-t pt-2 font-bold">
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
          className="btn-primary min-h-12 w-full"
        >
          {placing ? "Placing order…" : "Place order"}
        </button>
        {notice && (
          <p role="status" className="mt-3 text-sm">
            {notice}
          </p>
        )}
        <p className="mt-4 text-xs text-slate-500">
          Payment provider checkout will be enabled later. Raw card details are
          never collected here.
        </p>
      </aside>
    </div>
  );
}
