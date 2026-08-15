import type { Creator } from './types';
import { apiRequest, authHeader } from './http';

export interface CreatorProfileInput {
  name: string;
  username: string;
  bio?: string;
  instagram?: string;
  tiktok?: string;
  youtube?: string;
  specialties?: string[];
  locationsCovered?: string[];
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
