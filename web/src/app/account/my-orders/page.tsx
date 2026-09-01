'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import {
  ArrowLeftIcon,
  ArrowRightIcon,
  ChatBubbleLeftRightIcon,
  ShoppingBagIcon,
} from '@heroicons/react/24/outline';
import { useAuth } from '@/hooks/useAuth';
import { BrandLoader } from '@/components/BrandLoader';
import FoodOrderMessageThread from '@/components/FoodOrderMessageThread';
import { cancelFoodOrder, getMyFoodOrders } from '@/lib/food-orders-api';
import { formatCost, formatFoodOrderStatus } from '@/lib/format';
import { getFriendlyErrorMessage } from '@/lib/errors';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import type { FoodOrder } from '@/lib/types';

function statusBadgeClass(status: FoodOrder['status']) {
  if (status === 'confirmed') return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300';
  if (status === 'pending') return 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300';
  if (status === 'declined') return 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300';
  return 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300';
}

// A buyer's own food order history, across every restaurant — mirrors
// My Tickets/My Bookings: a signed-in-only page since orders belong to
// the account, not to a shareable link. Each order expands in place to
// show its FoodOrderMessageThread rather than routing to a separate
// detail page, since there's nothing else on an order worth a whole page.
export default function MyOrdersPage() {
  const { user, token, ready } = useAuth();
  const [orders, setOrders] = useState<FoodOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState(false);
  const [cancelError, setCancelError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) {
      setLoading(false);
      return;
    }
    getMyFoodOrders(token)
      .then(setOrders)
      .catch((err) => setError(getFriendlyErrorMessage(err, { context: { action: 'load-my-food-orders' } })))
      .finally(() => setLoading(false));
  }, [token]);

  async function confirmCancel() {
    if (!token || !cancellingId) return;
    setCancelling(true);
    setCancelError(null);
    try {
      const updated = await cancelFoodOrder(token, cancellingId);
      setOrders((prev) => prev.map((o) => (o.id === updated.id ? updated : o)));
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
        <h1 className="font-display text-2xl font-bold text-slate-950 dark:text-slate-50">Track your food orders.</h1>
        <p className="text-sm text-slate-600 dark:text-slate-300">
          Log in to see your order status and message restaurants directly.
        </p>
        <Link href="/login" className="flex items-center gap-1 font-semibold text-brand-700 hover:underline dark:text-brand-300">
          Log in <ArrowRightIcon aria-hidden className="h-4 w-4" />
        </Link>
      </main>
    );
  }

  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-5 px-4 py-8">
      <Link href="/account" className="flex w-fit items-center gap-1 text-sm text-slate-500 hover:underline dark:text-slate-400">
        <ArrowLeftIcon aria-hidden className="h-4 w-4" /> Account
      </Link>
      <div>
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-brand-700 dark:text-brand-300">My orders</p>
        <h1 className="font-display text-2xl font-bold text-slate-950 dark:text-slate-50">Your food orders.</h1>
      </div>

      {error && <p role="alert" className="text-sm text-red-600 dark:text-red-400">{error}</p>}

      {loading ? (
        <p className="text-sm text-slate-500 dark:text-slate-400">Loading…</p>
      ) : orders.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-[2rem] border border-slate-200 bg-white p-8 text-center dark:border-slate-800 dark:bg-slate-900">
          <ShoppingBagIcon aria-hidden className="h-8 w-8 text-slate-400" />
          <p className="text-sm text-slate-500 dark:text-slate-400">
            No orders yet. Order from a restaurant&apos;s menu and it&apos;ll show up here.
          </p>
        </div>
      ) : (
        <ul className="flex flex-col gap-4">
          {orders.map((order) => {
            const expanded = expandedId === order.id;
            const canCancel = order.status === 'pending' || order.status === 'confirmed';
            return (
              <li key={order.id} className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-card dark:border-slate-800 dark:bg-slate-900">
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
