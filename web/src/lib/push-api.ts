import { apiRequest, authHeader } from "./http";

export function getVapidPublicKey(): Promise<{ publicKey: string | null }> {
  return apiRequest<{ publicKey: string | null }>("/push/vapid-public-key");
}

function apiSubscriptionPayload(
  subscription: PushSubscriptionJSON,
): PushSubscriptionJSON {
  return {
    endpoint: subscription.endpoint,
    keys: {
      p256dh: subscription.keys?.p256dh ?? "",
      auth: subscription.keys?.auth ?? "",
    },
  };
}

export function subscribePush(
  token: string,
  subscription: PushSubscriptionJSON,
): Promise<void> {
  return apiRequest<void>("/push/subscribe", {
    method: "POST",
    headers: authHeader(token),
    body: JSON.stringify(apiSubscriptionPayload(subscription)),
  });
}

export function unsubscribePush(
  token: string,
  endpoint: string,
): Promise<void> {
  return apiRequest<void>("/push/unsubscribe", {
    method: "POST",
    headers: authHeader(token),
    body: JSON.stringify({ endpoint }),
  });
}
