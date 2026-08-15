import { apiRequest, authHeader } from './http';

export function getVapidPublicKey(): Promise<{ publicKey: string | null }> {
  return apiRequest<{ publicKey: string | null }>('/push/vapid-public-key');
}

export function subscribePush(token: string, subscription: PushSubscriptionJSON): Promise<void> {
  return apiRequest<void>('/push/subscribe', {
    method: 'POST',
    headers: authHeader(token),
    body: JSON.stringify(subscription),
  });
}

export function unsubscribePush(token: string, endpoint: string): Promise<void> {
  return apiRequest<void>('/push/unsubscribe', {
    method: 'POST',
    headers: authHeader(token),
    body: JSON.stringify({ endpoint }),
  });
}
