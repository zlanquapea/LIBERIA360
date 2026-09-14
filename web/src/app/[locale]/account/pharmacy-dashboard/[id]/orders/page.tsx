'use client';

import { useCallback, useEffect, useState } from 'react';
import { usePharmacyDashboard } from '@/components/PharmacyDashboardContext';
import {
  getPharmacyDashboardOrders,
  restorePharmacyOrder,
  reviewPharmacyPrescription,
  transitionPharmacyOrder,
  type PharmacyOrder,
} from '@/lib/pharmacy-api';

const ORDER_LABELS: Record<string, string> = {
  pending: 'Pending',
  under_review: 'Under review',
  accepted: 'Accepted',
  preparing: 'Preparing',
  ready_for_pickup: 'Ready for pickup',
  out_for_delivery: 'Out for delivery',
  completed: 'Completed',
  rejected: 'Rejected',
  cancelled: 'Cancelled',
};
// A colored pill per status, grouped by what it means for staff at a
// glance: amber = needs a decision, blue = actively being worked,
// emerald = done right, slate/red = done, nothing left to do.
const STATUS_STYLES: Record<string, string> = {
  pending: 'bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300',
  under_review: 'bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300',
  accepted: 'bg-blue-100 text-blue-800 dark:bg-blue-950/40 dark:text-blue-300',
  preparing: 'bg-blue-100 text-blue-800 dark:bg-blue-950/40 dark:text-blue-300',
  ready_for_pickup: 'bg-violet-100 text-violet-800 dark:bg-violet-950/40 dark:text-violet-300',
  out_for_delivery: 'bg-violet-100 text-violet-800 dark:bg-violet-950/40 dark:text-violet-300',
  completed: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300',
  rejected: 'bg-red-100 text-red-800 dark:bg-red-950/40 dark:text-red-300',
  cancelled: 'bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
};
function StatusPill({ status }: { status: string }) {
  return (
    <span
      className={`rounded-full px-3 py-1 text-sm font-semibold ${STATUS_STYLES[status] ?? 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'}`}
    >
      {ORDER_LABELS[status] ?? status}
    </span>
  );
}
// Mirrors PharmaciesService's own NEXT[] transition map (pharmacies.service.ts)
// so the buttons shown here only ever offer a move the API will actually
// accept — the server re-validates every one regardless, this just avoids
// a round trip that was always going to 409.
const NEXT_STATUSES: Record<string, string[]> = {
  pending: ['accepted', 'cancelled'],
  under_review: ['cancelled'],
  accepted: ['preparing', 'cancelled'],
  preparing: ['ready_for_pickup', 'out_for_delivery'],
  ready_for_pickup: ['completed'],
  out_for_delivery: ['completed'],
  completed: [],
  rejected: [],
  cancelled: [],
};
// "preparing" offers both dispatch options above, but only one is ever
// valid for a given order — the API's own NEXT[] map (and its 409) doesn't
// distinguish by fulfillmentMethod either, it just rejects whichever one
// doesn't match, so filter it out here rather than showing a button that's
// guaranteed to fail.
function nextStatusesFor(order: PharmacyOrder): string[] {
  return (NEXT_STATUSES[order.status] ?? []).filter((next) => {
    if (next === 'ready_for_pickup') return order.fulfillmentMethod === 'pickup';
    if (next === 'out_for_delivery') return order.fulfillmentMethod === 'delivery';
    return true;
  });
}

function ReviewForm({
  pharmacyId,
  prescriptionId,
  prescriptionVersion,
  onDone,
}: {
  pharmacyId: string;
  prescriptionId: string;
  prescriptionVersion: number | null;
  onDone: () => void;
}) {
  const [notes, setNotes] = useState(''),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  async function decide(decision: 'accepted' | 'rejected' | 'clarification_requested') {
    if (prescriptionVersion == null) {
      setError('Could not determine the current prescription version — reload the page.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      await reviewPharmacyPrescription(pharmacyId, prescriptionId, {
        decision,
        notes: notes.trim() || undefined,
        prescriptionVersion,
      });
      onDone();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not record decision.');
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="mt-3 rounded-xl border border-amber-300 bg-amber-50 p-3 dark:border-amber-800 dark:bg-amber-950/30">
      <p className="text-sm font-semibold text-amber-800 dark:text-amber-300">
        Prescription review required
      </p>
      {/* Streams the actual bytes through the cookie-authenticated API
          route (see PharmaciesController#prescriptionFile) — there's no
          public URL for this file, so a plain <img>/href to the storage
          provider is never an option. */}
      <a
        href={`/api/v1/pharmacy-marketplace/prescriptions/${prescriptionId}/file`}
        target="_blank"
        rel="noreferrer"
        className="mt-1 inline-block text-sm font-semibold text-brand-700 underline"
      >
        View uploaded prescription
      </a>
      <label className="mt-2 block text-sm">
        Notes (shown to the customer on a clarification request)
        <textarea className="input mt-1 w-full" value={notes} onChange={(e) => setNotes(e.target.value)} />
      </label>
      <div className="mt-2 flex flex-wrap gap-2">
        <button disabled={busy} onClick={() => decide('accepted')} className="btn-primary min-h-9">
          Accept
        </button>
        <button
          disabled={busy}
          onClick={() => decide('rejected')}
          className="btn-secondary min-h-9 text-red-700"
        >
          Reject
        </button>
        <button disabled={busy} onClick={() => decide('clarification_requested')} className="btn-secondary min-h-9">
          Request clarification
        </button>
      </div>
      {error && (
        <p role="alert" className="error-state mt-2">
          {error}
        </p>
      )}
    </div>
  );
}

