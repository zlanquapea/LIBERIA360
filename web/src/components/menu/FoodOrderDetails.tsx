import { BanknotesIcon, DevicePhoneMobileIcon, MapPinIcon, PhoneIcon, ShoppingBagIcon, TruckIcon } from '@heroicons/react/24/outline';
import { FOOD_PAYMENT_STATUS_STYLES, PAYMENT_METHOD_LABELS, isMobileMoney, paymentStatusLabel } from '@/lib/food-ordering';
import type { FoodOrder } from '@/lib/types';

// How an order reaches the customer and how it's being paid — shared by the
// customer's My Orders card and the restaurant's incoming-orders queue.
export function FoodOrderDetails({ order }: { order: FoodOrder }) {
  const delivery = order.fulfillment === 'delivery';
  const mobile = isMobileMoney(order.paymentMethod);
  return (
    <dl className="grid gap-2 rounded-2xl bg-slate-50 p-3 text-sm dark:bg-slate-800/50 sm:grid-cols-2">
      <div className="flex items-start gap-2">
        <dt className="sr-only">Fulfillment</dt>
        {delivery ? (
          <TruckIcon aria-hidden className="mt-0.5 h-5 w-5 shrink-0 text-brand-700 dark:text-brand-300" />
        ) : (
          <ShoppingBagIcon aria-hidden className="mt-0.5 h-5 w-5 shrink-0 text-brand-700 dark:text-brand-300" />
        )}
        <dd className="min-w-0">
          <p className="font-semibold text-slate-900 dark:text-slate-50">{delivery ? 'Delivery' : 'Pickup'}</p>
          {delivery && order.deliveryAddress && (
            <p className="flex items-start gap-1 text-slate-600 dark:text-slate-300">
              <MapPinIcon aria-hidden className="mt-0.5 h-4 w-4 shrink-0" />
              <span className="break-words">{order.deliveryAddress}</span>
            </p>
          )}
          {order.contactPhone && (
            <a
              href={`tel:${order.contactPhone.replace(/[^+0-9]/g, '')}`}
              className="flex items-center gap-1 text-brand-700 hover:underline dark:text-brand-300"
            >
              <PhoneIcon aria-hidden className="h-4 w-4" />
              {order.contactPhone}
            </a>
          )}
        </dd>
      </div>
      <div className="flex items-start gap-2">
        <dt className="sr-only">Payment</dt>
        {mobile ? (
          <DevicePhoneMobileIcon aria-hidden className="mt-0.5 h-5 w-5 shrink-0 text-brand-700 dark:text-brand-300" />
        ) : (
          <BanknotesIcon aria-hidden className="mt-0.5 h-5 w-5 shrink-0 text-brand-700 dark:text-brand-300" />
        )}
        <dd className="min-w-0">
          <p className="flex flex-wrap items-center gap-2 font-semibold text-slate-900 dark:text-slate-50">
            {PAYMENT_METHOD_LABELS[order.paymentMethod]}
            <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${FOOD_PAYMENT_STATUS_STYLES[order.paymentStatus]}`}>
              {paymentStatusLabel(order)}
            </span>
          </p>
          {mobile && order.paymentReference && (
            <p className="text-slate-600 dark:text-slate-300">
              Transaction ID <span className="font-mono font-semibold">{order.paymentReference}</span>
            </p>
          )}
          {mobile && order.paymentAccount && (
            <p className="text-xs text-slate-500 dark:text-slate-400">Sent to {order.paymentAccount}</p>
          )}
        </dd>
      </div>
    </dl>
  );
}
