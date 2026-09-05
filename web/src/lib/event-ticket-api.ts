import type {
  EventTicketInstance,
  EventTicketMetrics,
  EventTicketOrder,
  EventTicketOrderStatus,
  EventTicketScanResult,
  MyTicketsResponse,
  TicketTransferPreview,
} from './types';
import { apiRequest, authHeader } from './http';

export function createEventTicketOrder(
  token: string,
  eventId: string,
  input: { quantity?: number; selections?: Array<{ ticketTypeId: string; quantity: number }>; paymentReference: string; paymentNote?: string },
): Promise<EventTicketOrder> {
  return apiRequest<EventTicketOrder>(`/events/${eventId}/ticket-orders`, {
    method: 'POST',
    headers: authHeader(token),
    body: JSON.stringify(input),
  });
}

export function getMyTicketOrders(token: string): Promise<MyTicketsResponse> {
  return apiRequest<MyTicketsResponse>('/ticket-orders/mine', {
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

export function redeemEventTicket(
  token: string,
  eventId: string,
  payload: string,
): Promise<EventTicketScanResult> {
  return apiRequest<EventTicketScanResult>(`/events/${eventId}/ticket-scan`, {
    method: 'POST',
    headers: authHeader(token),
    body: JSON.stringify({ payload }),
  });
}

export function getEventTicketMetrics(
  token: string,
  eventId: string,
): Promise<EventTicketMetrics> {
  return apiRequest<EventTicketMetrics>(`/events/${eventId}/ticket-metrics`, {
    headers: authHeader(token),
  });
}

export function voidEventTicket(
  token: string,
  instanceId: string,
): Promise<EventTicketInstance> {
  return apiRequest<EventTicketInstance>(`/ticket-instances/${instanceId}/void`, {
    method: 'PATCH',
    headers: authHeader(token),
  });
}

// "Buy two, send one": whoever currently holds a ticket instance sends it
// to another LIBERIA360 account by email. The recipient must already have
// an account (see the backend's TicketTransfer doc comment for why) — a
// 404 here means "no account uses that email yet".
export function transferTicket(
  token: string,
  instanceId: string,
  email: string,
): Promise<MyTicketsResponse> {
  return apiRequest<MyTicketsResponse>(`/ticket-instances/${instanceId}/transfer`, {
    method: 'POST',
    headers: authHeader(token),
    body: JSON.stringify({ email }),
  });
}

export function cancelTicketTransfer(
  token: string,
  transferId: string,
): Promise<MyTicketsResponse> {
  return apiRequest<MyTicketsResponse>(`/ticket-transfers/${transferId}/cancel`, {
    method: 'POST',
    headers: authHeader(token),
  });
}

export function acceptTicketTransfer(
  token: string,
  transferId: string,
): Promise<MyTicketsResponse> {
  return apiRequest<MyTicketsResponse>(`/ticket-transfers/${transferId}/accept`, {
    method: 'POST',
    headers: authHeader(token),
  });
}

export function declineTicketTransfer(token: string, transferId: string): Promise<void> {
  return apiRequest<void>(`/ticket-transfers/${transferId}/decline`, {
    method: 'POST',
    headers: authHeader(token),
  });
}

// Public, unauthenticated — the emailed transfer link's landing page reads
// this before the visitor has necessarily signed in.
export function getTicketTransferPreview(token: string): Promise<TicketTransferPreview> {
  return apiRequest<TicketTransferPreview>(`/ticket-transfers/token/${token}`);
}

export function acceptTicketTransferByToken(
  authToken: string,
  transferToken: string,
): Promise<MyTicketsResponse> {
  return apiRequest<MyTicketsResponse>(`/ticket-transfers/token/${transferToken}/accept`, {
    method: 'POST',
    headers: authHeader(authToken),
  });
}

export function declineTicketTransferByToken(
  authToken: string,
  transferToken: string,
): Promise<void> {
  return apiRequest<void>(`/ticket-transfers/token/${transferToken}/decline`, {
    method: 'POST',
    headers: authHeader(authToken),
  });
}
