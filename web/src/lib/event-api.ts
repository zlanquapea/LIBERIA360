import type {
  Event,
  EventCategory,
  EventRsvpState,
  EventRsvpStatus,
} from './types';
import { apiRequest, authHeader } from './http';

export interface CreateEventInput {
  name: string;
  category: EventCategory;
  placeId?: string;
  locationText?: string;
  countyId: string;
  startDate: string;
  endDate?: string;
  description?: string;
  images?: string[];
  ticketInfo?: string;
}

export function createEvent(token: string, input: CreateEventInput): Promise<Event> {
  return apiRequest<Event>('/events', {
    method: 'POST',
    headers: authHeader(token),
    body: JSON.stringify(input),
  });
}

// An organizer's own events regardless of date — the "My Events" account
// page, unlike the public listing, needs to include ones that already
// happened so someone can see what they've already run.
export function getMyEvents(token: string): Promise<Event[]> {
  return apiRequest<Event[]>('/events/mine', { headers: authHeader(token) });
}

export type UpdateEventInput = Partial<CreateEventInput>;

// Self-service edit for the organizer who posted it (or an admin) — see
// EventsService.update. Only the fields being changed need to be sent.
export function updateEvent(token: string, id: string, input: UpdateEventInput): Promise<Event> {
  return apiRequest<Event>(`/events/${id}`, {
    method: 'PATCH',
    headers: authHeader(token),
    body: JSON.stringify(input),
  });
}

// Self-service cancel/remove — same ownership rule as updateEvent.
export function deleteEvent(token: string, id: string): Promise<void> {
  return apiRequest<void>(`/events/${id}`, { method: 'DELETE', headers: authHeader(token) });
}

export interface EventRsvpResult {
  status: EventRsvpStatus;
  interestedCount: number;
  goingCount: number;
}

// Marks the viewer Interested or Going. Mutually exclusive on the backend
// (see EventsService.setRsvp) — calling this with "going" while already
// Interested moves the count across rather than adding a second RSVP.
export function setEventRsvp(
  token: string,
  eventId: string,
  status: EventRsvpStatus,
): Promise<EventRsvpResult> {
  return apiRequest<EventRsvpResult>(`/events/${eventId}/rsvp`, {
    method: 'PUT',
    headers: authHeader(token),
    body: JSON.stringify({ status }),
  });
}

// Un-marks Interested/Going entirely — tapping an already-active button
// again, Facebook-style.
export function removeEventRsvp(
  token: string,
  eventId: string,
): Promise<{ interestedCount: number; goingCount: number }> {
  return apiRequest(`/events/${eventId}/rsvp`, {
    method: 'DELETE',
    headers: authHeader(token),
  });
}

// The viewer's own RSVP status. A separate authenticated fetch rather than
// a field on the public Event shape — see EventRsvpState's doc comment in
// shared-types. Called client-side once a token is available.
export function getEventRsvp(token: string, eventId: string): Promise<EventRsvpState> {
  return apiRequest<EventRsvpState>(`/events/${eventId}/rsvp`, {
    headers: authHeader(token),
  });
}
