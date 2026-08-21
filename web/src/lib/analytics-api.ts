import type { AnalyticsEventType, BusinessAnalytics } from './types';
import { apiRequest, authHeader } from './http';

// Fire-and-forget by design (Tech Spec §3.3 / §8.4) — a dropped analytics
// beacon should never break the page the visitor is actually using, so
// failures are swallowed rather than surfaced.
export function recordAnalyticsEvent(placeId: string, eventType: AnalyticsEventType): void {
  apiRequest('/analytics/events', {
    method: 'POST',
    body: JSON.stringify({ placeId, eventType }),
  }).catch(() => {
    /* best-effort — nothing for the UI to react to */
  });
}

// Same fire-and-forget shape, for the creator-profile equivalent of
// PlaceViewTracker/ContactLink's events.
export function recordCreatorAnalyticsEvent(creatorId: string, eventType: AnalyticsEventType): void {
  apiRequest('/analytics/events', {
    method: 'POST',
    body: JSON.stringify({ creatorId, eventType }),
  }).catch(() => {
    /* best-effort — nothing for the UI to react to */
  });
}

export function getBusinessAnalytics(token: string, businessId: string): Promise<BusinessAnalytics> {
  return apiRequest<BusinessAnalytics>(`/analytics/business/${businessId}`, { headers: authHeader(token) });
}

export function getCreatorAnalytics(token: string, creatorId: string): Promise<BusinessAnalytics> {
  return apiRequest<BusinessAnalytics>(`/analytics/creator/${creatorId}`, { headers: authHeader(token) });
}
