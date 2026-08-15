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
