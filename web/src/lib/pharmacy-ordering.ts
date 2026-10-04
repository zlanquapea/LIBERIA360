import type { OpeningPeriod } from './types';
import type {
  Pharmacy,
  PharmacyOrder,
  PharmacyPaymentMethod,
  PharmacyPaymentStatus,
  PharmacyProduct,
} from './pharmacy-api';

export const PAYMENT_LABELS: Record<PharmacyPaymentMethod, string> = {
  cash: 'Cash',
  mtn_momo: 'MTN MoMo',
  orange_money: 'Orange Money',
};

/** Matches CartItemDto's @Max(100) on the API. */
export const MAX_PER_PRODUCT = 100;

export function money(amount: number | string | null | undefined) {
  return `L$${Number(amount ?? 0).toFixed(2)}`;
}

export function acceptedPaymentMethods(
  pharmacy: Pick<Pharmacy, 'acceptsCash' | 'mtnMomoNumber' | 'orangeMoneyNumber'>,
): PharmacyPaymentMethod[] {
  const methods: PharmacyPaymentMethod[] = [];
  // Missing means "takes cash" — the column defaults to true.
  if (pharmacy.acceptsCash !== false) methods.push('cash');
  if (pharmacy.mtnMomoNumber?.trim()) methods.push('mtn_momo');
  if (pharmacy.orangeMoneyNumber?.trim()) methods.push('orange_money');
  return methods;
}

export function merchantNumber(
  pharmacy: Pick<Pharmacy, 'mtnMomoNumber' | 'orangeMoneyNumber'>,
  method: PharmacyPaymentMethod,
): string | null {
  if (method === 'mtn_momo') return pharmacy.mtnMomoNumber?.trim() || null;
  if (method === 'orange_money') return pharmacy.orangeMoneyNumber?.trim() || null;
  return null;
}

/** Pharmacy opening hours ("08:00:00"-style rows) as OpeningPeriods, so the
 * shared open-now status works for pharmacies too. Null when none are set. */
export function pharmacyOpeningPeriods(hours: Pharmacy['openingHours']): OpeningPeriod[] | null {
  if (!hours || hours.length === 0) return null;
  const periods = hours
    .filter((h) => !h.isClosed && h.opensAt && h.closesAt)
    .map((h) => ({
      dayOfWeek: h.dayOfWeek as OpeningPeriod['dayOfWeek'],
      opens: h.opensAt!.slice(0, 5),
      closes: h.closesAt!.slice(0, 5),
    }));
  return periods;
}

export function stockOf(product: Pick<PharmacyProduct, 'inventory'>) {
  return product.inventory?.quantity ?? 0;
}

export type PharmacyCart = Record<string, number>;

export function cartTotals(
  cart: PharmacyCart,
  products: PharmacyProduct[],
  fulfillment: 'pickup' | 'delivery',
  deliveryFee: number | string,
) {
  let count = 0;
  let subtotal = 0;
  let needsPrescription = false;
  for (const product of products) {
    const quantity = cart[product.id] ?? 0;
    if (!quantity) continue;
    count += quantity;
    subtotal += Number(product.price) * quantity;
    needsPrescription ||= product.prescriptionRequired;
  }
  const delivery = fulfillment === 'delivery' ? Number(deliveryFee) : 0;
  return { count, subtotal, delivery, total: subtotal + delivery, needsPrescription };
}

export interface CheckoutState {
  fulfillment: 'pickup' | 'delivery';
  address: string;
  phone: string;
  paymentMethod: PharmacyPaymentMethod;
  paymentReference: string;
  needsPrescription: boolean;
  prescriptionFile: File | null;
  consent: boolean;
}

/** The first thing stopping checkout, in plain words, or null. */
export function checkoutProblem(s: CheckoutState): string | null {
  if (s.fulfillment === 'delivery') {
    if (s.address.trim().length < 5) return 'Add the delivery address — a landmark helps the rider.';
    if (!/^\+?[0-9][0-9 -]{5,18}[0-9]$/.test(s.phone.trim())) return 'Add a phone number so the rider can reach you.';
  }
  if (s.needsPrescription && !s.prescriptionFile) return 'Upload a photo or PDF of your prescription.';
  if (s.needsPrescription && !s.consent) return 'Tick the box to let the pharmacist review your prescription.';
  if (s.paymentMethod !== 'cash' && !s.needsPrescription && s.paymentReference.trim().length < 4)
    return `Enter the ${PAYMENT_LABELS[s.paymentMethod]} transaction ID.`;
  return null;
}

// ── Saved carts (per viewer, per pharmacy) ───────────────────────────

const cartKey = (pharmacyId: string) => `l360:pharmacy-cart:${pharmacyId}`;

export function loadCart(pharmacyId: string): PharmacyCart {
  try {
    const raw = window.localStorage.getItem(cartKey(pharmacyId));
    const parsed = raw ? (JSON.parse(raw) as unknown) : null;
    if (!parsed || typeof parsed !== 'object') return {};
    return Object.fromEntries(
      Object.entries(parsed as Record<string, unknown>).filter(
        ([, q]) => typeof q === 'number' && q > 0,
      ),
    ) as PharmacyCart;
  } catch {
    return {};
  }
}

export function saveCart(pharmacyId: string, cart: PharmacyCart) {
  try {
    const clean = Object.fromEntries(Object.entries(cart).filter(([, q]) => q > 0));
    if (Object.keys(clean).length === 0) window.localStorage.removeItem(cartKey(pharmacyId));
    else window.localStorage.setItem(cartKey(pharmacyId), JSON.stringify(clean));
  } catch {
    // Storage blocked (private mode): the cart just won't survive a reload.
  }
}

