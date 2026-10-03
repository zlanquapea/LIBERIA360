'use client';

import { useEffect, useMemo, useState } from 'react';
import { ChatBubbleLeftRightIcon, ExclamationTriangleIcon } from '@heroicons/react/24/outline';
import FoodOrderMessageThread from './FoodOrderMessageThread';
import {
  getBusinessFoodOrders,
  markFoodOrderRefunded,
  respondToFoodOrder,
  updateFoodOrderStatus,
  type FoodOrderProgressStatus,
} from '@/lib/food-orders-api';
import { formatFoodOrderStatus } from '@/lib/format';
import { formatMoney } from '@/lib/currency';
import { PAYMENT_METHOD_LABELS, isMobileMoney, nextOwnerSteps } from '@/lib/food-ordering';
import { getFriendlyErrorMessage } from '@/lib/errors';
import type { FoodOrder } from '@/lib/types';
import { FoodOrderLines } from './menu/FoodOrderLines';
import { FoodOrderDetails } from './menu/FoodOrderDetails';

function statusBadgeClass(status: FoodOrder['status']) {
  if (status === 'pending') return 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300';
  if (status === 'declined') return 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300';
  if (status === 'cancelled') return 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300';
  if (status === 'completed') return 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200';
  return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300';
}

const ACTIVE: FoodOrder['status'][] = ['pending', 'confirmed', 'preparing', 'ready', 'out_for_delivery'];

