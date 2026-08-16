import type { CreateContentReportInput } from './types';
import { apiRequest, authHeader } from './http';

export function reportContent(token: string, input: CreateContentReportInput): Promise<void> {
  return apiRequest<void>('/reports', {
    method: 'POST',
    headers: authHeader(token),
    body: JSON.stringify(input),
  });
}
