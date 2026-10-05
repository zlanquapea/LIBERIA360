import { apiRequest } from "./http";

export type StayCurrency = "USD" | "LRD";
export type ReservationStatus =
  | "requested"
  | "confirmed"
  | "checked_in"
  | "checked_out"
  | "declined"
  | "cancelled"
  | "no_show";
export type StayPaymentMethod = "pay_at_property" | "mtn_momo" | "orange_money";
export type StayPaymentStatus =
  | "pay_at_property"
  | "awaiting_verification"
  | "paid"
  | "failed"
  | "refund_due"
  | "refunded";

export type PublicRoomType = {
  id: string;
  name: string;
  description: string | null;
  images: string[];
  maxGuests: number;
  bedSummary: string | null;
  pricePerNight: number;
  amenities: string[];
};

export type RoomType = PublicRoomType & {
  businessId: string;
  totalRooms: number;
  isActive: boolean;
  sortOrder: number;
};

export type PaymentOption = { method: StayPaymentMethod; label: string; account: string | null };

export type PublicStay = {
  currency: StayCurrency;
  checkInTime: string;
  checkOutTime: string;
  instantConfirm: boolean;
  cancellationPolicy: string | null;
  houseRules: string | null;
  mobileMoneyAccountName: string | null;
  paymentOptions: PaymentOption[];
  roomTypes: PublicRoomType[];
};

export type StayAvailability = {
  checkIn: string;
  checkOut: string;
  nights: number;
  rooms: Array<{ roomTypeId: string; roomsLeft: number; total: number }>;
};

export type StaySettings = {
  businessId: string;
  currency: StayCurrency;
  checkInTime: string;
  checkOutTime: string;
  instantConfirm: boolean;
  payAtPropertyEnabled: boolean;
  mtnMomoNumber: string | null;
  orangeMoneyNumber: string | null;
  mobileMoneyAccountName: string | null;
  cancellationPolicy: string | null;
  houseRules: string | null;
};

export type Reservation = {
  id: string;
  code: string;
  source: "online" | "walk_in";
  status: ReservationStatus;
  checkIn: string;
  checkOut: string;
  nights: number;
  rooms: number;
  adults: number;
  children: number;
  guestName: string;
  guestPhone: string | null;
  arrivalTime: string | null;
  specialRequests: string | null;
  roomTypeId: string | null;
  roomName: string;
  roomImage: string | null;
  pricePerNight: number;
  totalAmount: number;
  currency: StayCurrency;
  paymentMethod: StayPaymentMethod;
  paymentStatus: StayPaymentStatus;
  paymentReference: string | null;
  paymentAccount: string | null;
  propertyNote: string | null;
  roomNumbers: string | null;
  confirmedAt: string | null;
  checkedInAt: string | null;
  checkedOutAt: string | null;
  cancelledAt: string | null;
  createdAt: string;
  property: {
    id: string;
    name: string;
    slug: string;
    phone: string | null;
    whatsapp: string | null;
    image: string | null;
    address: string | null;
    latitude: number | null;
    longitude: number | null;
  };
  viewerRole: "guest" | "property";
  unreadMessages: number;
};

export type OccupancyTile = {
  id: string;
  name: string;
  totalRooms: number;
  booked: number;
  blocked: number;
  left: number;
};

export type FrontDesk = {
  date: string;
  occupancy: OccupancyTile[];
  requests: Reservation[];
  arrivals: Reservation[];
  inHouse: Reservation[];
  departures: Reservation[];
  upcoming: Reservation[];
  refundsDue: Reservation[];
};

export type RoomBlock = { id: string; startDate: string; endDate: string; rooms: number; reason: string | null };

export type StayCalendar = {
  from: string;
  nights: string[];
  roomTypes: Array<{
    id: string;
    name: string;
    totalRooms: number;
    nights: Array<{ date: string; booked: number; blocked: number; left: number }>;
    blocks: RoomBlock[];
  }>;
};

export type ReservationMessage = {
  id: string;
  body: string;
  mine: boolean;
  senderName: string | null;
  createdAt: string;
  readAt: string | null;
};

export type RoomTypeInput = {
  name: string;
  description?: string | null;
  images?: string[];
  maxGuests: number;
  bedSummary?: string | null;
  pricePerNight: number;
  totalRooms: number;
  amenities?: string[];
  isActive?: boolean;
};

export type ReserveInput = {
  roomTypeId: string;
  checkIn: string;
  checkOut: string;
  rooms: number;
  adults: number;
  children?: number;
  guestName: string;
  guestPhone: string;
  arrivalTime?: string;
  specialRequests?: string;
  paymentMethod: StayPaymentMethod;
  paymentReference?: string;
};

