import type { Notification, PaginatedNotifications } from './types';
import { apiRequest, authHeader } from './http';

// The general in-app notification center (Header's bell, shared by
// regular users and admins alike — see Notification's own doc comment on
// the API side for why there's no separate "admin notifications" API).
// Every call here needs a signed-in token; there is no public read.

export interface ListNotificationsParams {
  page?: number;
  limit?: number;
  unreadOnly?: boolean;
}

export function listNotifications(
  token: string,
  params: ListNotificationsParams = {},
): Promise<PaginatedNotifications> {
  const search = new URLSearchParams();
  if (params.page) search.set('page', String(params.page));
  if (params.limit) search.set('limit', String(params.limit));
  if (params.unreadOnly) search.set('unreadOnly', 'true');
  const qs = search.toString();
  return apiRequest<PaginatedNotifications>(`/notifications${qs ? `?${qs}` : ''}`, {
    headers: authHeader(token),
  });
}

// Polled by NotificationBell — a lightweight count-only endpoint so
// polling every account/admin page doesn't pull the full feed each time.
export function getUnreadNotificationCount(token: string): Promise<number> {
  return apiRequest<{ count: number }>('/notifications/unread-count', {
    headers: authHeader(token),
  }).then((result) => result.count);
}

export function markNotificationRead(token: string, id: string): Promise<Notification> {
  return apiRequest<Notification>(`/notifications/${id}/read`, {
    method: 'PATCH',
    headers: authHeader(token),
  });
}

export async function markAllNotificationsRead(token: string): Promise<void> {
  await apiRequest<void>('/notifications/read-all', {
    method: 'POST',
    headers: authHeader(token),
  });
}
