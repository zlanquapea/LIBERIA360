import type {
  BusinessContent,
  CreateBusinessContentInput,
  UpdateBusinessContentInput,
} from './types';
import { apiRequest, authHeader } from './http';

export function createBusinessContent(
  token: string,
  input: CreateBusinessContentInput,
): Promise<BusinessContent> {
  return apiRequest<BusinessContent>('/business-content', {
    method: 'POST',
    headers: authHeader(token),
    body: JSON.stringify(input),
  });
}

export function updateBusinessContent(
  token: string,
  id: string,
  input: UpdateBusinessContentInput,
): Promise<BusinessContent> {
  return apiRequest<BusinessContent>(`/business-content/${id}`, {
    method: 'PATCH',
    headers: authHeader(token),
    body: JSON.stringify(input),
  });
}

// Draft/rejected → submitted for review. A no-op (still 200s) if it's
// already submitted or approved — see BusinessContentService.submit's
// doc comment.
export function submitBusinessContent(token: string, id: string): Promise<BusinessContent> {
  return apiRequest<BusinessContent>(`/business-content/${id}/submit`, {
    method: 'POST',
    headers: authHeader(token),
  });
}

export function deleteBusinessContent(token: string, id: string): Promise<void> {
  return apiRequest<void>(`/business-content/${id}`, {
    method: 'DELETE',
    headers: authHeader(token),
  });
}

// The owner's own dashboard list — every status, not just approved.
export function getMyBusinessContent(token: string, businessId: string): Promise<BusinessContent[]> {
  return apiRequest<BusinessContent[]>(`/business-content/mine?businessId=${businessId}`, {
    headers: authHeader(token),
  });
}