export type WalkInInput = {
  roomTypeId: string;
  checkOut: string;
  rooms: number;
  adults: number;
  guestName: string;
  guestPhone?: string;
  roomNumbers?: string;
  paid?: boolean;
};

const json = (method: string, body?: unknown): RequestInit => ({
  method,
  ...(body === undefined ? {} : { body: JSON.stringify(body) }),
});

// Guest
export const getStay = (businessId: string) => apiRequest<PublicStay>(`/stays/${businessId}`);
export const getStayAvailability = (businessId: string, checkIn: string, checkOut: string) =>
  apiRequest<StayAvailability>(
    `/stays/${businessId}/availability?checkIn=${encodeURIComponent(checkIn)}&checkOut=${encodeURIComponent(checkOut)}`,
  );
export const reserveRoom = (body: ReserveInput) => apiRequest<Reservation>("/stays/reservations", json("POST", body));
export const getMyStays = () => apiRequest<Reservation[]>("/stays/reservations/mine");
export const getReservation = (id: string) => apiRequest<Reservation>(`/stays/reservations/${id}`);
export const cancelReservation = (id: string) =>
  apiRequest<Reservation>(`/stays/reservations/${id}/cancel`, json("POST"));
export const resendStayPayment = (id: string, paymentReference: string) =>
  apiRequest<Reservation>(`/stays/reservations/${id}/payment`, json("POST", { paymentReference }));
export const getReservationMessages = (id: string) =>
  apiRequest<ReservationMessage[]>(`/stays/reservations/${id}/messages`);
export const sendReservationMessage = (id: string, body: string) =>
  apiRequest<ReservationMessage>(`/stays/reservations/${id}/messages`, json("POST", { body }));

// Property
export const respondToReservation = (id: string, action: "confirm" | "decline", message?: string) =>
  apiRequest<Reservation>(`/stays/reservations/${id}/respond`, json("POST", { action, message }));
export const verifyStayPayment = (id: string, received: boolean) =>
  apiRequest<Reservation>(`/stays/reservations/${id}/payment`, json("PATCH", { received }));
export const checkInGuest = (id: string, roomNumbers?: string) =>
  apiRequest<Reservation>(`/stays/reservations/${id}/check-in`, json("POST", { roomNumbers }));
export const checkOutGuest = (id: string) =>
  apiRequest<Reservation>(`/stays/reservations/${id}/check-out`, json("POST"));
export const markNoShow = (id: string) => apiRequest<Reservation>(`/stays/reservations/${id}/no-show`, json("POST"));
export const markStayRefunded = (id: string) =>
  apiRequest<Reservation>(`/stays/reservations/${id}/refunded`, json("PATCH"));

export const getStayManagement = (businessId: string) =>
  apiRequest<{ settings: StaySettings; roomTypes: RoomType[] }>(`/stays/manage/${businessId}`);
export const saveStaySettings = (businessId: string, body: Partial<StaySettings>) =>
  apiRequest<StaySettings>(`/stays/manage/${businessId}/settings`, json("PUT", body));
export const createRoomType = (businessId: string, body: RoomTypeInput) =>
  apiRequest<RoomType>(`/stays/manage/${businessId}/room-types`, json("POST", body));
export const updateRoomType = (businessId: string, id: string, body: RoomTypeInput) =>
  apiRequest<RoomType>(`/stays/manage/${businessId}/room-types/${id}`, json("PATCH", body));
export const deleteRoomType = (businessId: string, id: string) =>
  apiRequest<{ deleted: boolean; hidden: boolean }>(`/stays/manage/${businessId}/room-types/${id}`, json("DELETE"));
export const getStayCalendar = (businessId: string, from: string, days = 14) =>
  apiRequest<StayCalendar>(`/stays/manage/${businessId}/calendar?from=${from}&days=${days}`);
export const addRoomBlock = (
  businessId: string,
  body: { roomTypeId: string; startDate: string; endDate: string; rooms: number; reason?: string },
) => apiRequest<RoomBlock>(`/stays/manage/${businessId}/blocks`, json("POST", body));
export const removeRoomBlock = (businessId: string, blockId: string) =>
  apiRequest<{ removed: boolean }>(`/stays/manage/${businessId}/blocks/${blockId}`, json("DELETE"));
export const getFrontDesk = (businessId: string, date?: string) =>
  apiRequest<FrontDesk>(`/stays/manage/${businessId}/front-desk${date ? `?date=${date}` : ""}`);
export const getPropertyReservations = (businessId: string) =>
  apiRequest<Reservation[]>(`/stays/manage/${businessId}/reservations`);
export const recordWalkIn = (businessId: string, body: WalkInInput) =>
  apiRequest<Reservation>(`/stays/manage/${businessId}/walk-ins`, json("POST", body));
