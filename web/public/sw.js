// Minimal service worker for the Phase 1 PWA (Tech Spec §6.3 — "offline-
// friendly ... PWA service worker"). This is a starting point: it caches the
// app shell and static assets so the app opens offline, and serves cached
// pages when the network is unavailable. Caching *saved places* for offline
// viewing (the fuller §6.3 goal) is an explicit localStorage snapshot taken
// alongside the Save/Bucket List feature (src/lib/saved-places.ts), not
// this generic HTTP-level cache — a snapshot survives even where this
// cache doesn't (Safari private browsing has no persistent Cache Storage,
// eviction under storage pressure, etc.), and lets the Saved screen tell
// the visitor plainly "this is a saved copy" instead of silently serving
// possibly-stale data with no indication either way.

const CACHE_NAME = 'liberia360-shell-v3';
const APP_SHELL = ['/', '/manifest.webmanifest', '/logo.png', '/icons/icon-192.png', '/icons/icon-512.png'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)).then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);
  // Never put API responses, cross-origin resources, or authenticated
  // requests in persistent Cache Storage. API data must always come from
  // the network and is deliberately unavailable offline.
  if (
    url.origin !== self.location.origin ||
    url.pathname === '/api' ||
    url.pathname.startsWith('/api/') ||
    event.request.headers.has('authorization')
  ) {
    return;
  }

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        const copy = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
        return response;
      })
      .catch(() => caches.match(event.request).then((cached) => cached ?? caches.match('/'))),
  );
});

// Logout posts this message from every open client. Delete every app cache,
// including caches created by older service-worker versions.
self.addEventListener('message', (event) => {
  if (event.data?.type !== 'CLEAR_PRIVATE_CACHES') return;
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.map((key) => caches.delete(key)))),
  );
});

// Phase 2 push notifications (Tech Spec §3.2 "events nearby") — the API
// sends a JSON payload of {title, body, url}; this just needs to turn that
// into a real OS notification and route a click back into the app.
self.addEventListener('push', (event) => {
  let payload = { title: 'LIBERIA360', body: '' };
  if (event.data) {
    try {
      payload = { ...payload, ...event.data.json() };
    } catch {
      payload.body = event.data.text();
    }
  }

  event.waitUntil(
    self.registration.showNotification(payload.title, {
      body: payload.body,
      icon: '/icons/icon-192.png',
      badge: '/icons/icon-192.png',
      data: { url: payload.url || '/' },
    }),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification.data && event.notification.data.url ? event.notification.data.url : '/';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      const existing = clientList.find((client) => new URL(client.url).pathname === url);
      if (existing) return existing.focus();
      return self.clients.openWindow(url);
    }),
  );
});