export default function PharmacyOrdersPage() {
  const { pharmacy, stats, reloadStats } = usePharmacyDashboard();
  const pharmacyId = pharmacy.id;
  const isPharmacist = stats?.role === 'pharmacist';
  const [orders, setOrders] = useState<PharmacyOrder[] | null>(null),
    [error, setError] = useState(''),
    [transitioning, setTransitioning] = useState<string | null>(null),
    [restoreError, setRestoreError] = useState<Record<string, string>>({});
  const load = useCallback(() => {
    getPharmacyDashboardOrders(pharmacyId)
      .then(setOrders)
      .catch((e) => setError(e instanceof Error ? e.message : 'Load failed'));
  }, [pharmacyId]);
  useEffect(load, [load]);
  function reload() {
    load();
    reloadStats();
  }
  async function transition(orderId: string, status: string) {
    setTransitioning(orderId);
    setError('');
    try {
      await transitionPharmacyOrder(pharmacyId, orderId, status);
      reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not update order.');
    } finally {
      setTransitioning(null);
    }
  }
  // Undoes a mistaken cancellation. Its own per-order error slot (rather
  // than the shared banner above) because a restore failure — most likely
  // "this stock sold out while the order sat cancelled" — is specific to
  // the one order the staff member just clicked Restore on, not a
  // page-wide problem.
  async function restore(orderId: string) {
    setTransitioning(orderId);
    setRestoreError((e) => ({ ...e, [orderId]: '' }));
    try {
      await restorePharmacyOrder(pharmacyId, orderId);
      reload();
    } catch (e) {
      setRestoreError((prev) => ({
        ...prev,
        [orderId]: e instanceof Error ? e.message : 'Could not restore this order.',
      }));
    } finally {
      setTransitioning(null);
    }
  }
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div>
        <h2 className="text-xl font-bold text-slate-950 dark:text-slate-50">Orders</h2>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Newest first — accept, prepare, and dispatch orders as they come in.
        </p>
      </div>
      {error && (
        <p role="alert" className="error-state mt-2">
          {error}
        </p>
      )}
      {orders === null && !error && <p className="mt-2">Loading orders…</p>}
      {orders?.length === 0 && <p className="empty-state mt-2">No orders yet.</p>}
      <ul className="mt-4 space-y-3">
        {orders?.map((o) => (
          <li
            key={o.id}
            className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-950"
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="font-semibold text-slate-900 dark:text-slate-50">
                  Order #{o.id.slice(0, 8).toUpperCase()}
                </p>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  {o.fulfillmentMethod === 'delivery' ? 'Delivery' : 'Pickup'} · L$
                  {Number(o.finalTotal).toFixed(2)}
                  {o.createdAt && ` · ${new Date(o.createdAt).toLocaleString()}`}
                </p>
              </div>
              <StatusPill status={o.status} />
            </div>
            {o.items && o.items.length > 0 && (
              <ul className="mt-3 divide-y divide-slate-100 rounded-xl border border-slate-100 text-sm dark:divide-slate-800 dark:border-slate-800">
                {o.items.map((item) => (
                  <li key={item.id} className="flex items-center justify-between px-3 py-1.5">
                    <span className="text-slate-700 dark:text-slate-300">
                      {item.name} <span className="text-slate-400">× {item.quantity}</span>
                    </span>
                    <span className="font-medium text-slate-600 dark:text-slate-400">
                      L${(Number(item.unitPrice) * item.quantity).toFixed(2)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
            {o.status === 'under_review' && o.prescriptionId && !isPharmacist && (
              <p className="mt-3 rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-300">
                Awaiting pharmacist review — only a pharmacist on staff can accept, reject, or
                request clarification on a prescription.
              </p>
            )}
            {o.status === 'under_review' && o.prescriptionId && isPharmacist && (
              <ReviewForm
                pharmacyId={pharmacyId}
                prescriptionId={o.prescriptionId}
                prescriptionVersion={o.prescriptionVersion ?? null}
                onDone={reload}
              />
            )}
            {nextStatusesFor(o).length > 0 && (
              <div className="mt-3 flex flex-wrap gap-2">
                {nextStatusesFor(o).map((next) => (
                  <button
                    key={next}
                    disabled={transitioning === o.id}
                    onClick={() => transition(o.id, next)}
                    className={
                      next === 'cancelled'
                        ? 'btn-secondary min-h-9 text-red-700 disabled:opacity-50'
                        : 'btn-primary min-h-9 disabled:opacity-50'
                    }
                  >
                    {transitioning === o.id
                      ? 'Working…'
                      : next === 'cancelled'
                        ? 'Cancel order'
                        : `Mark ${ORDER_LABELS[next] ?? next}`}
                  </button>
                ))}
              </div>
            )}
            {/* Undoes a mistaken cancellation — the one thing the button
                row above can never offer, since NEXT[cancelled] is
                deliberately empty on the API side. Only shown once we know
                there's actually something to go back to. */}
            {o.status === 'cancelled' && o.previousStatus && (
              <div className="mt-3 flex flex-col items-start gap-2 rounded-xl border border-dashed border-slate-300 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-900/60">
                <p className="text-sm text-slate-600 dark:text-slate-300">
                  Cancelled by mistake?
                </p>
                <button
                  disabled={transitioning === o.id}
                  onClick={() => restore(o.id)}
                  className="btn-secondary min-h-9 disabled:opacity-50"
                >
                  {transitioning === o.id
                    ? 'Restoring…'
                    : `Restore to ${ORDER_LABELS[o.previousStatus] ?? o.previousStatus}`}
                </button>
                {restoreError[o.id] && (
                  <p role="alert" className="error-state">
                    {restoreError[o.id]}
                  </p>
                )}
              </div>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
