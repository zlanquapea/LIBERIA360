'use client';

// Browser-side Web Push mechanics — converting the API's base64url VAPID
// key into the Uint8Array PushManager.subscribe() expects, and thin
// wrappers around the Service Worker / Push APIs. Kept separate from
// push-api.ts (the HTTP calls to our own API) since this half has nothing
// to do with fetch.

export function isPushSupported(): boolean {
  return typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window;
}

// Web Push's applicationServerKey wants a Uint8Array, but VAPID public keys
// are handed around as base64url strings everywhere else (this is the
// standard conversion, not LIBERIA360-specific).
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i++) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export async function getExistingSubscription(): Promise<PushSubscription | null> {
  const registration = await navigator.serviceWorker.ready;
  return registration.pushManager.getSubscription();
}

// pushManager.subscribe() round-trips to the browser's push service (FCM,
// Mozilla's push service, etc.) to register the endpoint — on a blocked or
// very slow network path (corporate proxy, ad/privacy blocker, flaky
// connection) it can hang indefinitely with no browser-level timeout of its
// own. A stuck "Turn on" button with no way out is worse than a clear
// failure, so cap it and surface a real error instead.
const SUBSCRIBE_TIMEOUT_MS = 15_000;

export async function subscribeToPush(vapidPublicKey: string): Promise<PushSubscription> {
  const registration = await navigator.serviceWorker.ready;
  return Promise.race([
    registration.pushManager.subscribe({
      userVisibleOnly: true,
      // TS's lib.dom BufferSource type wants an ArrayBuffer-backed view
      // specifically; Uint8Array's generic here is ArrayBufferLike (which
      // also covers SharedArrayBuffer), so a plain Uint8Array return
      // doesn't structurally satisfy it even though this one is always a
      // real ArrayBuffer at runtime.
      applicationServerKey: urlBase64ToUint8Array(vapidPublicKey) as BufferSource,
    }),
    new Promise<never>((_, reject) =>
      setTimeout(
        () => reject(new Error('Timed out reaching the push notification service. Check your connection and try again.')),
        SUBSCRIBE_TIMEOUT_MS,
      ),
    ),
  ]);
}
