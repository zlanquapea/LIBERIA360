import type { FreshnessResponse, PlaceFreshnessReport } from './types';
import { apiRequest, authHeader } from './http';

export function reportFreshness(
  token: string,
  input: { placeId: string; response: FreshnessResponse },
): Promise<PlaceFreshnessReport> {
  return apiRequest<PlaceFreshnessReport>('/freshness-reports', {
    method: 'POST',
    headers: authHeader(token),
    body: JSON.stringify(input),
  });
}

export function getMyFreshnessReport(token: string, placeId: string): Promise<PlaceFreshnessReport | null> {
  return apiRequest<PlaceFreshnessReport | null>(`/freshness-reports/mine?placeId=${placeId}`, {
    headers: authHeader(token),
  });
}
