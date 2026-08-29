import type { EventTicketOrder, EventTicketOrderStatus } from './types';
import { apiRequest, authHeader } from './http';

export function createEventTicketOrder(
  token: string,
  eventId: string,
  input: { quantity: number; paymentReference: string; paymentNote?: string },
): Promise<EventTicketOrder> {
  return apiRequest<EventTicketOrder>(`/events/${eventId}/ticket-orders`, {
    method: 'POST',
    headers: authHeader(token),
    body: JSON.stringify(input),
  });
}

export function getMyTicketOrders(token: string): Promise<EventTicketOrder[]> {
  return apiRequest<EventTicketOrder[]>('/ticket-orders/mine', {
    headers: authHeader(token),
  });
}

export function getEventTicketOrders(token: string, eventId: string): Promise<EventTicketOrder[]> {
  return apiRequest<EventTicketOrder[]>(`/events/${eventId}/ticket-orders`, {
    headers: authHeader(token),
  });
}

export function reviewEventTicketOrder(
  token: string,
  id: string,
  status: Extract<EventTicketOrderStatus, 'approved' | 'rejected'>,
  reviewNote?: string,
): Promise<EventTicketOrder> {
  return apiRequest<EventTicketOrder>(`/ticket-orders/${id}/review`, {
    method: 'PATCH',
    headers: authHeader(token),
    body: JSON.stringify({ status, reviewNote }),
  });
}
