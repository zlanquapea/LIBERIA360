import type { Booking } from './types';
import { apiRequest, authHeader } from './http';

// Exactly one of businessId/creatorId/carListingId — see the Booking
// type's doc comment. withDriver/pickupLocation only mean anything
// alongside carListingId.
export interface CreateBookingInput {
  businessId?: string;
  creatorId?: string;
  carListingId?: string;
  requestedDate: string;
  requestedEndDate?: string;
  partySize?: number;
  withDriver?: boolean;
  pickupLocation?: string;
  notes?: string;
}

export function createBooking(token: string, input: CreateBookingInput): Promise<Booking> {
  return apiRequest<Booking>('/bookings', {
    method: 'POST',
    headers: authHeader(token),
    body: JSON.stringify(input),
  });
}

export function getMyBookings(token: string): Promise<Booking[]> {
  return apiRequest<Booking[]>('/bookings/mine', { headers: authHeader(token) });
}

export function getBusinessBookings(token: string, businessId: string): Promise<Booking[]> {
  return apiRequest<Booking[]>(`/bookings/business/${businessId}`, { headers: authHeader(token) });
}

export function getCreatorBookings(token: string, creatorId: string): Promise<Booking[]> {
  return apiRequest<Booking[]>(`/bookings/creator/${creatorId}`, { headers: authHeader(token) });
}

export function respondToBooking(
  token: string,
  bookingId: string,
  action: 'confirm' | 'decline',
  message?: string,
): Promise<Booking> {
  return apiRequest<Booking>(`/bookings/${bookingId}/respond`, {
    method: 'PATCH',
    headers: authHeader(token),
    body: JSON.stringify({ action, message }),
  });
}

export function cancelBooking(token: string, bookingId: string): Promise<Booking> {
  return apiRequest<Booking>(`/bookings/${bookingId}/cancel`, {
    method: 'PATCH',
    headers: authHeader(token),
  });
}
