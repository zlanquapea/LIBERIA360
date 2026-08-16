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
