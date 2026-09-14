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
// Same grouping as the pharmacy dashboard's own StatusPill (orders/page.tsx)
// — amber while something needs to happen, blue/violet while it's actively
// moving, emerald/red/slate once it's settled — kept in sync deliberately
// so a customer and pharmacy staff describe the same order with the same
// color.
const STATUS_STYLES: Record<string, string> = {
  pending: "bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300",
  under_review: "bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300",
  accepted: "bg-blue-100 text-blue-800 dark:bg-blue-950/40 dark:text-blue-300",
  preparing: "bg-blue-100 text-blue-800 dark:bg-blue-950/40 dark:text-blue-300",
  ready_for_pickup: "bg-violet-100 text-violet-800 dark:bg-violet-950/40 dark:text-violet-300",
  out_for_delivery: "bg-violet-100 text-violet-800 dark:bg-violet-950/40 dark:text-violet-300",
  completed: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300",
  rejected: "bg-red-100 text-red-800 dark:bg-red-950/40 dark:text-red-300",
  cancelled: "bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
};
// A simple 4-stop progress trail for the common, non-prescription happy
// path (pending → accepted → preparing/dispatch → completed) — gives a
// customer an at-a-glance sense of "how far along is this" the way a food
// delivery app does, instead of just one status word. Not shown at all for
// a terminal order that never got there (rejected/cancelled) — a broken
// progress bar reads worse than none.
const HAPPY_PATH = ["pending", "accepted", "preparing", "completed"] as const;
function happyPathIndex(status: string): number {
  if (status === "under_review") return 0;
  if (status === "ready_for_pickup" || status === "out_for_delivery") return 2;
  return HAPPY_PATH.indexOf(status as (typeof HAPPY_PATH)[number]);
}
function OrderProgress({ status }: { status: string }) {
  const index = happyPathIndex(status);
  if (index < 0) return null;
  return (
    <div className="mt-3 flex items-center gap-1.5" aria-hidden>
      {HAPPY_PATH.map((step, i) => (
        <span
          key={step}
          className={`h-1.5 flex-1 rounded-full ${i <= index ? "bg-brand-600 dark:bg-brand-400" : "bg-slate-200 dark:bg-slate-700"}`}
        />
      ))}
    </div>
  );
}

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
      <div className="space-y-4">
        {orders?.map((o) => (
          <article
            className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900"
            key={o.id}
          >
            <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 p-5 dark:border-slate-800">
              <div>
                <h2 className="font-bold text-slate-900 dark:text-slate-50">
                  Order #{o.id.slice(0, 8).toUpperCase()}
                </h2>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                  {new Date(o.createdAt).toLocaleDateString(undefined, {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  })}{" "}
                  · {o.fulfillmentMethod === "delivery" ? "Delivery" : "Pickup"}
                  {o.pharmacy?.name && ` · ${o.pharmacy.name}`}
                </p>
              </div>
              <span
                className={`shrink-0 rounded-full px-3 py-1 text-sm font-semibold ${STATUS_STYLES[o.status] ?? "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300"}`}
              >
                {labels[o.status] ?? o.status}
              </span>
            </div>
            <div className="p-5">
              <OrderProgress status={o.status} />
              {o.items && o.items.length > 0 && (
                <ul className="mt-4 divide-y divide-slate-100 text-sm dark:divide-slate-800">
                  {o.items.map((item) => (
                    <li key={item.id} className="flex items-center justify-between gap-3 py-2">
                      <span className="text-slate-700 dark:text-slate-300">
                        {item.name} <span className="text-slate-400">× {item.quantity}</span>
                      </span>
                      <span className="font-medium text-slate-900 dark:text-slate-100">
                        L${(Number(item.unitPrice) * item.quantity).toFixed(2)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
              <p className="mt-3 flex items-center justify-between border-t border-slate-100 pt-3 font-bold text-slate-900 dark:border-slate-800 dark:text-slate-50">
                <span>Total</span>
                <span>L${Number(o.finalTotal).toFixed(2)}</span>
              </p>
              {o.status === "under_review" &&
                o.latestReviewDecision === "clarification_requested" && (
                  <ClarificationReply order={o} onResubmitted={load} />
                )}
              {o.status === "cancelled" && (
                <p className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-600 dark:border-slate-800 dark:bg-slate-800/50 dark:text-slate-300">
                  This order was cancelled. Contact the pharmacy if you believe this was a
                  mistake.
                </p>
              )}
            </div>
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