// Owner-facing incoming-orders queue (restaurants and bars). Mobile money
// orders follow the event-ticket flow: the customer has already sent money
// and submitted a transaction ID, so confirming means "I found the
// payment". Confirmed orders then move through preparing → out for
// delivery / ready → completed, which the customer sees as a tracker.
export function FoodOrdersManager({ token, businessId }: { token: string; businessId: string }) {
  const [orders, setOrders] = useState<FoodOrder[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<'active' | 'past'>('active');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [respondingId, setRespondingId] = useState<string | null>(null);
  const [responseMessage, setResponseMessage] = useState('');
  const [paymentNotReceived, setPaymentNotReceived] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    getBusinessFoodOrders(token, businessId)
      .then(setOrders)
      .catch((err) => setError(getFriendlyErrorMessage(err, { context: { action: 'load-business-food-orders', businessId } })));
  }, [token, businessId]);

  const [active, past] = useMemo(() => {
    const all = orders ?? [];
    return [all.filter((o) => ACTIVE.includes(o.status)), all.filter((o) => !ACTIVE.includes(o.status))];
  }, [orders]);
  const refundsDue = (orders ?? []).filter((o) => o.paymentStatus === 'refund_due').length;
  const shown = tab === 'active' ? active : past;

  function replace(updated: FoodOrder) {
    setOrders((prev) => prev?.map((o) => (o.id === updated.id ? updated : o)) ?? prev);
  }

  async function run(orderId: string, action: () => Promise<FoodOrder>, context: string) {
    setBusyId(orderId);
    setError(null);
    try {
      replace(await action());
      return true;
    } catch (err) {
      setError(getFriendlyErrorMessage(err, { context: { action: context, orderId } }));
      return false;
    } finally {
      setBusyId(null);
    }
  }

  async function respond(order: FoodOrder, action: 'confirm' | 'decline') {
    const ok = await run(
      order.id,
      () =>
        respondToFoodOrder(
          token,
          order.id,
          action,
          responseMessage.trim() || undefined,
          action === 'decline' && isMobileMoney(order.paymentMethod) ? paymentNotReceived : undefined,
        ),
      'respond-to-food-order',
    );
    if (ok) {
      setRespondingId(null);
      setResponseMessage('');
      setPaymentNotReceived(false);
    }
  }

  function advance(order: FoodOrder, status: FoodOrderProgressStatus) {
    return run(order.id, () => updateFoodOrderStatus(token, order.id, status), 'update-food-order-status');
  }

  if (orders === null) {
    return error ? (
      <p role="alert" className="text-sm text-red-600 dark:text-red-400">{error}</p>
    ) : (
      <p className="text-sm text-slate-500 dark:text-slate-400">Loading orders…</p>
    );
  }

  return (
    <div className="flex flex-col gap-4 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="font-display text-lg font-bold text-slate-950 dark:text-slate-50">Incoming orders</h3>
        <div role="tablist" aria-label="Orders" className="flex gap-1 rounded-full bg-slate-100 p-1 dark:bg-slate-800">
          {(
            [
              ['active', `Active · ${active.length}`],
              ['past', `Past · ${past.length}`],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={tab === id}
              onClick={() => setTab(id)}
              className={`rounded-full px-4 py-1.5 text-sm font-semibold transition ${
                tab === id ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-900 dark:text-slate-50' : 'text-slate-500 dark:text-slate-400'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {refundsDue > 0 && (
        <p className="flex items-start gap-2 rounded-2xl bg-orange-50 p-3 text-sm font-medium text-orange-800 dark:bg-orange-950/40 dark:text-orange-200">
          <ExclamationTriangleIcon aria-hidden className="h-5 w-5 shrink-0" />
          {refundsDue} declined or cancelled mobile money order{refundsDue === 1 ? ' needs' : 's need'} a refund. Find{' '}
          {refundsDue === 1 ? 'it' : 'them'} under Past.
        </p>
      )}
      {error && <p role="alert" className="text-sm text-red-600 dark:text-red-400">{error}</p>}

      {shown.length === 0 ? (
        <p className="text-sm text-slate-500 dark:text-slate-400">{tab === 'active' ? 'No active orders right now.' : 'No past orders yet.'}</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {shown.map((order) => {
            const expanded = expandedId === order.id;
            const isPending = order.status === 'pending';
            const mobile = isMobileMoney(order.paymentMethod);
            const busy = busyId === order.id;
            const steps = nextOwnerSteps(order);
            return (
              <li key={order.id} className="flex flex-col gap-3 rounded-2xl border border-slate-200 p-4 dark:border-slate-700">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold text-slate-900 dark:text-slate-50">{order.buyer?.name ?? 'Guest'}</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      {new Date(order.createdAt).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
                    </p>
                  </div>
                  <span className={`shrink-0 rounded-full px-3 py-1 text-xs font-bold uppercase ${statusBadgeClass(order.status)}`}>
                    {formatFoodOrderStatus(order.status)}
                  </span>
                </div>

                <FoodOrderDetails order={order} />
                <FoodOrderLines order={order} />
                {order.notes && <p className="text-sm text-slate-500 dark:text-slate-400">Note: {order.notes}</p>}

                {isPending && mobile && order.paymentStatus === 'awaiting_verification' && (
                  <p className="rounded-2xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-100">
                    <strong>Check your payment first.</strong> Look in your {PAYMENT_METHOD_LABELS[order.paymentMethod]}
                    {order.paymentAccount ? ` (${order.paymentAccount})` : ''} for{' '}
                    <strong>{formatMoney(Number(order.totalAmount), order.currency)}</strong> with transaction ID{' '}
                    <span className="font-mono font-bold">{order.paymentReference}</span>. Confirm only once it&apos;s there.
                  </p>
                )}

                {isPending && respondingId === order.id ? (
                  <div className="flex flex-col gap-2">
                    <textarea
                      value={responseMessage}
                      onChange={(e) => setResponseMessage(e.target.value)}
                      rows={2}
                      maxLength={1000}
                      placeholder="Message for the customer (optional), e.g. ready in 30 minutes"
                      className="rounded-xl border border-slate-300 p-2 text-sm dark:border-slate-700 dark:bg-slate-800"
                    />
                    {mobile && (
                      <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-200">
                        <input
                          type="checkbox"
                          checked={paymentNotReceived}
                          onChange={(e) => setPaymentNotReceived(e.target.checked)}
                          className="h-4 w-4 rounded border-slate-300 accent-brand-700"
                        />
                        If declining: I couldn&apos;t find this payment
                      </label>
                    )}
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => respond(order, 'confirm')}
                        className="rounded-full bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
                      >
                        {mobile ? 'Payment received — confirm' : 'Confirm order'}
                      </button>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => respond(order, 'decline')}
                        className="rounded-full border border-red-300 px-4 py-2 text-sm font-semibold text-red-600 hover:bg-red-50 disabled:opacity-60 dark:border-red-800 dark:hover:bg-red-950/40"
                      >
                        Decline
                      </button>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => {
                          setRespondingId(null);
                          setResponseMessage('');
                          setPaymentNotReceived(false);
                        }}
                        className="rounded-full px-4 py-2 text-sm font-semibold text-slate-500 hover:underline dark:text-slate-400"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : isPending ? (
                  <button
                    type="button"
                    onClick={() => setRespondingId(order.id)}
                    className="self-start rounded-full bg-brand-700 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-800"
                  >
                    Respond
                  </button>
                ) : (
                  order.businessResponse && (
                    <p className="rounded-xl bg-slate-50 p-2 text-sm text-slate-600 dark:bg-slate-800/40 dark:text-slate-300">
                      Your response: {order.businessResponse}
                    </p>
                  )
                )}

                {steps.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {steps.map((step, i) => (
                      <button
                        key={step.status}
                        type="button"
                        disabled={busy}
                        onClick={() => advance(order, step.status)}
                        className={`rounded-full px-4 py-2 text-sm font-semibold disabled:opacity-60 ${
                          i === 0
                            ? 'bg-brand-700 text-white hover:bg-brand-800'
                            : 'border border-slate-300 text-slate-700 hover:border-brand-400 dark:border-slate-700 dark:text-slate-200'
                        }`}
                      >
                        {step.label}
                      </button>
                    ))}
                  </div>
                )}

                {order.paymentStatus === 'refund_due' && (
                  <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl bg-orange-50 p-3 text-sm text-orange-900 dark:bg-orange-950/40 dark:text-orange-100">
                    <span>
                      Send {formatMoney(Number(order.totalAmount), order.currency)} back by {PAYMENT_METHOD_LABELS[order.paymentMethod]}
                      {order.contactPhone ? ` to ${order.contactPhone}` : ''}, then record it here.
                    </span>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => run(order.id, () => markFoodOrderRefunded(token, order.id), 'mark-food-order-refunded')}
                      className="rounded-full bg-orange-600 px-4 py-2 text-sm font-semibold text-white hover:bg-orange-700 disabled:opacity-60"
                    >
                      Mark refunded
                    </button>
                  </div>
                )}

                <button
                  type="button"
                  onClick={() => setExpandedId(expanded ? null : order.id)}
                  className="flex items-center gap-1 self-start text-sm font-semibold text-brand-700 hover:underline dark:text-brand-300"
                >
                  <ChatBubbleLeftRightIcon aria-hidden className="h-4 w-4" />
                  {expanded ? 'Hide messages' : 'Message the customer'}
                </button>

                {expanded && (
                  <div className="border-t border-slate-100 pt-3 dark:border-slate-800">
                    <FoodOrderMessageThread orderId={order.id} />
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
