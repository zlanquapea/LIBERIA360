import {
  TripBookingPaymentStatus,
  TripBookingStatus,
} from "./entities/group-trip.enums";

const CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

/** Short booking code a traveller can read out at the bus: no 0/O, 1/I/L. */
export function tripBookingCode(random: () => number = Math.random): string {
  return Array.from(
    { length: 6 },
    () => CODE_ALPHABET[Math.floor(random() * CODE_ALPHABET.length)],
  ).join("");
}

/** What a ticket's QR code carries. */
export const ticketQrPayload = (code: string) => `LIB360-TRIP:${code}`;

export const round2 = (n: number) => Math.round(n * 100) / 100;

export const todayInLiberia = (now = new Date()) =>
  now.toISOString().slice(0, 10);

interface Money {
  status: TripBookingStatus;
  totalAmount: number;
  amountPaid: number;
  depositAmount: number | null;
  paymentStatus?: TripBookingPaymentStatus;
}

export const outstanding = (b: Money) =>
  round2(Math.max(0, b.totalAmount - b.amountPaid));

/** How much must be in before the spot is safe: the deposit when the
 * traveller chose one, otherwise the full price. */
export const amountToHold = (b: Money) => b.depositAmount ?? b.totalAmount;

/** Money on a booking, worked out from what has actually been received. */
export function paymentStatusFor(b: Money): TripBookingPaymentStatus {
  if (b.totalAmount === 0 && b.amountPaid === 0)
    return TripBookingPaymentStatus.FREE;
  const ended =
    b.status === TripBookingStatus.CANCELLED ||
    b.status === TripBookingStatus.DECLINED;
  if (ended) {
    if (b.paymentStatus === TripBookingPaymentStatus.REFUNDED)
      return TripBookingPaymentStatus.REFUNDED;
    return b.amountPaid > 0
      ? TripBookingPaymentStatus.REFUND_DUE
      : TripBookingPaymentStatus.UNPAID;
  }
  if (b.amountPaid >= b.totalAmount) return TripBookingPaymentStatus.PAID;
  if (b.amountPaid > 0) return TripBookingPaymentStatus.PART_PAID;
  return TripBookingPaymentStatus.UNPAID;
}

/** Spots still free once pending and confirmed bookings are counted. */
export const spotsLeft = (spots: number, heldSeats: number) =>
  Math.max(0, spots - heldSeats);
