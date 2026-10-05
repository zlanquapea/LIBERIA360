import type { OrderStep } from '@/components/orders/OrderStepper';
import type { FuelLevel, Rental, RentalPaymentMethod, RentalPaymentStatus, RentalStatus } from './rentals-api';
import { clockTime, stayDate } from './stays';

export const RENTAL_STATUS_LABELS: Record<RentalStatus, string> = {
  requested: 'Waiting for the owner',
  confirmed: 'Confirmed',
  on_trip: 'On the road',
  returned: 'Returned',
  declined: 'Declined',
  cancelled: 'Cancelled',
  no_show: 'Not collected',
};

/** The same words, from the owner's side. */
export const OWNER_STATUS_LABELS: Record<RentalStatus, string> = {
  ...RENTAL_STATUS_LABELS,
  requested: 'New request',
  on_trip: 'Out',
};

export function rentalStatusClass(status: RentalStatus, overdue = false) {
  if (overdue) return 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-200';
  if (status === 'requested') return 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200';
  if (status === 'confirmed') return 'bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-200';
  if (status === 'on_trip') return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200';
  if (status === 'declined' || status === 'no_show') return 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-200';
  return 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300';
}

export const RENTAL_PAYMENT_LABELS: Record<RentalPaymentMethod, string> = {
  cash_at_pickup: 'Cash at pickup',
  mtn_momo: 'MTN MoMo',
  orange_money: 'Orange Money',
};

export const RENTAL_PAYMENT_BADGES: Record<RentalPaymentStatus, { label: string; style: string }> = {
  pay_at_pickup: { label: 'Pay at pickup', style: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200' },
  awaiting_verification: { label: 'Payment being checked', style: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200' },
  paid: { label: 'Paid', style: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200' },
  failed: { label: 'Payment not found', style: 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-200' },
  refund_due: { label: 'Refund due', style: 'bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-200' },
  refunded: { label: 'Refunded', style: 'bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-200' },
};

export const FUEL_LABELS: Record<FuelLevel, string> = {
  empty: 'Empty',
  quarter: '¼ tank',
  half: '½ tank',
  three_quarters: '¾ tank',
  full: 'Full',
};

export const FUEL_LEVELS: FuelLevel[] = ['empty', 'quarter', 'half', 'three_quarters', 'full'];

/** Booked → Confirmed → Picked up → Returned, on the shared stepper. */
export function rentalSteps(r: Pick<Rental, 'status'>): OrderStep[] {
  const order: RentalStatus[] = ['requested', 'confirmed', 'on_trip', 'returned'];
  const labels = ['Booked', 'Confirmed', 'Picked up', 'Returned'];
  const reached = order.indexOf(r.status);
  return labels.map((label, i) => ({
    key: order[i],
    label,
    state: r.status === 'returned' || i < reached ? 'done' : i === reached ? 'current' : 'upcoming',
  }));
}

export const isOpenRental = (r: Pick<Rental, 'status'>) =>
  r.status === 'requested' || r.status === 'confirmed' || r.status === 'on_trip';

/** "Fri 10 Oct, 9am" */
export const when = (date: string, time: string) => `${stayDate(date)}, ${clockTime(time)}`;

export function durationLabel(r: Pick<Rental, 'rentalUnit' | 'units'>) {
  const unit = r.rentalUnit === 'hour' ? 'hour' : 'day';
  return `${r.units} ${unit}${r.units === 1 ? '' : 's'}`;
}

/** Whole days (at least one) between pickup and return dates. */
export function rentalDays(pickupDate: string, returnDate: string) {
  const ms = Date.parse(`${returnDate}T00:00:00Z`) - Date.parse(`${pickupDate}T00:00:00Z`);
  return Math.max(1, Math.round(ms / 864e5));
}

/** Whole hours, rounded up, between two times on one day. */
export function rentalHours(pickupTime: string, returnTime: string) {
  const [a, b] = [pickupTime, returnTime].map((t) => {
    const [h, m] = t.split(':').map(Number);
    return h * 60 + m;
  });
  return b <= a ? 0 : Math.ceil((b - a) / 60);
}

/** Distance over the allowance for this trip, and its price. */
export function excessMileage(r: Pick<Rental, 'mileageLimitPerDay' | 'excessMileageFee' | 'units' | 'rentalUnit'>, driven: number) {
  if (!r.mileageLimitPerDay || driven <= 0) return { over: 0, charge: 0 };
  const days = r.rentalUnit === 'hour' ? 1 : r.units;
  const over = Math.max(0, driven - r.mileageLimitPerDay * days);
  return { over, charge: Math.round(over * (r.excessMileageFee ?? 0) * 100) / 100 };
}

/** "2 days 3 hours" until (or since) the car is due back. */
export function timeLeft(dueBackAt: string, now = Date.now()) {
  const ms = Date.parse(dueBackAt) - now;
  const abs = Math.abs(ms);
  const days = Math.floor(abs / 864e5);
  const hours = Math.floor((abs % 864e5) / 36e5);
  const mins = Math.floor((abs % 36e5) / 6e4);
  const text = days ? `${days}d ${hours}h` : hours ? `${hours}h ${mins}m` : `${mins}m`;
  return { late: ms < 0, text };
}
