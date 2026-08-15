import type { Event, EventCategory } from './types';
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
  ticketInfo?: string;
}

export function createEvent(token: string, input: CreateEventInput): Promise<Event> {
  return apiRequest<Event>('/events', {
    method: 'POST',
    headers: authHeader(token),
    body: JSON.stringify(input),
  });
}
