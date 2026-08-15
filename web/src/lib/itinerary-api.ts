import type { BudgetBand, Itinerary, ItineraryDetail } from './types';
import { apiRequest, authHeader } from './http';

export interface GenerateTripInput {
  durationDays: number;
  startDate?: string;
  interests: string[];
  budgetBand: BudgetBand;
  title?: string;
}

export interface GenerateWeekendInput {
  startLat: number;
  startLng: number;
  maxTravelTimeMinutes: number;
  interests: string[];
  budgetBand: BudgetBand;
  durationDays?: number;
}

export function generateTrip(token: string, input: GenerateTripInput): Promise<ItineraryDetail> {
  return apiRequest<ItineraryDetail>('/itineraries', {
    method: 'POST',
    headers: authHeader(token),
    body: JSON.stringify(input),
  });
}

export function generateWeekend(token: string, input: GenerateWeekendInput): Promise<ItineraryDetail> {
  return apiRequest<ItineraryDetail>('/itineraries/weekend', {
    method: 'POST',
    headers: authHeader(token),
    body: JSON.stringify(input),
  });
}

export function getMyItineraries(token: string): Promise<Itinerary[]> {
  return apiRequest<Itinerary[]>('/itineraries', { headers: authHeader(token) });
}

export function getItinerary(token: string, id: string): Promise<ItineraryDetail> {
  return apiRequest<ItineraryDetail>(`/itineraries/${id}`, { headers: authHeader(token) });
}
