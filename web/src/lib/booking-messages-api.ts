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

// Edits the sender's own message — the API stamps `editedAt`, which both
// participants see as an "(edited)" marker.
export function updateBookingMessage(
  token: string,
  bookingId: string,
  messageId: string,
  body: string,
): Promise<BookingMessage> {
  return apiRequest<BookingMessage>(`/bookings/${bookingId}/messages/${messageId}`, {
    method: 'PATCH',
    headers: authHeader(token),
    body: JSON.stringify({ body }),
  });
}

// Soft-deletes the sender's own message — the row stays server-side, but
// every future fetch returns it with `body: null`, so render a "This
// message was deleted" placeholder rather than removing it from the
// thread outright (same as WhatsApp/Messenger).
export function deleteBookingMessage(token: string, bookingId: string, messageId: string): Promise<{ success: true }> {
  return apiRequest<{ success: true }>(`/bookings/${bookingId}/messages/${messageId}`, {
    method: 'DELETE',
    headers: authHeader(token),
  });
}
