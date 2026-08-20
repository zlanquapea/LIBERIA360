import type { Creator, CreatorCategory, CreatorOffering, CreatorPortfolioItem, CreatorPortfolioItemType } from './types';
import { apiRequest, authHeader } from './http';

export interface CreatorProfileInput {
  name: string;
  username: string;
  bio?: string;
  profileImage?: string;
  coverImage?: string;
  category?: CreatorCategory;
  countyId?: string;
  instagram?: string;
  tiktok?: string;
  youtube?: string;
  contactEmail?: string;
  contactPhone?: string;
  whatsapp?: string;
  website?: string;
  languages?: string[];
  yearsExperience?: number;
  certifications?: string[];
  availabilityNote?: string;
  specialties?: string[];
  locationsCovered?: string[];
  contentLinks?: string[];
}

export function getMyCreatorProfile(token: string): Promise<Creator | null> {
  return apiRequest<Creator | null>('/creators/me', { headers: authHeader(token) });
}

export function createCreatorProfile(token: string, input: CreatorProfileInput): Promise<Creator> {
  return apiRequest<Creator>('/creators', {
    method: 'POST',
    headers: authHeader(token),
    body: JSON.stringify(input),
  });
}

export function updateCreatorProfile(token: string, input: Partial<CreatorProfileInput>): Promise<Creator> {
  return apiRequest<Creator>('/creators/me', {
    method: 'PATCH',
    headers: authHeader(token),
    body: JSON.stringify(input),
  });
}

export interface PortfolioItemInput {
  type: CreatorPortfolioItemType;
  url: string;
  caption?: string;
  category?: string;
}

export function addPortfolioItem(token: string, input: PortfolioItemInput): Promise<CreatorPortfolioItem> {
  return apiRequest<CreatorPortfolioItem>('/creators/me/portfolio', {
    method: 'POST',
    headers: authHeader(token),
    body: JSON.stringify(input),
  });
}

export function updatePortfolioItem(
  token: string,
  itemId: string,
  input: Partial<Pick<PortfolioItemInput, 'caption' | 'category'>> & { sortOrder?: number },
): Promise<CreatorPortfolioItem> {
  return apiRequest<CreatorPortfolioItem>(`/creators/me/portfolio/${itemId}`, {
    method: 'PATCH',
    headers: authHeader(token),
    body: JSON.stringify(input),
  });
}

export function removePortfolioItem(token: string, itemId: string): Promise<void> {
  return apiRequest<void>(`/creators/me/portfolio/${itemId}`, {
    method: 'DELETE',
    headers: authHeader(token),
  });
}

export interface OfferingInput {
  title: string;
  description?: string;
  priceFrom?: number;
  durationLabel?: string;
  location?: string;
}

export function addOffering(token: string, input: OfferingInput): Promise<CreatorOffering> {
  return apiRequest<CreatorOffering>('/creators/me/offerings', {
    method: 'POST',
    headers: authHeader(token),
    body: JSON.stringify(input),
  });
}

export function updateOffering(
  token: string,
  offeringId: string,
  input: Partial<OfferingInput> & { sortOrder?: number },
): Promise<CreatorOffering> {
  return apiRequest<CreatorOffering>(`/creators/me/offerings/${offeringId}`, {
    method: 'PATCH',
    headers: authHeader(token),
    body: JSON.stringify(input),
  });
}

export function removeOffering(token: string, offeringId: string): Promise<void> {
  return apiRequest<void>(`/creators/me/offerings/${offeringId}`, {
    method: 'DELETE',
    headers: authHeader(token),
  });
}
