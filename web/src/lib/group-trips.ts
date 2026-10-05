import { formatMoney } from "./currency";
import type { OrderStep } from "@/components/orders/OrderStepper";
import type {
  TripBooking,
  TripBookingPaymentStatus,
  TripBookingStatus,
  TripHosting,
  TripPaymentMethod,
} from "./group-trips-api";

const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** Quick picks for "what's included" — organisers can add their own too. */
export const INCLUDE_PRESETS = [
  "Transportation",
  "Accommodation",
  "Breakfast & dinner",
  "All meals",
  "Tour guide",
  "Entrance fees",
  "Souvenirs",
  "T-shirt",
  "Drinks & water",
  "Photos",
  "Boat ride",
  "Security",
];

export const ACTIVITY_PRESETS = [
  "Historic tour",
  "Beach day",
  "Games",
  "Movies & karaoke",
  "Bonfire night",
  "Port tour",
  "Waterfall hike",
  "Village visit",
  "Local food tasting",
  "Canoe ride",
];

const ICONS: Array<[RegExp, string]> = [
  [/bus|transport|car|ride to|pickup/i, "🚌"],
  [/accommodation|hotel|lodge|room|stay|camp/i, "🛏️"],
  [/breakfast|lunch|dinner|meal|food|tasting|cook/i, "🍽️"],
  [/drink|water/i, "🥤"],
  [/souvenir|gift/i, "🎁"],
  [/guide/i, "🧭"],
  [/ticket|entrance|fee/i, "🎟️"],
  [/shirt/i, "👕"],
  [/photo|camera/i, "📸"],
  [/boat|canoe|kayak/i, "🛶"],
  [/security|safety|insurance|first aid/i, "🛡️"],
  [/histor|museum|heritage|monument/i, "🏛️"],
  [/game|sport|football|quiz/i, "🎲"],
  [/movie|film|cinema/i, "🎬"],
  [/karaoke|music|dance|party/i, "🎤"],
  [/port|ship|harbou?r/i, "⚓"],
  [/beach|swim|surf|sea/i, "🏖️"],
  [/hike|waterfall|trek|forest|nature/i, "🥾"],
  [/bonfire|fire/i, "🔥"],
  [/village|culture|community/i, "🛖"],
];

/** A friendly emoji for an included item or an activity. */
export function itemIcon(label: string, fallback = "✨") {
  return ICONS.find(([re]) => re.test(label))?.[1] ?? fallback;
}

export const PAYMENT_METHOD_LABELS: Record<TripPaymentMethod, string> = {
  cash: "Cash",
  mtn_momo: "MTN MoMo",
  orange_money: "Orange Money",
};

export const TRAVELLER_STATUS_LABELS: Record<TripBookingStatus, string> = {
  pending: "Waiting for the organiser",
  confirmed: "You're going",
  waitlisted: "On the waitlist",
  declined: "Not accepted",
  cancelled: "Cancelled",
};

export const HOST_STATUS_LABELS: Record<TripBookingStatus, string> = {
  pending: "To confirm",
  confirmed: "Confirmed",
  waitlisted: "Waitlist",
  declined: "Declined",
  cancelled: "Cancelled",
};

export const STATUS_STYLES: Record<TripBookingStatus, string> = {
  pending:
    "bg-amber-100 text-amber-900 dark:bg-amber-950/50 dark:text-amber-200",
  confirmed:
    "bg-emerald-100 text-emerald-900 dark:bg-emerald-950/50 dark:text-emerald-200",
  waitlisted: "bg-sky-100 text-sky-900 dark:bg-sky-950/50 dark:text-sky-200",
  declined: "bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
  cancelled:
    "bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
};

export const PAYMENT_BADGES: Record<
  TripBookingPaymentStatus,
  { label: string; style: string }
> = {
  free: {
    label: "Free",
    style:
      "bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200",
  },
  unpaid: {
    label: "Not paid yet",
    style:
      "bg-orange-100 text-orange-900 dark:bg-orange-950/50 dark:text-orange-200",
  },
  part_paid: {
    label: "Deposit paid",
    style: "bg-sky-100 text-sky-900 dark:bg-sky-950/50 dark:text-sky-200",
  },
  paid: {
    label: "Paid in full",
    style:
      "bg-emerald-100 text-emerald-900 dark:bg-emerald-950/50 dark:text-emerald-200",
  },
  refund_due: {
    label: "Refund due",
    style: "bg-red-100 text-red-900 dark:bg-red-950/50 dark:text-red-200",
  },
  refunded: {
    label: "Refunded",
    style: "bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
  },
};

/** "US$150" for whole amounts, "US$12.50" otherwise — how prices are written on trip posters. */
export const money = (amount: number, currency: "USD" | "LRD") =>
  Number.isInteger(amount)
    ? formatMoney(amount, currency).replace(/\.00$/, "")
    : formatMoney(amount, currency);

export function priceLabel(
  h: Pick<TripHosting, "isFree" | "price" | "currency">,
) {
  return h.isFree ? "Free" : money(h.price, h.currency);
}

