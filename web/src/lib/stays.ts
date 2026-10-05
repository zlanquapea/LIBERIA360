import type { OrderStep } from '@/components/orders/OrderStepper';
import type { BusinessType } from './types';
import type { Reservation, ReservationStatus, StayPaymentMethod, StayPaymentStatus } from './stays-api';

/** Hotels, guesthouses, lodges and beach resorts sell rooms by the night. */
export function businessHasRooms(type: BusinessType | string) {
  return type === 'hotel' || type === 'beach_resort';
}

export const RESERVATION_STATUS_LABELS: Record<ReservationStatus, string> = {
  requested: 'Waiting for the hotel',
  confirmed: 'Confirmed',
  checked_in: 'Checked in',
  checked_out: 'Checked out',
  declined: 'Declined',
  cancelled: 'Cancelled',
  no_show: 'No-show',
};

/** The same words, from the front desk's side. */
export const DESK_STATUS_LABELS: Record<ReservationStatus, string> = {
  ...RESERVATION_STATUS_LABELS,
  requested: 'New request',
  confirmed: 'Confirmed',
  checked_in: 'In house',
};

export function reservationStatusClass(status: ReservationStatus) {
  if (status === 'requested') return 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200';
  if (status === 'confirmed') return 'bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-200';
  if (status === 'checked_in') return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200';
  if (status === 'declined' || status === 'no_show') return 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-200';
  return 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300';
}

export const STAY_PAYMENT_LABELS: Record<StayPaymentMethod, string> = {
  pay_at_property: 'Pay at the front desk',
  mtn_momo: 'MTN MoMo',
  orange_money: 'Orange Money',
};

export const STAY_PAYMENT_BADGES: Record<StayPaymentStatus, { label: string; style: string }> = {
  pay_at_property: { label: 'Pay on arrival', style: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200' },
  awaiting_verification: { label: 'Payment being checked', style: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200' },
  paid: { label: 'Paid', style: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200' },
  failed: { label: 'Payment not found', style: 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-200' },
  refund_due: { label: 'Refund due', style: 'bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-200' },
  refunded: { label: 'Refunded', style: 'bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-200' },
};

/** Booked → Confirmed → Checked in → Checked out, on the shared stepper. */
export function staySteps(r: Pick<Reservation, 'status'>): OrderStep[] {
  const order: ReservationStatus[] = ['requested', 'confirmed', 'checked_in', 'checked_out'];
  const labels = ['Booked', 'Confirmed', 'Checked in', 'Checked out'];
  const reached = order.indexOf(r.status);
  return labels.map((label, i) => ({
    key: order[i],
    label,
    state: r.status === 'checked_out' || i < reached ? 'done' : i === reached ? 'current' : 'upcoming',
  }));
}

export const isOpenStay = (r: Pick<Reservation, 'status'>) =>
  r.status === 'requested' || r.status === 'confirmed' || r.status === 'checked_in';

const DAY = 864e5;

export function addDays(date: string, days: number) {
  return new Date(Date.parse(`${date}T00:00:00Z`) + days * DAY).toISOString().slice(0, 10);
}

export function nightsBetween(checkIn: string, checkOut: string) {
  return Math.round((Date.parse(`${checkOut}T00:00:00Z`) - Date.parse(`${checkIn}T00:00:00Z`)) / DAY);
}

/** Today in Liberia (GMT). */
export const todayInLiberia = (now = new Date()) => now.toISOString().slice(0, 10);

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** "Fri 10 Oct", the same on the server and in every browser. */
export function stayDate(date: string, withYear = false) {
  const d = new Date(`${date}T12:00:00Z`);
  const text = `${WEEKDAYS[d.getUTCDay()]} ${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`;
  return withYear ? `${text} ${d.getUTCFullYear()}` : text;
}

export const nightsLabel = (n: number) => `${n} ${n === 1 ? 'night' : 'nights'}`;

export function guestsLabel(adults: number, children = 0) {
  const a = `${adults} ${adults === 1 ? 'adult' : 'adults'}`;
  return children ? `${a}, ${children} ${children === 1 ? 'child' : 'children'}` : a;
}

/** "14:00" → "2pm" */
export function clockTime(hhmm: string) {
  const [h, m] = hhmm.split(':').map(Number);
  const suffix = h >= 12 ? 'pm' : 'am';
  const hour = h % 12 || 12;
  return m ? `${hour}:${String(m).padStart(2, '0')}${suffix}` : `${hour}${suffix}`;
}

/** How full a room type is tonight, as a colour. */
export function occupancyTone(left: number, total: number) {
  if (left <= 0) return 'bg-red-100 text-red-800 dark:bg-red-950/50 dark:text-red-200';
  if (left / total <= 0.25) return 'bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-200';
  return 'bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200';
}
