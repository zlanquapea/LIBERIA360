"use client";
import { useEffect, useState } from "react";
import { getMyPharmacyOrders, type PharmacyOrder } from "@/lib/pharmacy-api";
const labels: Record<string, string> = {
  pending: "Pending",
  under_review: "Under review",
  accepted: "Accepted",
  preparing: "Preparing",
  ready_for_pickup: "Ready for pickup",
  out_for_delivery: "Out for delivery",
  completed: "Completed",
  rejected: "Rejected",
  cancelled: "Cancelled",
};
export default function PharmacyOrdersPage() {
  const [orders, setOrders] = useState<PharmacyOrder[] | null>(null),
    [error, setError] = useState("");
  useEffect(() => {
    getMyPharmacyOrders()
      .then(setOrders)
      .catch((e) => setError(e.message));
  }, []);
  return (
    <main className="page-shell max-w-4xl">
      <h1 className="page-title">Pharmacy orders</h1>
      <p>Track current requests and review previous orders.</p>
      {error && (
        <p role="alert" className="error-state">
          {error}
        </p>
      )}
      {orders === null && !error && <p role="status">Loading your orders…</p>}
      {orders?.length === 0 && (
        <p className="empty-state">You have not placed a pharmacy order yet.</p>
      )}
      <div className="space-y-3">
        {orders?.map((o) => (
          <article
            className="rounded-2xl border bg-white p-5 dark:bg-slate-900"
            key={o.id}
          >
            <div className="flex justify-between">
              <h2 className="font-bold">Order {o.id.slice(0, 8)}</h2>
              <span className="rounded-full bg-brand-50 px-3 py-1 text-sm font-semibold text-brand-800">
                {labels[o.status] ?? o.status}
              </span>
            </div>
            <p className="mt-2 text-sm">
              {new Date(o.createdAt).toLocaleDateString()} ·{" "}
              {o.fulfillmentMethod}
            </p>
            <p className="mt-2 font-bold">
              Total L${Number(o.finalTotal).toFixed(2)}
            </p>
          </article>
        ))}
      </div>
      <section className="mt-8 rounded-xl border border-slate-200 p-4 text-sm">
        <h2 className="font-bold">Privacy controls</h2>
        <p>
          You may request account deletion from Account settings. Order records
          required for legal or safety obligations may be retained in anonymized
          form.
        </p>
      </section>
    </main>
  );
}
