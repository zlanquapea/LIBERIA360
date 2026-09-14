'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import {
  ArrowLeftIcon,
  ArrowRightIcon,
  ArrowDownTrayIcon,
  ChatBubbleLeftRightIcon,
  ShoppingBagIcon,
} from '@heroicons/react/24/outline';
import { StarIcon } from '@heroicons/react/24/solid';
import { useAuth } from '@/hooks/useAuth';
import { BrandLoader } from '@/components/BrandLoader';
import { SuccessCheck } from '@/components/SuccessCheck';
import FoodOrderMessageThread from '@/components/FoodOrderMessageThread';
import { cancelFoodOrder, getMyFoodOrders } from '@/lib/food-orders-api';
import { formatCost, formatFoodOrderStatus } from '@/lib/format';
import { getFriendlyErrorMessage } from '@/lib/errors';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import {
  getMyPharmacyOrders,
  pharmacyOrderReceiptUrl,
  resubmitPrescription,
  submitPharmacyOrderFeedback,
  type PharmacyOrder,
} from '@/lib/pharmacy-api';
import type { FoodOrder } from '@/lib/types';

function statusBadgeClass(status: FoodOrder['status']) {
  if (status === 'confirmed') return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300';
  if (status === 'pending') return 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300';
  if (status === 'declined') return 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300';
  return 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300';
}

