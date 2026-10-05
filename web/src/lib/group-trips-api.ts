import { apiRequest } from "./http";
import type { TripHosting, TripOrganiser, TripPaymentMethod } from "./types";

export type { TripHosting, TripOrganiser, TripPaymentMethod };

export type TripBookingStatus = "pending" | "confirmed" | "waitlisted" | "declined" | "cancelled";
export type TripBookingPaymentStatus = "free" | "unpaid" | "part_paid" | "paid" | "refund_due" | "refunded";
export type TripPaymentRecordStatus = "awaiting_verification" | "received" | "rejected";
export type TripPaymentPlan = "full" | "deposit";

export type TripBookingPayment = {
  id: string;
  amount: number;
  method: TripPaymentMethod;
  reference: string | null;
  account: string | null;
  status: TripPaymentRecordStatus;
  recordedByHost: boolean;
  createdAt: string;
  verifiedAt: string | null;
};

export type TripBookingTrip = {
  id: string;
  title: string;
  startDate: string | null;
  endDate: string | null;
  coverImage: string | null;
  destination: { id: string; name: string; slug: string; county: string | null } | null;
  status: "upcoming" | "ongoing" | "completed" | "cancelled";
};

export type TripBooking = {
  id: string;
  code: string;
  status: TripBookingStatus;
  seats: number;
  travellers: Array<{ name: string; boarded: boolean }>;
  contactName: string;
  phone: string;
  notes: string | null;
  unitPrice: number;
  totalAmount: number;
  currency: "USD" | "LRD";
  depositAmount: number | null;
  paymentPlan: TripPaymentPlan;
  paymentMethod: TripPaymentMethod | null;
  amountPaid: number;
  outstanding: number;
  amountToHold: number;
  paymentStatus: TripBookingPaymentStatus;
  hostNote: string | null;
  confirmedAt: string | null;
  cancelledAt: string | null;
  createdAt: string;
  payments: TripBookingPayment[];
  traveller: { id: string; name: string };
  trip: TripBookingTrip;
  meetingPoint: string | null;
  departureTime: string | null;
  balanceDueDate: string | null;
  contactPhone: string | null;
  accountName: string | null;
  paymentOptions: TripHosting["paymentOptions"];
  viewerRole: "traveller" | "host";
  qrDataUrl: string | null;
};

export type TripDeskStats = {
  travellers: number;
  boarded: number;
  collected: number;
  expected: number;
  outstanding: number;
  paymentsToCheck: number;
  refundsDue: number;
};

export type TripDesk = {
  trip: TripBookingTrip;
  hosting: TripHosting | null;
  stats: TripDeskStats;
  bookings: TripBooking[];
};

export type HostingInput = {
  open?: boolean;
  tagline?: string | null;
  price: number;
  currency: "USD" | "LRD";
  depositAmount?: number | null;
  balanceDueDate?: string | null;
  bookingDeadline?: string | null;
  spots: number;
  maxPerBooking?: number;
  requireApproval?: boolean;
  includes?: string[];
  excludes?: string[];
  activities?: string[];
  meetingPoint?: string | null;
  departureTime?: string | null;
  organisers?: TripOrganiser[];
  gallery?: string[];
  goodToKnow?: string | null;
  contactPhone?: string | null;
  cashEnabled?: boolean;
  mtnMomoNumber?: string | null;
  orangeMoneyNumber?: string | null;
  accountName?: string | null;
  coverImage?: string | null;
};

export type BookTripInput = {
  seats: number;
  travellers: string[];
  contactName: string;
  phone: string;
  notes?: string;
  paymentPlan?: TripPaymentPlan;
  paymentMethod?: TripPaymentMethod;
  paymentReference?: string;
  joinWaitlist?: boolean;
};

const json = (method: string, body?: unknown): RequestInit => ({
  method,
  ...(body === undefined ? {} : { body: JSON.stringify(body) }),
});

export const saveTripHosting = (itineraryId: string, body: HostingInput) =>
  apiRequest<TripHosting>(`/itineraries/${itineraryId}/hosting`, json("PUT", body));
export const getTripDesk = (itineraryId: string) => apiRequest<TripDesk>(`/itineraries/${itineraryId}/hosting/desk`);
export const bookTrip = (itineraryId: string, body: BookTripInput) =>
  apiRequest<TripBooking>(`/itineraries/${itineraryId}/bookings`, json("POST", body));
export const getMyTripBooking = (itineraryId: string) =>
  apiRequest<TripBooking | null>(`/itineraries/${itineraryId}/my-booking`);
export const getMyTripBookings = () => apiRequest<TripBooking[]>("/trip-bookings/mine");
export const getTripBooking = (id: string) => apiRequest<TripBooking>(`/trip-bookings/${id}`);
export const payTripBooking = (id: string, body: { amount: number; method: TripPaymentMethod; reference?: string }) =>
  apiRequest<TripBooking>(`/trip-bookings/${id}/payments`, json("POST", body));
export const reviewTripPayment = (id: string, paymentId: string, received: boolean) =>
  apiRequest<TripBooking>(`/trip-bookings/${id}/payments/${paymentId}`, json("PATCH", { received }));
export const confirmTripBooking = (id: string, note?: string) =>
  apiRequest<TripBooking>(`/trip-bookings/${id}/confirm`, json("POST", { note }));
export const declineTripBooking = (id: string, note?: string) =>
  apiRequest<TripBooking>(`/trip-bookings/${id}/decline`, json("POST", { note }));
export const promoteTripBooking = (id: string) =>
  apiRequest<TripBooking>(`/trip-bookings/${id}/promote`, json("POST"));
export const cancelTripBooking = (id: string, note?: string) =>
  apiRequest<TripBooking>(`/trip-bookings/${id}/cancel`, json("POST", { note }));
export const boardTripBooking = (id: string, body: { traveller?: number; boarded: boolean }) =>
  apiRequest<TripBooking>(`/trip-bookings/${id}/board`, json("POST", body));
export const markTripRefunded = (id: string) =>
  apiRequest<TripBooking>(`/trip-bookings/${id}/refunded`, json("PATCH"));
