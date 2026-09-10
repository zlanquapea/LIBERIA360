"use client";
import { useEffect, useState } from "react";
import {
  getMyPharmacyOrders,
  resubmitPrescription,
  type PharmacyOrder,
} from "@/lib/pharmacy-api";
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

// Inline reply form for an order whose prescription review came back
// "clarification_requested" (see PharmaciesService.review()) — without
// this the order just sat at "under_review" forever with no way for the
// customer to act on the pharmacist's request.
function ClarificationReply({
  order,
  onResubmitted,
}: {
  order: PharmacyOrder;
  onResubmitted: () => void;
}) {
  const [file, setFile] = useState<File | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  return (
    <div className="mt-3 rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm dark:border-amber-800 dark:bg-amber-950/30">
      <p className="font-semibold text-amber-800 dark:text-amber-300">
        The pharmacist requested clarification on your prescription
      </p>
      {order.latestReviewNotes && (
        <p className="mt-1 text-amber-800 dark:text-amber-300">
          &ldquo;{order.latestReviewNotes}&rdquo;
        </p>
      )}
      <label className="mt-2 block">
        <span className="sr-only">Upload a replacement prescription</span>
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp,application/pdf"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          className="input mt-1 w-full text-xs"
        />
      </label>
      {error && (
        <p role="alert" className="mt-1 text-red-700 dark:text-red-400">
          {error}
        </p>
      )}
      <button
        type="button"
        disabled={!file || busy}
        onClick={async () => {
          if (!file) return;
          setBusy(true);
          setError("");
          try {
            await resubmitPrescription(order.id, file);
            onResubmitted();
          } catch (e) {
            setError(e instanceof Error ? e.message : "Upload failed");
          } finally {
            setBusy(false);
          }
        }}
        className="btn-secondary mt-2 min-h-9 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {busy ? "Uploading…" : "Submit new prescription"}
      </button>
    </div>
  );
}

export default function PharmacyOrdersPage() {
  const [orders, setOrders] = useState<PharmacyOrder[] | null>(null),
    [error, setError] = useState("");
  const load = () =>
    getMyPharmacyOrders()
      .then(setOrders)
      .catch((e) => setError(e.message));
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
            {o.items && o.items.length > 0 && (
              <ul className="mt-2 space-y-1 text-sm text-slate-600 dark:text-slate-400">
                {o.items.map((item) => (
                  <li key={item.id} className="flex justify-between">
                    <span>
                      {item.name} × {item.quantity}
                    </span>
                    <span>
                      L${(Number(item.unitPrice) * item.quantity).toFixed(2)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
            <p className="mt-2 font-bold">
              Total L${Number(o.finalTotal).toFixed(2)}
            </p>
            {o.status === "under_review" &&
              o.latestReviewDecision === "clarification_requested" && (
                <ClarificationReply order={o} onResubmitted={load} />
              )}
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
