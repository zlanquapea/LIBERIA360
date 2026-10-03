import { formatMoney } from './currency';
import type {
  FoodFulfillment,
  FoodOrder,
  FoodOrderStatus,
  FoodPaymentMethod,
  FoodPaymentStatus,
  MenuSettings,
} from './types';

// Client mirror of the API's ordering rules (food-orders/order-pricing.ts).
// The server always recomputes fees and checks methods; these exist so the
// checkout shows the same numbers before the order is sent.

export function defaultMenuSettings(businessId: string): MenuSettings {
  return {
    businessId,
    currency: 'USD',
    pickupEnabled: true,
    deliveryEnabled: false,
    deliveryFee: 0,
    freeDeliveryMinimum: null,
    deliveryAreas: null,
    deliveryEstimate: null,
    cashEnabled: true,
    mtnMomoNumber: null,
    orangeMoneyNumber: null,
    mobileMoneyName: null,
  };
}

export function deliveryFeeFor(
  settings: Pick<MenuSettings, 'deliveryFee' | 'freeDeliveryMinimum'>,
  subtotal: number,
): number {
  if (settings.freeDeliveryMinimum !== null && subtotal >= settings.freeDeliveryMinimum) return 0;
  return Number(settings.deliveryFee) || 0;
}

export function fulfillmentOptions(settings: MenuSettings): FoodFulfillment[] {
  const options: FoodFulfillment[] = [];
  if (settings.deliveryEnabled) options.push('delivery');
  if (settings.pickupEnabled) options.push('pickup');
  return options;
}

export const PAYMENT_METHOD_LABELS: Record<FoodPaymentMethod, string> = {
  cash: 'Cash',
  mtn_momo: 'MTN MoMo',
  orange_money: 'Orange Money',
};

export function paymentAccountFor(settings: MenuSettings, method: FoodPaymentMethod): string | null {
  if (method === 'mtn_momo') return settings.mtnMomoNumber;
  if (method === 'orange_money') return settings.orangeMoneyNumber;
  return null;
}

export function acceptedPaymentMethods(settings: MenuSettings): FoodPaymentMethod[] {
  const methods: FoodPaymentMethod[] = [];
  if (settings.mtnMomoNumber) methods.push('mtn_momo');
  if (settings.orangeMoneyNumber) methods.push('orange_money');
  if (settings.cashEnabled) methods.push('cash');
  return methods;
}

export function isMobileMoney(method: FoodPaymentMethod): boolean {
  return method !== 'cash';
}

/** "Free", "US$2.00", or "US$2.00 · free over US$25.00". */
export function deliveryFeeShort(settings: MenuSettings): string {
  const fee = Number(settings.deliveryFee) || 0;
  if (fee === 0) return 'Free';
  const base = formatMoney(fee, settings.currency);
  return settings.freeDeliveryMinimum !== null
    ? `${base} · free over ${formatMoney(settings.freeDeliveryMinimum, settings.currency)}`
    : base;
}

/** "Free delivery", "Delivery US$2.00", or "Delivery US$2.00 · free over US$25.00". */
export function describeDeliveryFee(settings: MenuSettings): string {
  const short = deliveryFeeShort(settings);
  return short === 'Free' ? 'Free delivery' : `Delivery ${short}`;
}

export const FOOD_PAYMENT_STATUS_LABELS: Record<FoodPaymentStatus, string> = {
  pay_on_delivery: 'Pay on delivery',
  awaiting_verification: 'Payment being verified',
  paid: 'Paid',
  failed: 'Payment not found',
  refund_due: 'Refund due',
  refunded: 'Refunded',
};

export const FOOD_PAYMENT_STATUS_STYLES: Record<FoodPaymentStatus, string> = {
  pay_on_delivery: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
  awaiting_verification: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200',
  paid: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200',
  failed: 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-200',
  refund_due: 'bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-200',
  refunded: 'bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-200',
};

/** Payment status in the customer's words; cash orders read "Pay at pickup"
 * when they aren't being delivered. */
export function paymentStatusLabel(order: Pick<FoodOrder, 'paymentStatus' | 'fulfillment'>): string {
  if (order.paymentStatus === 'pay_on_delivery' && order.fulfillment === 'pickup') return 'Pay at pickup';
  return FOOD_PAYMENT_STATUS_LABELS[order.paymentStatus];
}

export interface TrackerStep {
  status: FoodOrderStatus;
  label: string;
}

/** The happy path an order moves through, for the progress tracker. */
export function trackerSteps(fulfillment: FoodFulfillment): TrackerStep[] {
  return [
    { status: 'pending', label: 'Placed' },
    { status: 'confirmed', label: 'Confirmed' },
    { status: 'preparing', label: 'Preparing' },
    fulfillment === 'delivery'
      ? { status: 'out_for_delivery', label: 'On the way' }
      : { status: 'ready', label: 'Ready' },
    { status: 'completed', label: fulfillment === 'delivery' ? 'Delivered' : 'Picked up' },
  ];
}

