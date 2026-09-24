import type {
  CarCancellationPolicy,
  CarCategory,
  CarFuelPolicy,
  CarFuelType,
  CarListing,
  CarListingAvailability,
  CarListingBlockedDate,
  CarTransmission,
} from './types';
import { apiRequest, authHeader } from './http';

// Owner-side fleet management for a car-rental Business — mirrors
// ads-api.ts's shape exactly. Every call here needs a signed-in token;
// the public directory/detail reads (getCarListings/getCarListing) live
// in api.ts alongside the rest of the server-rendered catalog reads, not
// here.

export interface CreateCarListingInput {
  countyId: string;
  // Optional — only set by an actual registered rental company that
  // already has a claimed Business (type car_rental) and wants its fleet
  // to also show up there. Never required to list a car.
  businessId?: string;
  title: string;
  make: string;
  model: string;
  year: number;
  category: CarCategory;
  transmission: CarTransmission;
  fuelType: CarFuelType;
  seats: number;
  pricePerDay: number;
  withDriverAvailable?: boolean;
  driverFeePerDay?: number;
  minRentalDays?: number;
  // Opt-in hourly rental — see CarListing.pricePerHour's doc comment on
  // the backend entity. Leave pricePerHour unset to keep the listing
  // day-only.
  pricePerHour?: number;
  minRentalHours?: number;
  driverFeePerHour?: number;
  securityDeposit?: number;
  // These accept an explicit `null` (as opposed to simply omitting the
  // key) so an edit can clear a previously-set value — see
  // UpdateCarListingDto's doc comment on the backend for why the
  // distinction matters.
  color?: string | null;
  mileageLimitPerDay?: number | null;
  excessMileageFee?: number | null;
  fuelPolicy?: CarFuelPolicy | null;
  minDriverAge?: number | null;
  additionalDriverAllowed?: boolean;
  additionalDriverFee?: number | null;
  insuranceIncluded?: boolean;
  insuranceNotes?: string | null;
  cancellationPolicy?: CarCancellationPolicy | null;
  deliveryAvailable?: boolean;
  deliveryFee?: number | null;
  instantBookEnabled?: boolean;
  features?: string[];
  images?: string[];
  description?: string;
  pickupLocation?: string;
  contactPhone?: string;
  contactWhatsapp?: string;
}

export type UpdateCarListingInput = Partial<Omit<CreateCarListingInput, 'businessId'>> & {
  isActive?: boolean;
};

export function createCarListing(token: string, input: CreateCarListingInput): Promise<CarListing> {
  return apiRequest<CarListing>('/car-listings', {
    method: 'POST',
    headers: authHeader(token),
    body: JSON.stringify(input),
  });
}

// "My Car Listings" — every vehicle this account's business has listed,
// any status.
export function getMyCarListings(token: string): Promise<CarListing[]> {
  return apiRequest<CarListing[]>('/car-listings/mine', { headers: authHeader(token) });
}

export function getMyCarListing(token: string, id: string): Promise<CarListing> {
  return apiRequest<CarListing>(`/car-listings/mine/${id}`, { headers: authHeader(token) });
}

// Editing a rejected listing resubmits it for review automatically — no
// separate "resubmit" action needed. Toggling `isActive` alone never
// touches review status (see CarListingsService.update).
export function updateCarListing(
  token: string,
  id: string,
  input: UpdateCarListingInput,
): Promise<CarListing> {
  return apiRequest<CarListing>(`/car-listings/${id}`, {
    method: 'PATCH',
    headers: authHeader(token),
    body: JSON.stringify(input),
  });
}

export async function deleteCarListing(token: string, id: string): Promise<void> {
  await apiRequest<void>(`/car-listings/${id}`, {
    method: 'DELETE',
    headers: authHeader(token),
  });
}

export interface CreateCarListingBlockedDateInput {
  startDate: string;
  endDate: string;
  reason?: string;
}

export function getCarListingBlockedDates(
  token: string,
  carListingId: string,
): Promise<CarListingBlockedDate[]> {
  return apiRequest<CarListingBlockedDate[]>(`/car-listings/${carListingId}/blocked-dates`, {
    headers: authHeader(token),
  });
}

export function createCarListingBlockedDate(
  token: string,
  carListingId: string,
  input: CreateCarListingBlockedDateInput,
): Promise<CarListingBlockedDate> {
  return apiRequest<CarListingBlockedDate>(`/car-listings/${carListingId}/blocked-dates`, {
    method: 'POST',
    headers: authHeader(token),
    body: JSON.stringify(input),
  });
}

export async function deleteCarListingBlockedDate(
  token: string,
  carListingId: string,
  blockedDateId: string,
): Promise<void> {
  await apiRequest<void>(`/car-listings/${carListingId}/blocked-dates/${blockedDateId}`, {
    method: 'DELETE',
    headers: authHeader(token),
  });
}

// Public — no token. Used by the booking form's non-blocking
// availability warning (see BookingRequestSection).
export function getCarListingAvailability(carListingId: string): Promise<CarListingAvailability> {
  return apiRequest<CarListingAvailability>(`/car-listings/${carListingId}/availability`);
}
