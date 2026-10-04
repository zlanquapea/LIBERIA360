import { OrderStepper } from '@/components/orders/OrderStepper';
import { trackerIndex, trackerSteps } from '@/lib/food-ordering';
import type { FoodOrder } from '@/lib/types';

// Placed → Confirmed → Preparing → On the way / Ready → Delivered / Picked up.
// Declined and cancelled orders leave the happy path and show no tracker.
export function FoodOrderTracker({ order }: { order: Pick<FoodOrder, 'status' | 'fulfillment'> }) {
  const current = trackerIndex(order);
  if (current < 0) return null;
  const completed = order.status === 'completed';
  return (
    <OrderStepper
      steps={trackerSteps(order.fulfillment).map((step, i) => ({
        key: step.status,
        label: step.label,
        state: i < current || completed ? 'done' : i === current ? 'current' : 'upcoming',
      }))}
    />
  );
}
