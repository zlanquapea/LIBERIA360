// LIBERIA360 service worker. Push events are handled here, not by React,
// so Android Chrome can display notifications while every tab is closed.
const CACHE_NAME = "liberia360-shell-v4";
const APP_SHELL = [
  "/",
  "/manifest.webmanifest",
  "/logo.png",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key !== CACHE_NAME)
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  const url = new URL(event.request.url);
  if (
    url.origin !== self.location.origin ||
    url.pathname === "/api" ||
    url.pathname.startsWith("/api/") ||
    event.request.headers.has("authorization")
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
      .catch(() =>
        caches
          .match(event.request)
          .then((cached) => cached ?? caches.match("/")),
      ),
  );
});

self.addEventListener("message", (event) => {
  if (event.data?.type !== "CLEAR_PRIVATE_CACHES") return;
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.map((key) => caches.delete(key)))),
  );
});

function parsePushPayload(event) {
  const fallback = {
    title: "LIBERIA360",
    body: "You have a new update.",
    url: "/",
  };
  if (!event.data) return fallback;
  try {
    const value = event.data.json();
    return {
      ...fallback,
      ...(value && typeof value === "object" ? value : {}),
    };
  } catch {
    return { ...fallback, body: event.data.text() || fallback.body };
  }
}

function safeNotificationUrl(value) {
  try {
    const url = new URL(
      typeof value === "string" ? value : "/",
      self.location.origin,
    );
    return url.origin === self.location.origin
      ? `${url.pathname}${url.search}${url.hash}`
      : "/";
  } catch {
    return "/";
  }
}

async function notifyOpenClients(payload) {
  const clients = await self.clients.matchAll({
    type: "window",
    includeUncontrolled: true,
  });
  for (const client of clients) {
    client.postMessage({ type: "PUSH_NOTIFICATION", payload });
  }
}

self.addEventListener("push", (event) => {
  const payload = parsePushPayload(event);
  const url = safeNotificationUrl(payload.url);
  event.waitUntil(
    self.registration
      .showNotification(String(payload.title || "LIBERIA360"), {
        body: String(payload.body || "You have a new update."),
        icon: "/icons/icon-192.png",
        badge: "/icons/icon-192.png",
        data: { url },
        tag: `liberia360:${url}`,
        renotify: true,
        timestamp: Date.now(),
        vibrate: [100, 50, 100],
      })
      .catch(() => notifyOpenClients({ ...payload, url })),
  );
});

// Push service endpoints can rotate. The open app cannot recover a new
// subscription without its authenticated API token, so notify an open client
// to re-register it. If all tabs are closed, the browser continues using the
// existing subscription until the user opens LIBERIA360 again.
self.addEventListener("pushsubscriptionchange", (event) => {
  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clients) => {
        for (const client of clients) {
          client.postMessage({
            type: "PUSH_SUBSCRIPTION_CHANGED",
            subscription: event.newSubscription
              ? event.newSubscription.toJSON()
              : null,
          });
        }
      }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = new URL(
    safeNotificationUrl(event.notification.data?.url),
    self.location.origin,
  );
  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clientList) => {
        const existing = clientList.find(
          (client) => new URL(client.url).pathname === url.pathname,
        );
        if (existing) return existing.focus();
        return self.clients.openWindow(url.href);
      }),
  );
});
