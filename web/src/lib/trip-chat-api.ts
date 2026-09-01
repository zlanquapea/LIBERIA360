import type { TripMessage } from './types';
import { apiRequest, authHeader } from './http';

export interface SendTripMessageInput {
  body?: string;
  imageUrl?: string;
  replyToMessageId?: string;
  clientId?: string;
}

export function getTripMessages(
  token: string,
  itineraryId: string,
  params: { before?: string; limit?: number } = {},
): Promise<TripMessage[]> {
  const query = new URLSearchParams();
  if (params.before) query.set('before', params.before);
  if (params.limit) query.set('limit', String(params.limit));
  const qs = query.toString();
  return apiRequest<TripMessage[]>(`/itineraries/${itineraryId}/chat/messages${qs ? `?${qs}` : ''}`, {
    headers: authHeader(token),
  });
}

export function sendTripMessage(
  token: string,
  itineraryId: string,
  input: SendTripMessageInput,
): Promise<TripMessage> {
  return apiRequest<TripMessage>(`/itineraries/${itineraryId}/chat/messages`, {
    method: 'POST',
    headers: authHeader(token),
    body: JSON.stringify(input),
  });
}

// Text-only — see UpdateTripMessageDto's doc comment on the backend for
// why an image-only message can't be edited this way.
export function updateTripMessage(
  token: string,
  itineraryId: string,
  messageId: string,
  body: string,
): Promise<TripMessage> {
  return apiRequest<TripMessage>(`/itineraries/${itineraryId}/chat/messages/${messageId}`, {
    method: 'PATCH',
    headers: authHeader(token),
    body: JSON.stringify({ body }),
  });
}

export function deleteTripMessage(token: string, itineraryId: string, messageId: string): Promise<TripMessage> {
  return apiRequest<TripMessage>(`/itineraries/${itineraryId}/chat/messages/${messageId}`, {
    method: 'DELETE',
    headers: authHeader(token),
  });
}

// Toggling a reaction the caller already has removes it — see
// TripChatService.toggleReaction on the backend.
export function toggleTripMessageReaction(
  token: string,
  itineraryId: string,
  messageId: string,
  emoji: string,
): Promise<TripMessage> {
  return apiRequest<TripMessage>(`/itineraries/${itineraryId}/chat/messages/${messageId}/reactions`, {
    method: 'POST',
    headers: authHeader(token),
    body: JSON.stringify({ emoji }),
  });
}

// Call once a poll's response has actually landed in the client — the
// signal that turns a message's status into "Delivered" for its sender.
export async function markTripChatDelivered(token: string, itineraryId: string): Promise<void> {
  await apiRequest<void>(`/itineraries/${itineraryId}/chat/delivered`, {
    method: 'POST',
    headers: authHeader(token),
  });
}

// Call while the chat panel is open and visible — the signal that turns
// a message's status into "Read".
export async function markTripChatRead(token: string, itineraryId: string): Promise<void> {
  await apiRequest<void>(`/itineraries/${itineraryId}/chat/read`, {
    method: 'POST',
    headers: authHeader(token),
  });
}
