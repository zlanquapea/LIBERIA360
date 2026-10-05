import { OrderStepper } from '@/components/orders/OrderStepper';
import type { EPrescription } from '@/lib/clinic-api';
import { rxSteps } from '@/lib/prescriptions';

/** Where a prescription is, on the same progress line as every order. */
export function RxTracker({ rx }: { rx: EPrescription }) {
  return (
    <div className="flex flex-col gap-2">
      <OrderStepper steps={rxSteps(rx)} />
      {rx.pharmacy && (
        <p className="text-center text-xs text-slate-500 dark:text-slate-400">at {rx.pharmacy.name}</p>
      )}
    </div>
  );
}