// A buyer's complete order history — every kind of order they've ever
// placed, one page, one entry point (see the account page's single "My
// Orders" tile). Pharmacy orders used to have their own separate account
// page and tile (/account/pharmacy-orders) — product feedback was that an
// order is an order regardless of what it's for, and splitting every kind
// into its own "portion" of the account page just makes the app feel more
// fragmented than it needs to. Each kind still renders with the fields
// that actually apply to it (a food order's restaurant thread vs. a
// pharmacy order's prescription/receipt/feedback flow), but they now share
// one chronological list, one loading state, and one empty state.
const PHARMACY_STATUS_LABELS: Record<string, string> = {
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
// Same grouping as the pharmacy dashboard's own status pills — amber while
// something needs to happen, blue/violet while it's actively moving,
// emerald/red/slate once it's settled — kept in sync deliberately so a
// customer and pharmacy staff describe the same order with the same color.
const PHARMACY_STATUS_STYLES: Record<string, string> = {
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
// A simple 4-stop progress trail for the common, non-prescription happy
// path (pending → accepted → preparing/dispatch → completed) — gives a
// customer an at-a-glance sense of "how far along is this" instead of just
// one status word. Not shown for a terminal order that never got there
// (rejected/cancelled) — a broken progress bar reads worse than none.
const HAPPY_PATH = ['pending', 'accepted', 'preparing', 'completed'] as const;
function happyPathIndex(status: string): number {
  if (status === 'under_review') return 0;
  if (status === 'ready_for_pickup' || status === 'out_for_delivery') return 2;
  return HAPPY_PATH.indexOf(status as (typeof HAPPY_PATH)[number]);
}
function PharmacyOrderProgress({ status }: { status: string }) {
  const index = happyPathIndex(status);
  if (index < 0) return null;
  return (
    <div className="mt-3 flex items-center gap-1.5" aria-hidden>
      {HAPPY_PATH.map((step, i) => (
        <span
          key={step}
          className={`h-1.5 flex-1 rounded-full ${i <= index ? 'bg-brand-600 dark:bg-brand-400' : 'bg-slate-200 dark:bg-slate-700'}`}
        />
      ))}
    </div>
  );
}

// Inline reply form for a pharmacy order whose prescription review came
// back "clarification_requested" (see PharmaciesService.review()) —
// without this the order just sat at "under_review" forever with no way
// for the customer to act on the pharmacist's request.
function ClarificationReply({
  order,
  onResubmitted,
}: {
  order: PharmacyOrder;
  onResubmitted: () => void;
}) {
  const [file, setFile] = useState<File | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  return (
    <div className="mt-3 rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm dark:border-amber-800 dark:bg-amber-950/30">
      <p className="font-semibold text-amber-800 dark:text-amber-300">
        The pharmacist requested clarification on your prescription
      </p>
      {order.latestReviewNotes && (
        <p className="mt-1 text-amber-800 dark:text-amber-300">&ldquo;{order.latestReviewNotes}&rdquo;</p>
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
          setError('');
          try {
            await resubmitPrescription(order.id, file);
            onResubmitted();
          } catch (e) {
            setError(e instanceof Error ? e.message : 'Upload failed');
          } finally {
            setBusy(false);
          }
        }}
        className="btn-secondary mt-2 min-h-9 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {busy ? 'Uploading…' : 'Submit new prescription'}
      </button>
    </div>
  );
}

// The post-purchase rating prompt — only ever shown once a pharmacy order
// is COMPLETED (see PharmaciesService.submitOrderFeedback), and replaced
// by a read-only summary the moment feedback exists, so a customer is
// never re-prompted for one they already gave.
function PharmacyFeedbackPrompt({
  order,
  onSubmitted,
}: {
  order: PharmacyOrder;
  onSubmitted: (feedback: { rating: number; comment: string | null }) => void;
}) {
  const [rating, setRating] = useState(5),
    [comment, setComment] = useState(''),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    // Only true for the request this component instance itself just made —
    // not for feedback that already existed when this order first loaded
    // (e.g. revisiting the page days later). The checkmark below is a
    // one-time "that worked" moment for the action just taken, not
    // something that should replay every time an old rating is displayed.
    [justSubmitted, setJustSubmitted] = useState(false);

  if (order.feedback) {
    return (
      <div className="mt-3 flex items-start gap-2 rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm dark:border-slate-800 dark:bg-slate-800/50">
        {justSubmitted && (
          <SuccessCheck className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600 dark:text-emerald-400" />
        )}
        <div>
          <p className="flex items-center gap-1 font-medium text-slate-700 dark:text-slate-200">
            Thanks for your feedback
            <span className="ml-1 flex items-center gap-0.5">
              {[0, 1, 2, 3, 4].map((i) => (
                <StarIcon
                  key={i}
                  aria-hidden
                  className={`h-4 w-4 ${i < order.feedback!.rating ? 'text-gold-500' : 'text-slate-300 dark:text-slate-700'}`}
                />
              ))}
            </span>
          </p>
          {order.feedback.comment && (
            <p className="mt-1 text-slate-600 dark:text-slate-300">&ldquo;{order.feedback.comment}&rdquo;</p>
          )}
        </div>
      </div>
    );
  }

  async function submit() {
    setBusy(true);
    setError('');
    try {
      const saved = await submitPharmacyOrderFeedback(order.id, {
        rating,
        comment: comment.trim() || undefined,
      });
      setJustSubmitted(true);
      onSubmitted(saved);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not submit feedback.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-800/50">
      <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">How was this order?</p>
      <div className="mt-2 flex items-center gap-1" role="radiogroup" aria-label="Rating">
        {[1, 2, 3, 4, 5].map((value) => (
          <button
            key={value}
            type="button"
            onClick={() => setRating(value)}
            role="radio"
            aria-checked={rating === value}
            aria-label={`${value} star${value === 1 ? '' : 's'}`}
            className={`transition-transform hover:scale-110 ${value <= rating ? 'text-gold-500' : 'text-slate-300 dark:text-slate-700'}`}
          >
            <StarIcon aria-hidden className="h-6 w-6" />
          </button>
        ))}
      </div>
      <textarea
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        maxLength={1000}
        rows={2}
        placeholder="Anything else to share? (optional)"
        className="input mt-2 w-full text-sm"
      />
      {error && (
        <p role="alert" className="mt-1 text-sm text-red-700 dark:text-red-400">
          {error}
        </p>
      )}
      <button
        type="button"
        disabled={busy}
        onClick={submit}
        className="btn-secondary mt-2 min-h-9 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {busy ? 'Submitting…' : 'Submit feedback'}
      </button>
    </div>
  );
}

function PharmacyOrderCard({
  order: o,
  onResubmitted,
  onFeedbackSubmitted,
}: {
  order: PharmacyOrder;
  onResubmitted: () => void;
  onFeedbackSubmitted: (feedback: { rating: number; comment: string | null }) => void;
}) {
  return (
    <article className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 p-5 dark:border-slate-800">
        <div>
          <h2 className="font-bold text-slate-900 dark:text-slate-50">
            Order #{o.id.slice(0, 8).toUpperCase()}
          </h2>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            {new Date(o.createdAt).toLocaleDateString(undefined, {
              month: 'short',
              day: 'numeric',
              year: 'numeric',
            })}{' '}
            · {o.fulfillmentMethod === 'delivery' ? 'Delivery' : 'Pickup'} · Pharmacy
            {o.pharmacy?.name && ` · ${o.pharmacy.name}`}
          </p>
        </div>
        <span
          className={`shrink-0 rounded-full px-3 py-1 text-sm font-semibold ${PHARMACY_STATUS_STYLES[o.status] ?? 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'}`}
        >
          {PHARMACY_STATUS_LABELS[o.status] ?? o.status}
        </span>
      </div>
      <div className="p-5">
        <PharmacyOrderProgress status={o.status} />
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
        {o.status === 'under_review' && o.latestReviewDecision === 'clarification_requested' && (
          <ClarificationReply order={o} onResubmitted={onResubmitted} />
        )}
        {o.status === 'cancelled' && (
          <p className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-600 dark:border-slate-800 dark:bg-slate-800/50 dark:text-slate-300">
            This order was cancelled. Contact the pharmacy if you believe this was a mistake.
          </p>
        )}
        {o.status === 'completed' && (
          <>
            <a
              href={pharmacyOrderReceiptUrl(o.id)}
              download
              className="mt-3 inline-flex items-center gap-1.5 text-sm font-semibold text-brand-700 hover:underline dark:text-brand-300"
            >
              <ArrowDownTrayIcon aria-hidden className="h-4 w-4" />
              Download receipt
            </a>
            <PharmacyFeedbackPrompt order={o} onSubmitted={onFeedbackSubmitted} />
          </>
        )}
      </div>
    </article>
  );
}

export default function MyOrdersPage() {
  const { user, token, ready } = useAuth();
  const [foodOrders, setFoodOrders] = useState<FoodOrder[]>([]);
  const [pharmacyOrders, setPharmacyOrders] = useState<PharmacyOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState(false);
  const [cancelError, setCancelError] = useState<string | null>(null);

  function loadPharmacyOrders() {
    getMyPharmacyOrders()
      .then(setPharmacyOrders)
      .catch((err) => setError(getFriendlyErrorMessage(err, { context: { action: 'load-my-pharmacy-orders' } })));
  }

  useEffect(() => {
    if (!token) {
      setLoading(false);
      return;
    }
    Promise.all([
      getMyFoodOrders(token).then(setFoodOrders),
      getMyPharmacyOrders().then(setPharmacyOrders),
    ])
      .catch((err) => setError(getFriendlyErrorMessage(err, { context: { action: 'load-my-orders' } })))
      .finally(() => setLoading(false));
  }, [token]);

  async function confirmCancel() {
    if (!token || !cancellingId) return;
    setCancelling(true);
    setCancelError(null);
    try {
      const updated = await cancelFoodOrder(token, cancellingId);
      setFoodOrders((prev) => prev.map((o) => (o.id === updated.id ? updated : o)));
      setCancellingId(null);
    } catch (err) {
      setCancelError(getFriendlyErrorMessage(err, { context: { action: 'cancel-food-order', orderId: cancellingId } }));
    } finally {
      setCancelling(false);
    }
  }

  if (!ready) {
    return (
      <main className="flex min-h-[70vh] flex-col items-center justify-center gap-5 px-4">
        <BrandLoader />
        <p className="text-sm font-medium tracking-wide text-slate-500 dark:text-slate-400">Loading your orders…</p>
      </main>
    );
  }

  if (!user) {
    return (
      <main className="mx-auto flex max-w-md flex-col items-center gap-3 px-4 py-16 text-center">
        <ShoppingBagIcon aria-hidden className="h-10 w-10 text-brand-700 dark:text-brand-300" />
        <h1 className="font-display text-2xl font-bold text-slate-950 dark:text-slate-50">Track all your orders.</h1>
        <p className="text-sm text-slate-600 dark:text-slate-300">
          Log in to see your order status, message restaurants, and track pharmacy deliveries.
        </p>
        <Link href="/login" className="flex items-center gap-1 font-semibold text-brand-700 hover:underline dark:text-brand-300">
          Log in <ArrowRightIcon aria-hidden className="h-4 w-4" />
        </Link>
      </main>
    );
  }

  // One combined, chronological list — a food order and a pharmacy order
  // are both just "an order", so they don't get split into separate
  // sections here any more than two food orders from different
  // restaurants would.
  type Combined =
    | { kind: 'food'; createdAt: string; order: FoodOrder }
    | { kind: 'pharmacy'; createdAt: string; order: PharmacyOrder };
  const combined: Combined[] = [
    ...foodOrders.map((order): Combined => ({ kind: 'food', createdAt: order.createdAt, order })),
    ...pharmacyOrders.map((order): Combined => ({ kind: 'pharmacy', createdAt: order.createdAt, order })),
  ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-5 px-4 py-8">
      <Link href="/account" className="flex w-fit items-center gap-1 text-sm text-slate-500 hover:underline dark:text-slate-400">
        <ArrowLeftIcon aria-hidden className="h-4 w-4" /> Account
      </Link>
      <div>
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-brand-700 dark:text-brand-300">My orders</p>
        <h1 className="font-display text-2xl font-bold text-slate-950 dark:text-slate-50">Your orders.</h1>
      </div>

      {error && <p role="alert" className="text-sm text-red-600 dark:text-red-400">{error}</p>}

      {loading ? (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-slate-300 px-4 py-10 text-center dark:border-slate-700">
          <BrandLoader />
          <p className="text-sm font-medium text-slate-600 dark:text-slate-300">Loading…</p>
        </div>
      ) : combined.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-[2rem] border border-slate-200 bg-white p-8 text-center dark:border-slate-800 dark:bg-slate-900">
          <ShoppingBagIcon aria-hidden className="h-8 w-8 text-slate-400" />
          <p className="text-sm text-slate-500 dark:text-slate-400">
            No orders yet. Order from a restaurant or a pharmacy and it&apos;ll show up here.
          </p>
        </div>
      ) : (
        <ul className="flex flex-col gap-4">
          {combined.map((entry) => {
            if (entry.kind === 'pharmacy') {
              return (
                <li key={`pharmacy-${entry.order.id}`}>
                  <PharmacyOrderCard
                    order={entry.order}
                    onResubmitted={loadPharmacyOrders}
                    onFeedbackSubmitted={(feedback) =>
                      setPharmacyOrders((prev) =>
                        prev.map((o) => (o.id === entry.order.id ? { ...o, feedback } : o)),
                      )
                    }
                  />
                </li>
              );
            }
            const order = entry.order;
            const expanded = expandedId === order.id;
            const canCancel = order.status === 'pending' || order.status === 'confirmed';
            return (
              <li key={`food-${order.id}`} className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-card dark:border-slate-800 dark:bg-slate-900">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    {order.business?.linkedPlace ? (
                      <Link
                        href={`/places/${order.business.linkedPlace.slug}`}
                        className="font-display text-lg font-bold text-slate-950 hover:underline dark:text-slate-50"
                      >
                        {order.business.name}
                      </Link>
                    ) : (
                      <p className="font-display text-lg font-bold text-slate-950 dark:text-slate-50">
                        {order.business?.name ?? 'Restaurant'}
                      </p>
                    )}
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      {new Date(order.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </p>
                  </div>
                  <span className={`shrink-0 rounded-full px-3 py-1 text-xs font-bold uppercase ${statusBadgeClass(order.status)}`}>
                    {formatFoodOrderStatus(order.status)}
                  </span>
                </div>

                <ul className="mt-3 divide-y divide-slate-100 text-sm dark:divide-slate-800">
                  {order.items.map((item) => (
                    <li key={item.menuItemId} className="flex items-center justify-between py-1.5">
                      <span className="text-slate-700 dark:text-slate-200">
                        {item.quantity} × {item.name}
                      </span>
                      <span className="text-slate-500 dark:text-slate-400">{formatCost(Number(item.unitPrice) * item.quantity)}</span>
                    </li>
                  ))}
                </ul>
                <div className="mt-2 flex items-center justify-between font-semibold text-slate-900 dark:text-slate-50">
                  <span>Total</span>
                  <span>{formatCost(order.totalAmount)}</span>
                </div>

                {order.notes && (
                  <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">Note: {order.notes}</p>
                )}
                {order.businessResponse && (
                  <p className="mt-2 rounded-xl bg-slate-50 p-2 text-sm text-slate-600 dark:bg-slate-800/40 dark:text-slate-300">
                    Restaurant: {order.businessResponse}
                  </p>
                )}

                <div className="mt-4 flex flex-wrap items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setExpandedId(expanded ? null : order.id)}
                    className="flex items-center gap-1 text-sm font-semibold text-brand-700 hover:underline dark:text-brand-300"
                  >
                    <ChatBubbleLeftRightIcon aria-hidden className="h-4 w-4" />
                    {expanded ? 'Hide messages' : 'Message the restaurant'}
                  </button>
                  {canCancel && (
                    <button
                      type="button"
                      onClick={() => setCancellingId(order.id)}
                      className="text-sm font-semibold text-red-600 hover:underline dark:text-red-400"
                    >
                      Cancel order
                    </button>
                  )}
                </div>

                {expanded && (
                  <div className="mt-4 border-t border-slate-100 pt-4 dark:border-slate-800">
                    <FoodOrderMessageThread orderId={order.id} />
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}

      <ConfirmDialog
        open={cancellingId !== null}
        title="Cancel this order?"
        description="The restaurant will be notified that you've cancelled."
        confirmLabel="Cancel order"
        cancelLabel="Keep order"
        loadingLabel="Cancelling…"
        isLoading={cancelling}
        error={cancelError}
        onConfirm={confirmCancel}
        onCancel={() => {
          if (cancelling) return;
          setCancellingId(null);
          setCancelError(null);
        }}
      />
    </main>
  );
}