/** Index of the tracker step an order has reached, or -1 when it left the
 * happy path (declined or cancelled). */
export function trackerIndex(order: Pick<FoodOrder, 'status' | 'fulfillment'>): number {
  return trackerSteps(order.fulfillment).findIndex((step) => step.status === order.status);
}

/** What the owner can move an order to next, in the order they'd do it. */
export function nextOwnerSteps(
  order: Pick<FoodOrder, 'status' | 'fulfillment'>,
): { status: 'preparing' | 'ready' | 'out_for_delivery' | 'completed'; label: string }[] {
  const handoff =
    order.fulfillment === 'delivery'
      ? ({ status: 'out_for_delivery', label: 'Send out for delivery' } as const)
      : ({ status: 'ready', label: 'Mark ready for pickup' } as const);
  const complete = {
    status: 'completed',
    label: order.fulfillment === 'delivery' ? 'Mark delivered' : 'Mark picked up',
  } as const;
  switch (order.status) {
    case 'confirmed':
      return [{ status: 'preparing', label: 'Start preparing' }, handoff];
    case 'preparing':
      return [handoff, complete];
    case 'ready':
    case 'out_for_delivery':
      return [complete];
    default:
      return [];
  }
}

export interface CheckoutState {
  fulfillment: FoodFulfillment;
  deliveryAddress: string;
  contactPhone: string;
  paymentMethod: FoodPaymentMethod;
  // Mobile money transaction ID.
  paymentReference: string;
}

/** Delivery when offered (it's what most people come for), and cash when
 * accepted since it needs no extra step. */
export function initialCheckout(settings: MenuSettings, saved?: Partial<CheckoutState>): CheckoutState {
  const methods = acceptedPaymentMethods(settings);
  return {
    fulfillment: fulfillmentOptions(settings)[0] ?? 'pickup',
    deliveryAddress: saved?.deliveryAddress ?? '',
    contactPhone: saved?.contactPhone ?? '',
    paymentMethod: methods.includes('cash') ? 'cash' : (methods[0] ?? 'cash'),
    paymentReference: '',
  };
}

// Mirrors the API's contactPhone validation.
const PHONE = /^\+?[0-9][0-9 -]{5,18}[0-9]$/;

/** First thing stopping the order from being placed, or null. */
export function checkoutError(state: CheckoutState): string | null {
  if (state.fulfillment === 'delivery' && !state.deliveryAddress.trim()) {
    return 'Add the address to deliver to';
  }
  const phone = state.contactPhone.trim();
  if (state.fulfillment === 'delivery' && !phone) return 'Add a phone number so the rider can reach you';
  if (phone && !PHONE.test(phone)) return 'Check the phone number';
  if (isMobileMoney(state.paymentMethod) && !state.paymentReference.trim()) {
    return `Enter the ${PAYMENT_METHOD_LABELS[state.paymentMethod]} transaction ID`;
  }
  return null;
}

export function checkoutTotals(
  settings: MenuSettings,
  fulfillment: FoodFulfillment,
  subtotal: number,
): { deliveryFee: number; total: number } {
  const deliveryFee = fulfillment === 'delivery' ? deliveryFeeFor(settings, subtotal) : 0;
  return { deliveryFee, total: Math.round((subtotal + deliveryFee) * 100) / 100 };
}

/** Name for cash that fits how the food arrives. */
export function cashLabel(fulfillment: FoodFulfillment): string {
  return fulfillment === 'delivery' ? 'Cash on delivery' : 'Pay at pickup';
}

// Address and phone are remembered on this device so repeat orders are one
// tap. Never the payment details.
const CONTACT_KEY = 'liberia360:delivery-contact';

export function loadSavedContact(): Partial<CheckoutState> {
  try {
    const raw = window.localStorage.getItem(CONTACT_KEY);
    const parsed = raw ? (JSON.parse(raw) as Record<string, unknown>) : {};
    return {
      deliveryAddress: typeof parsed.deliveryAddress === 'string' ? parsed.deliveryAddress : undefined,
      contactPhone: typeof parsed.contactPhone === 'string' ? parsed.contactPhone : undefined,
    };
  } catch {
    return {};
  }
}

export function saveContact(state: Pick<CheckoutState, 'deliveryAddress' | 'contactPhone'>): void {
  try {
    window.localStorage.setItem(
      CONTACT_KEY,
      JSON.stringify({ deliveryAddress: state.deliveryAddress.trim(), contactPhone: state.contactPhone.trim() }),
    );
  } catch {
    // Storage blocked: nothing to remember, nothing breaks.
  }
}
