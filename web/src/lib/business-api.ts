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

// A place submitted under the dedicated "Pharmacy" category is auto-claimed
// *twice* — once as this generic Business record, and separately as its own
// Pharmacy record (see PharmaciesService.autoClaimSubmittedPlace on the
// backend) with its own inventory/orders/dashboard. The two are otherwise
// unconnected: this Business's own `type` is derived from the old, fixed
// PlaceType enum (see mapPlaceTypeToBusinessType), which predates the
// pharmacy marketplace and has no PHARMACY value at all — so a pharmacy
// business ends up mislabeled (e.g. "Attraction") with no indication
// anywhere that a whole separate pharmacy-management surface exists for it.
// Matched by category slug/name exactly like the backend's
// PlacesService.submitPlace does, using `linkedPlace.category` — always
// present (both Business.linkedPlace and Place.category are eager
// relations) — rather than `business.type`, so this works for every
// pharmacy business regardless of when it was created.
export function isPharmacyBusiness(business: Business): boolean {
  const category = business.linkedPlace?.category;
  const slug = (category?.slug ?? '').toLowerCase().trim();
  const name = (category?.name ?? '').toLowerCase().trim();
  return ['pharmacy', 'pharmacies'].includes(slug) || ['pharmacy', 'pharmacies'].includes(name);
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
