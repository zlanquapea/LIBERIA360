import { apiRequest, authHeader } from './http';
import type { CreatorGuide, CreatorGuideInput } from './types';

// Client calls for creator guides. Public reads used by server pages live
// in lib/api.ts (getCreatorGuides / getCreatorGuide).

export function getMyGuides(token: string): Promise<CreatorGuide[]> {
  return apiRequest<CreatorGuide[]>('/creator-guides/mine', { headers: authHeader(token) });
}

export function getMyGuide(token: string, id: string): Promise<CreatorGuide> {
  return apiRequest<CreatorGuide>(`/creator-guides/mine/${id}`, { headers: authHeader(token) });
}

export function createGuide(token: string, input: CreatorGuideInput): Promise<CreatorGuide> {
  return apiRequest<CreatorGuide>('/creator-guides', {
    method: 'POST',
    headers: authHeader(token),
    body: JSON.stringify(input),
  });
}

export function updateGuide(token: string, id: string, input: Partial<CreatorGuideInput>): Promise<CreatorGuide> {
  return apiRequest<CreatorGuide>(`/creator-guides/${id}`, {
    method: 'PATCH',
    headers: authHeader(token),
    body: JSON.stringify(input),
  });
}

export function submitGuide(token: string, id: string): Promise<CreatorGuide> {
  return apiRequest<CreatorGuide>(`/creator-guides/${id}/submit`, { method: 'POST', headers: authHeader(token) });
}

export function deleteGuide(token: string, id: string): Promise<void> {
  return apiRequest<void>(`/creator-guides/${id}`, { method: 'DELETE', headers: authHeader(token) });
}

export function saveGuide(token: string, id: string): Promise<void> {
  return apiRequest<void>(`/creator-guides/${id}/save`, { method: 'POST', headers: authHeader(token) });
}

export function unsaveGuide(token: string, id: string): Promise<void> {
  return apiRequest<void>(`/creator-guides/${id}/save`, { method: 'DELETE', headers: authHeader(token) });
}

export function getSavedGuideIds(token: string): Promise<string[]> {
  return apiRequest<string[]>('/creator-guides/saved-ids', { headers: authHeader(token) });
}

export function getSavedGuides(token: string): Promise<CreatorGuide[]> {
  return apiRequest<CreatorGuide[]>('/creator-guides/saved', { headers: authHeader(token) });
}

export function copyGuideToTrip(token: string, id: string): Promise<{ id: string }> {
  return apiRequest<{ id: string }>(`/creator-guides/${id}/use-as-trip`, { method: 'POST', headers: authHeader(token) });
}

export function getPendingGuides(token: string): Promise<CreatorGuide[]> {
  return apiRequest<CreatorGuide[]>('/admin/creator-guides/pending', { headers: authHeader(token) });
}

export function reviewGuide(token: string, id: string, approve: boolean, reason?: string): Promise<CreatorGuide> {
  return apiRequest<CreatorGuide>(`/admin/creator-guides/${id}/review`, {
    method: 'POST',
    headers: authHeader(token),
    body: JSON.stringify({ approve, reason }),
  });
}
