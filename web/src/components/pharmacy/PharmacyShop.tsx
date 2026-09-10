"use client";
import { useMemo, useState } from "react";
import type { Pharmacy, PharmacyProduct } from "@/lib/pharmacy-api";
import { createPharmacyOrder } from "@/lib/pharmacy-api";
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
    [method, setMethod] = useState("pickup"),
    [address, setAddress] = useState(""),
    [notice, setNotice] = useState("");
  const shown = products.filter(
    (p) =>
      (!category || p.categoryId === category) &&
      p.name.toLowerCase().includes(search.toLowerCase()),
  );
  const subtotal = useMemo(
      () =>
        products.reduce((s, p) => s + Number(p.price) * (cart[p.id] || 0), 0),
      [cart, products],
    ),
    delivery = method === "delivery" ? Number(pharmacy.deliveryFee) : 0,
    total = subtotal + delivery;
  async function checkout() {
    setNotice("Placing order…");
    try {
      const rx = products.some((p) => cart[p.id] && p.prescriptionRequired);
      if (rx) {
        setNotice(
          "Prescription items require a secure prescription upload and pharmacist review. Uploading does not guarantee approval.",
        );
        return;
      }
      await createPharmacyOrder({
        pharmacyId: pharmacy.id,
        fulfillmentMethod: method,
        deliveryAddress: method === "delivery" ? address : undefined,
        items: Object.entries(cart)
          .filter(([, q]) => q)
          .map(([productId, quantity]) => ({ productId, quantity })),
      });
      setCart({});
      setNotice("Order placed successfully.");
    } catch (e) {
      setNotice(e instanceof Error ? e.message : "Could not place the order.");
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
                  disabled={!p.inventory?.quantity}
                  onClick={() =>
                    setCart((x) => ({ ...x, [p.id]: (x[p.id] || 0) + 1 }))
                  }
                  className="btn-secondary mt-3 min-h-11"
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
        {!subtotal ? (
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
          disabled={!subtotal || (method === "delivery" && !address)}
          onClick={checkout}
          className="btn-primary min-h-12 w-full"
        >
          Place order
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
