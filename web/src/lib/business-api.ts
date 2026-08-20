import type { Business, BusinessType } from './types';
import { apiRequest, authHeader } from './http';

export interface ClaimBusinessInput {
  placeId: string;
  name: string;
  type: BusinessType;
  phone?: string;
  whatsapp?: string;
  email?: string;
  website?: string;
  description?: string;
  logoImage?: string;
  videos?: string[];
  openingHours?: string;
  priceRangeMin?: number;
  priceRangeMax?: number;
  servicesOffered?: string[];
}

export function claimBusiness(token: string, input: ClaimBusinessInput): Promise<Business> {
  return apiRequest<Business>('/businesses', {
    method: 'POST',
    headers: authHeader(token),
    body: JSON.stringify(input),
  });
}

export function getMyBusinesses(token: string): Promise<Business[]> {
  return apiRequest<Business[]>('/businesses/mine', { headers: authHeader(token) });
}

export interface UpdateBusinessInput {
  name?: string;
  phone?: string;
  whatsapp?: string;
  email?: string;
  website?: string;
  socialLinks?: string[];
  description?: string;
  images?: string[];
  logoImage?: string;
  videos?: string[];
  openingHours?: string;
  priceRangeMin?: number;
  priceRangeMax?: number;
  servicesOffered?: string[];
}

// Editing a listing after claiming it — the claim form above only ever
// gets one shot at these fields otherwise.
export function updateBusiness(token: string, id: string, input: UpdateBusinessInput): Promise<Business> {
  return apiRequest<Business>(`/businesses/${id}`, {
    method: 'PATCH',
    headers: authHeader(token),
    body: JSON.stringify(input),
  });
}
