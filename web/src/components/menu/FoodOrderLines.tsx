import { formatMoney } from '@/lib/currency';
import type { FoodOrder } from '@/lib/types';

// Snapshotted line items plus total for one food order, shared by the
// buyer's My Orders page and the owner's incoming-orders queue. Keyed by
// index: the same dish can appear twice with different options.
export function FoodOrderLines({ order, className = '' }: { order: FoodOrder; className?: string }) {
  // Orders placed before menu currencies existed have no currency field.
  const currency = order.currency ?? 'USD';
  return (
    <div className={className}>
      <ul className="divide-y divide-slate-100 text-sm dark:divide-slate-800">
        {order.items.map((item, i) => (
          <li key={`${item.menuItemId}-${i}`} className="flex items-start justify-between gap-3 py-1.5">
            <span className="min-w-0 text-slate-700 dark:text-slate-200">
              <span className="font-semibold">{item.quantity} ×</span> {item.name}
              {item.options && item.options.length > 0 && (
                <span className="block text-xs text-slate-500 dark:text-slate-400">
                  {item.options.map((o) => o.choice).join(' · ')}
                </span>
              )}
            </span>
            <span className="shrink-0 text-slate-500 dark:text-slate-400">
              {formatMoney(Number(item.unitPrice) * item.quantity, currency)}
            </span>
          </li>
        ))}
      </ul>
      <div className="mt-1.5 flex items-center justify-between border-t border-slate-100 pt-1.5 text-sm font-semibold text-slate-900 dark:border-slate-800 dark:text-slate-50">
        <span>Total</span>
        <span>{formatMoney(Number(order.totalAmount), currency)}</span>
      </div>
    </div>
  );
}
