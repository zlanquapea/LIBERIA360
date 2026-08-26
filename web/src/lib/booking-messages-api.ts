import type { BookingMessage } from './types';
import { apiRequest, authHeader } from './http';

export function getBookingMessages(token: string, bookingId: string): Promise<BookingMessage[]> {
  return apiRequest<BookingMessage[]>(`/bookings/${bookingId}/messages`, {
    headers: authHeader(token),
  });
}

export function sendBookingMessage(
  token: string,
  bookingId: string,
  body: string,
): Promise<BookingMessage> {
  return apiRequest<BookingMessage>(`/bookings/${bookingId}/messages`, {
    method: 'POST',
    headers: authHeader(token),
    body: JSON.stringify({ body }),
  });
}

// Marks every message the *other* participant sent on this booking as
// read — call this once the current user has the thread open, so their
// counterpart's messages flip from "Delivered" to "Viewed" on their end.
export function markBookingMessagesRead(token: string, bookingId: string): Promise<{ success: true }> {
  return apiRequest<{ success: true }>(`/bookings/${bookingId}/messages/read`, {
    method: 'PATCH',
    headers: authHeader(token),
  });
}