/** "Only 3 spots left!" — the poster's scarcity line, from live counts. */
export function spotsMessage(h: Pick<TripHosting, "spots" | "spotsLeft">) {
  if (h.spotsLeft <= 0) return "Fully booked";
  if (h.spotsLeft >= h.spots) return `${h.spots} spots open`;
  if (h.spotsLeft === 1) return "Last spot!";
  if (h.spotsLeft <= Math.max(5, Math.ceil(h.spots * 0.2)))
    return `Only ${h.spotsLeft} spots left!`;
  return `${h.spotsLeft} of ${h.spots} spots left`;
}

/** The poster's headline line: "Only 30 slots available!" */
export function slotsHeadline(h: Pick<TripHosting, "spots" | "spotsLeft">) {
  if (h.spotsLeft <= 0) return "Fully booked — waitlist open";
  if (h.spotsLeft >= h.spots) return `Only ${h.spots} slots available!`;
  return `Only ${h.spotsLeft} of ${h.spots} slots left!`;
}

export function fillPercent(h: Pick<TripHosting, "spots" | "spotsLeft">) {
  return Math.min(
    100,
    Math.round(((h.spots - h.spotsLeft) / Math.max(1, h.spots)) * 100),
  );
}

const parts = (iso: string) => {
  const d = new Date(iso.length === 10 ? `${iso}T12:00:00Z` : iso);
  return {
    d,
    day: d.getUTCDate(),
    month: MONTHS[d.getUTCMonth()],
    year: d.getUTCFullYear(),
  };
};

/** "Oct 30 – Nov 1" or "Oct 30 – 31" — the same on server and phone. */
export function dateRange(start: string | null, end: string | null) {
  if (!start) return "Dates to be announced";
  const a = parts(start);
  if (!end) return `${a.month} ${a.day}`;
  const b = parts(end);
  if (a.month === b.month && a.day === b.day && a.year === b.year)
    return `${a.month} ${a.day}`;
  return a.month === b.month
    ? `${a.month} ${a.day} – ${b.day}`
    : `${a.month} ${a.day} – ${b.month} ${b.day}`;
}

/** "Fri 30 Oct" */
export function shortDate(iso: string) {
  const { d, day, month } = parts(iso);
  return `${WEEKDAYS[d.getUTCDay()]} ${day} ${month}`;
}

export function clock(hhmm: string | null) {
  if (!hhmm) return null;
  const [h, m] = hhmm.split(":").map(Number);
  const suffix = h >= 12 ? "pm" : "am";
  return `${h % 12 || 12}${m ? `:${String(m).padStart(2, "0")}` : ""}${suffix}`;
}

/** "Leaves in 12 days" — counted in whole Liberia (UTC) days. */
export function countdown(start: string | null, now = new Date()) {
  if (!start) return null;
  const today = Date.parse(`${now.toISOString().slice(0, 10)}T00:00:00Z`);
  const day = Date.parse(`${start.slice(0, 10)}T00:00:00Z`);
  const days = Math.round((day - today) / 864e5);
  if (days < 0) return null;
  if (days === 0) return "Leaving today";
  if (days === 1) return "Leaves tomorrow";
  return `Leaves in ${days} days`;
}

export function tripNights(start: string | null, end: string | null) {
  if (!start || !end) return null;
  const n = Math.round(
    (Date.parse(end.slice(0, 10)) - Date.parse(start.slice(0, 10))) / 864e5,
  );
  return n > 0 ? n : null;
}

/** A Liberian number as a WhatsApp link: 0886… becomes 231886…. */
export function whatsappLink(phone: string, text?: string) {
  const digits = phone.replace(/\D/g, "").replace(/^0/, "231");
  return `https://wa.me/${digits}${text ? `?text=${encodeURIComponent(text)}` : ""}`;
}

export const telLink = (phone: string) => `tel:${phone.replace(/[^\d+]/g, "")}`;

/** Booked → Paid → Confirmed → Trip day */
export function bookingSteps(
  b: Pick<TripBooking, "status" | "paymentStatus" | "trip">,
): OrderStep[] {
  const free = b.paymentStatus === "free";
  const paid = b.paymentStatus === "paid" || b.paymentStatus === "part_paid";
  const confirmed = b.status === "confirmed";
  const travelled =
    confirmed && (b.trip.status === "ongoing" || b.trip.status === "completed");
  const steps: Array<{ key: string; label: string; done: boolean }> = [
    { key: "booked", label: "Booked", done: true },
    ...(free
      ? []
      : [
          {
            key: "paid",
            label: b.paymentStatus === "part_paid" ? "Deposit in" : "Paid",
            done: paid || confirmed,
          },
        ]),
    { key: "confirmed", label: "Confirmed", done: confirmed },
    { key: "trip", label: "Trip day", done: travelled },
  ];
  const current = steps.findIndex((s) => !s.done);
  return steps.map((s, i) => ({
    key: s.key,
    label: s.label,
    state: s.done ? "done" : i === current ? "current" : "upcoming",
  }));
}

export const isActiveBooking = (b: Pick<TripBooking, "status">) =>
  b.status === "pending" ||
  b.status === "confirmed" ||
  b.status === "waitlisted";

/** What the booker owes now for the plan they picked. */
export function dueNow(
  h: Pick<TripHosting, "price" | "depositAmount">,
  seats: number,
  plan: "full" | "deposit",
) {
  const each =
    plan === "deposit" && h.depositAmount != null ? h.depositAmount : h.price;
  return Math.round(each * seats * 100) / 100;
}
