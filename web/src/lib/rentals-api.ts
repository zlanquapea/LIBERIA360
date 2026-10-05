import { apiRequest } from "./http";

export type RentalStatus =
  | "requested"
  | "confirmed"
  | "on_trip"
  | "returned"
  | "declined"
  | "cancelled"
  | "no_show";
export type RentalUnit = "day" | "hour";
export type RentalPaymentMethod = "cash_at_pickup" | "mtn_momo" | "orange_money";
export type RentalPaymentStatus =
  | "pay_at_pickup"
  | "awaiting_verification"
  | "paid"
  | "failed"
  | "refund_due"
  | "refunded";
export type FuelLevel = "empty" | "quarter" | "half" | "three_quarters" | "full";
export type ExtraCharge = { label: string; amount: number };

export type RentalPaymentOption = { method: RentalPaymentMethod; label: string; account: string | null };

export type RentalTerms = {
  paymentOptions: RentalPaymentOption[];
  mobileMoneyAccountName: string | null;
  depositAmount: number | null;
  minDriverAge: number | null;
  instantBook: boolean;
};

export type Rental = {
  id: string;
  code: string;
  status: RentalStatus;
  rentalUnit: RentalUnit;
  pickupDate: string;
  returnDate: string;
  pickupTime: string;
  returnTime: string;
  units: number;
  dueBackAt: string;
  overdue: boolean;
  withDriver: boolean;
  additionalDriver: boolean;
  delivery: boolean;
  deliveryAddress: string | null;
  renterName: string;
  renterPhone: string;
  licenceNumber: string | null;
  notes: string | null;
  carListingId: string | null;
  carTitle: string;
  carImage: string | null;
  pickupLocation: string | null;
  unitPrice: number;
  baseAmount: number;
  driverFee: number;
  additionalDriverFee: number;
  deliveryFee: number;
  totalAmount: number;
  depositAmount: number | null;
  mileageLimitPerDay: number | null;
  excessMileageFee: number | null;
  currency: string;
  paymentMethod: RentalPaymentMethod;
  paymentStatus: RentalPaymentStatus;
  paymentReference: string | null;
  paymentAccount: string | null;
  ownerNote: string | null;
  pickedUpAt: string | null;
  pickupOdometer: number | null;
  pickupFuel: FuelLevel | null;
  pickupNotes: string | null;
  licenceChecked: boolean;
  depositCollected: number | null;
  returnedAt: string | null;
  returnOdometer: number | null;
  returnFuel: FuelLevel | null;
  returnNotes: string | null;
  extraCharges: ExtraCharge[];
  extrasTotal: number;
  depositReturned: number | null;
  confirmedAt: string | null;
  cancelledAt: string | null;
  createdAt: string;
  owner: { phone: string | null; whatsapp: string | null };
  viewerRole: "renter" | "owner";
  unreadMessages: number;
};

export type FleetCarState = "free" | "going_out" | "out" | "overdue" | "blocked";

export type FleetDesk = {
  date: string;
  fleet: Array<{
    id: string;
    title: string;
    image: string | null;
    active: boolean;
    state: FleetCarState;
    rentalId: string | null;
  }>;
  requests: Rental[];
  pickups: Rental[];
  onTrip: Rental[];
  dueBack: Rental[];
  upcoming: Rental[];
  refundsDue: Rental[];
};

export type FleetDayState = "free" | "requested" | "booked" | "out" | "blocked";

export type FleetCalendar = {
  from: string;
  dates: string[];
  cars: Array<{
    id: string;
    title: string;
    days: Array<{ date: string; state: FleetDayState; rentalId: string | null; label: string | null; blockId?: string }>;
  }>;
};

export type RentalSettings = {
  ownerUserId: string;
  cashAtPickupEnabled: boolean;
  mtnMomoNumber: string | null;
  orangeMoneyNumber: string | null;
  mobileMoneyAccountName: string | null;
};

export type RentalMessage = {
  id: string;
  body: string;
  mine: boolean;
  senderName: string | null;
  createdAt: string;
  readAt: string | null;
};

export type BookRentalInput = {
  carListingId: string;
  rentalUnit: RentalUnit;
  pickupDate: string;
  returnDate?: string;
  pickupTime: string;
  returnTime: string;
  withDriver?: boolean;
  additionalDriver?: boolean;
  delivery?: boolean;
  deliveryAddress?: string;
  renterName: string;
  renterPhone: string;
  licenceNumber?: string;
  ageConfirmed?: boolean;
  notes?: string;
  paymentMethod: RentalPaymentMethod;
  paymentReference?: string;
};

export type HandoverInput = {
  licenceChecked: boolean;
  odometer?: number;
  fuel?: FuelLevel;
  depositCollected?: number;
  notes?: string;
  paymentCollected?: boolean;
};

export type ReturnInput = {
  odometer?: number;
  fuel?: FuelLevel;
  notes?: string;
  extraCharges?: ExtraCharge[];
  depositReturned?: number;
};

const json = (method: string, body?: unknown): RequestInit => ({
  method,
  ...(body === undefined ? {} : { body: JSON.stringify(body) }),
});

export const getRentalTerms = (carListingId: string) =>
  apiRequest<RentalTerms>(`/rentals/terms/${carListingId}`);
export const bookRental = (body: BookRentalInput) => apiRequest<Rental>("/rentals", json("POST", body));
export const getMyRentals = () => apiRequest<Rental[]>("/rentals/mine");
export const getRental = (id: string) => apiRequest<Rental>(`/rentals/${id}`);
export const cancelRental = (id: string) => apiRequest<Rental>(`/rentals/${id}/cancel`, json("POST"));
export const resendRentalPayment = (id: string, paymentReference: string) =>
  apiRequest<Rental>(`/rentals/${id}/payment`, json("POST", { paymentReference }));
export const getRentalMessages = (id: string) => apiRequest<RentalMessage[]>(`/rentals/${id}/messages`);
export const sendRentalMessage = (id: string, body: string) =>
  apiRequest<RentalMessage>(`/rentals/${id}/messages`, json("POST", { body }));

export const getFleetDesk = () => apiRequest<FleetDesk>("/rentals/fleet/desk");
export const getFleetRentals = () => apiRequest<Rental[]>("/rentals/fleet/list");
export const getFleetCalendar = (from: string, days = 14) =>
  apiRequest<FleetCalendar>(`/rentals/fleet/calendar?from=${from}&days=${days}`);
export const getRentalSettings = () => apiRequest<RentalSettings>("/rentals/fleet/settings");
export const saveRentalSettings = (body: Partial<RentalSettings>) =>
  apiRequest<RentalSettings>("/rentals/fleet/settings", json("PUT", body));
export const respondToRental = (id: string, action: "confirm" | "decline", message?: string) =>
  apiRequest<Rental>(`/rentals/${id}/respond`, json("POST", { action, message }));
export const verifyRentalPayment = (id: string, received: boolean) =>
  apiRequest<Rental>(`/rentals/${id}/payment`, json("PATCH", { received }));
export const handOverCar = (id: string, body: HandoverInput) =>
  apiRequest<Rental>(`/rentals/${id}/handover`, json("POST", body));
export const returnCar = (id: string, body: ReturnInput) =>
  apiRequest<Rental>(`/rentals/${id}/return`, json("POST", body));
export const markRentalNoShow = (id: string) => apiRequest<Rental>(`/rentals/${id}/no-show`, json("POST"));
export const markRentalRefunded = (id: string) => apiRequest<Rental>(`/rentals/${id}/refunded`, json("PATCH"));