// ── Order tracking ───────────────────────────────────────────────────

export type TrackerStep = { key: string; label: string; state: 'done' | 'current' | 'upcoming' };

/**
 * The customer's view of where an order is: placed → (prescription check)
 * → (payment) → preparing → ready / on the way → done. Steps that don't
 * apply to this order (no prescription, cash) are left out.
 */
export function trackerSteps(order: Pick<PharmacyOrder, 'status' | 'fulfillmentMethod' | 'paymentMethod' | 'paymentStatus' | 'prescriptionId'>): TrackerStep[] {
  const rx = Boolean(order.prescriptionId);
  const mobile = order.paymentMethod && order.paymentMethod !== 'cash';
  const delivery = order.fulfillmentMethod === 'delivery';
  const steps: Array<{ key: string; label: string; done: boolean }> = [
    { key: 'placed', label: 'Placed', done: true },
  ];
  const statusRank: Record<string, number> = {
    pending: 0,
    under_review: 0,
    accepted: 1,
    preparing: 2,
    ready_for_pickup: 3,
    out_for_delivery: 3,
    completed: 4,
  };
  const rank = statusRank[order.status] ?? 0;
  if (rx) steps.push({ key: 'rx', label: 'Rx checked', done: rank >= 1 });
  else steps.push({ key: 'accepted', label: 'Confirmed', done: rank >= 1 });
  if (mobile)
    steps.push({
      key: 'payment',
      label: 'Paid',
      done: order.paymentStatus === 'paid' || order.paymentStatus === 'refunded' || rank >= 2,
    });
  steps.push({ key: 'preparing', label: 'Preparing', done: rank >= 2 });
  steps.push({ key: 'handover', label: delivery ? 'On the way' : 'Ready', done: rank >= 3 });
  steps.push({ key: 'completed', label: delivery ? 'Delivered' : 'Picked up', done: rank >= 4 });
  // Like the restaurant tracker, the step the order has reached is the
  // highlighted one; the order's finished only once it's completed.
  const firstOpen = steps.findIndex((s) => !s.done);
  const reached = firstOpen < 0 ? steps.length - 1 : firstOpen - 1;
  const finished = order.status === 'completed';
  return steps.map((s, i) => ({
    key: s.key,
    label: s.label,
    state: i === reached && !finished ? 'current' : s.done ? 'done' : 'upcoming',
  }));
}

export const PAYMENT_STATUS_COPY: Record<PharmacyPaymentStatus, string> = {
  pay_on_collection: 'Pay in cash when you get your order',
  awaiting_payment: 'Waiting for your payment',
  awaiting_verification: 'The pharmacy is checking your payment',
  paid: 'Paid',
  failed: "The pharmacy couldn't find your payment",
  refund_due: 'Refund on the way',
  refunded: 'Refunded',
};

/** Order status in the same words the restaurant orders use. */
export const PHARMACY_ORDER_STATUS_LABELS: Record<string, string> = {
  pending: 'Pending',
  under_review: 'Checking prescription',
  accepted: 'Confirmed',
  preparing: 'Preparing',
  ready_for_pickup: 'Ready',
  out_for_delivery: 'Out for delivery',
  completed: 'Completed',
  rejected: 'Declined',
  cancelled: 'Cancelled',
};

/** Same colours as the restaurant order badge. */
export function pharmacyStatusBadgeClass(status: string) {
  if (['accepted', 'preparing', 'ready_for_pickup', 'out_for_delivery'].includes(status))
    return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300';
  if (status === 'pending' || status === 'under_review')
    return 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300';
  if (status === 'rejected') return 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300';
  return 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300';
}

/** Short payment badge, matching the restaurant one ("Cash · Paid"). */
export const PHARMACY_PAYMENT_BADGES: Record<PharmacyPaymentStatus, { label: string; style: string }> = {
  pay_on_collection: { label: 'Pay on delivery', style: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300' },
  awaiting_payment: { label: 'Not paid yet', style: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300' },
  awaiting_verification: { label: 'Payment being verified', style: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200' },
  paid: { label: 'Paid', style: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200' },
  failed: { label: 'Payment not found', style: 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-200' },
  refund_due: { label: 'Refund due', style: 'bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-200' },
  refunded: { label: 'Refunded', style: 'bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-200' },
};

export function pharmacyPaymentBadge(order: Pick<PharmacyOrder, 'paymentStatus' | 'fulfillmentMethod'>) {
  const status = order.paymentStatus ?? 'pay_on_collection';
  const badge = PHARMACY_PAYMENT_BADGES[status];
  if (status === 'pay_on_collection' && order.fulfillmentMethod !== 'delivery')
    return { ...badge, label: 'Pay at pickup' };
  return badge;
}

export const TIMELINE_LABELS: Record<string, string> = {
  placed: 'Order placed',
  accepted: 'Pharmacy accepted',
  preparing: 'Being prepared',
  ready_for_pickup: 'Ready to collect',
  out_for_delivery: 'Out for delivery',
  completed: 'Completed',
  cancelled: 'Cancelled',
  rejected: 'Not accepted',
  restored: 'Order restored',
  rx_accepted: 'Prescription approved',
  rx_rejected: 'Prescription not accepted',
  rx_clarification: 'Pharmacist asked a question',
  rx_resubmitted: 'New prescription sent',
  payment_submitted: 'Payment sent',
  payment_confirmed: 'Payment confirmed',
  payment_failed: 'Payment not found',
  refunded: 'Refund sent',
};
