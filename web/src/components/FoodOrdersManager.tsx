'use client';

import { useEffect, useState } from 'react';
import { ChatBubbleLeftRightIcon } from '@heroicons/react/24/outline';
import FoodOrderMessageThread from './FoodOrderMessageThread';
import { getBusinessFoodOrders, respondToFoodOrder } from '@/lib/food-orders-api';
import { formatCost, formatFoodOrderStatus } from '@/lib/format';
import { getFriendlyErrorMessage } from '@/lib/errors';
import type { FoodOrder } from '@/lib/types';

function statusBadgeClass(status: FoodOrder['status']) {
  if (status === 'confirmed') return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300';
  if (status === 'pending') return 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300';
  if (status === 'declined') return 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300';
  return 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300';
}

// Owner-facing incoming-orders queue (restaurant businesses only) — same
// "self-fetches on mount" shape as MenuItemsManager, sitting right below
// it in the claim section so managing the menu and managing the orders
// that come from it are in one place. Confirm/decline mirrors
// BookingsPage's respond flow; the message thread reuses
// FoodOrderMessageThread, the same component the buyer sees.
export function FoodOrdersManager({ token, businessId }: { token: string; businessId: string }) {
  const [orders, setOrders] = useState<FoodOrder[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [respondingId, setRespondingId] = useState<string | null>(null);
  const [responseMessage, setResponseMessage] = useState('');
  const [responding, setResponding] = useState(false);

  useEffect(() => {
    getBusinessFoodOrders(token, businessId)
      .then(setOrders)
      .catch((err) => setError(getFriendlyErrorMessage(err, { context: { action: 'load-business-food-orders', businessId } })));
  }, [token, businessId]);

  async function respond(orderId: string, action: 'confirm' | 'decline') {
    setResponding(true);
    setError(null);
    try {
      const updated = await respondToFoodOrder(token, orderId, action, responseMessage.trim() || undefined);
      setOrders((prev) => prev?.map((o) => (o.id === updated.id ? updated : o)) ?? prev);
      setRespondingId(null);
      setResponseMessage('');
    } catch (err) {
      setError(getFriendlyErrorMessage(err, { context: { action: 'respond-to-food-order', orderId } }));
    } finally {
      setResponding(false);
    }
  }

  if (orders === null) {
    return <p className="text-sm text-slate-500 dark:text-slate-400">Loading orders…</p>;
  }

  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
      <h3 className="font-display text-lg font-bold text-slate-950 dark:text-slate-50">Incoming orders</h3>
      {error && <p role="alert" className="text-sm text-red-600 dark:text-red-400">{error}</p>}

      {orders.length === 0 ? (
        <p className="text-sm text-slate-500 dark:text-slate-400">No orders yet.</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {orders.map((order) => {
            const expanded = expandedId === order.id;
            const isPending = order.status === 'pending';
            return (
              <li key={order.id} className="rounded-xl border border-slate-200 p-4 dark:border-slate-700">
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

                <ul className="mt-2 divide-y divide-slate-100 text-sm dark:divide-slate-800">
                  {order.items.map((item) => (
                    <li key={item.menuItemId} className="flex items-center justify-between py-1">
                      <span className="text-slate-700 dark:text-slate-200">{item.quantity} × {item.name}</span>
                      <span className="text-slate-500 dark:text-slate-400">{formatCost(Number(item.unitPrice) * item.quantity)}</span>
                    </li>
                  ))}
                </ul>
                <div className="mt-1 flex items-center justify-between text-sm font-semibold text-slate-900 dark:text-slate-50">
                  <span>Total</span>
                  <span>{formatCost(order.totalAmount)}</span>
                </div>
                {order.notes && <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">Note: {order.notes}</p>}

                {isPending && respondingId === order.id ? (
                  <div className="mt-3 flex flex-col gap-2">
                    <textarea
                      value={responseMessage}
                      onChange={(e) => setResponseMessage(e.target.value)}
                      rows={2}
                      maxLength={1000}
                      placeholder="Message for the buyer (optional)"
                      className="rounded-xl border border-slate-300 p-2 text-sm dark:border-slate-700 dark:bg-slate-800"
                    />
                    <div className="flex gap-2">
                      <button
                        type="button"
                        disabled={responding}
                        onClick={() => respond(order.id, 'confirm')}
                        className="rounded-full bg-emerald-600 px-4 py-1.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
                      >
                        Confirm
                      </button>
                      <button
                        type="button"
                        disabled={responding}
                        onClick={() => respond(order.id, 'decline')}
                        className="rounded-full border border-red-300 px-4 py-1.5 text-sm font-semibold text-red-600 hover:bg-red-50 disabled:opacity-60 dark:border-red-800 dark:hover:bg-red-950/40"
                      >
                        Decline
                      </button>
                      <button
                        type="button"
                        disabled={responding}
                        onClick={() => {
                          setRespondingId(null);
                          setResponseMessage('');
                        }}
                        className="rounded-full px-4 py-1.5 text-sm font-semibold text-slate-500 hover:underline dark:text-slate-400"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : isPending ? (
                  <button
                    type="button"
                    onClick={() => setRespondingId(order.id)}
                    className="mt-3 rounded-full bg-brand-700 px-4 py-1.5 text-sm font-semibold text-white hover:bg-brand-800"
                  >
                    Respond
                  </button>
                ) : order.businessResponse ? (
                  <p className="mt-2 rounded-xl bg-slate-50 p-2 text-sm text-slate-600 dark:bg-slate-800/40 dark:text-slate-300">
                    Your response: {order.businessResponse}
                  </p>
                ) : null}

                <button
                  type="button"
                  onClick={() => setExpandedId(expanded ? null : order.id)}
                  className="mt-3 flex items-center gap-1 text-sm font-semibold text-brand-700 hover:underline dark:text-brand-300"
                >
                  <ChatBubbleLeftRightIcon aria-hidden className="h-4 w-4" />
                  {expanded ? 'Hide messages' : 'Message the buyer'}
                </button>

                {expanded && (
                  <div className="mt-3 border-t border-slate-100 pt-3 dark:border-slate-800">
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
