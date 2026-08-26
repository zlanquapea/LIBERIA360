import type { Advertisement, AdvertisementType } from './types';
import { apiRequest, authHeader } from './http';

// Self-service marketplace ad slot — "advertise your digital product or
// business" (a monetization feature, independent of the catalog's own
// Place/Business/Creator listings). Every call here needs a signed-in
// token; there is no public write. The public "Sponsored" feed itself
// (getActiveAdvertisements) lives in api.ts alongside the rest of the
// server-rendered catalog reads, not here.

export interface CreateAdvertisementInput {
  type: AdvertisementType;
  title: string;
  description: string;
  images?: string[];
  priceLabel?: string;
  contactPhone?: string;
  contactWhatsapp?: string;
  contactEmail?: string;
  externalLink?: string;
}

export interface UpdateAdvertisementInput {
  title?: string;
  description?: string;
  images?: string[];
  priceLabel?: string;
  contactPhone?: string;
  contactWhatsapp?: string;
  contactEmail?: string;
  externalLink?: string;
}

export function createAdvertisement(token: string, input: CreateAdvertisementInput): Promise<Advertisement> {
  return apiRequest<Advertisement>('/advertisements', {
    method: 'POST',
    headers: authHeader(token),
    body: JSON.stringify(input),
  });
}

// "My Ads" — every ad this account has submitted, any status.
export function getMyAds(token: string): Promise<Advertisement[]> {
  return apiRequest<Advertisement[]>('/advertisements/mine', { headers: authHeader(token) });
}

export function getAdvertisement(token: string, id: string): Promise<Advertisement> {
  return apiRequest<Advertisement>(`/advertisements/${id}`, { headers: authHeader(token) });
}

// Editing a rejected ad resubmits it for review automatically — no
// separate "resubmit" action needed.
export function updateAdvertisement(
  token: string,
  id: string,
  input: UpdateAdvertisementInput,
): Promise<Advertisement> {
  return apiRequest<Advertisement>(`/advertisements/${id}`, {
    method: 'PATCH',
    headers: authHeader(token),
    body: JSON.stringify(input),
  });
}

export async function deleteAdvertisement(token: string, id: string): Promise<void> {
  await apiRequest<void>(`/advertisements/${id}`, {
    method: 'DELETE',
    headers: authHeader(token),
  });
}
