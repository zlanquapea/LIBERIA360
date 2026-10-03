import type { ItineraryDetail, ItineraryStopDetail } from './types';
import { resolveImageUrl, resolveThumbUrl } from './images';

// Offline trip packs: a trip the traveler explicitly downloads, kept in the
// browser's Cache Storage so it opens with no connection. Only same-origin
// resources are stored (trip data, place photos, the offline page itself);
// map tiles are never cached — the basemap provider's terms don't allow
// it. Logging out clears every pack (see auth-storage's
// CLEAR_PRIVATE_CACHES), since a trip can be private.

export const PACK_CACHE = 'liberia360-trip-packs-v1';
const INDEX_KEY = 'liberia360:offline-packs';
const OFFLINE_PAGE = '/trips/offline';
// Enough photos to recognise each stop without filling the device.
const MAX_IMAGES = 40;

export interface OfflinePackSummary {
  id: string;
  title: string;
  downloadedAt: string;
  stopCount: number;
  imageCount: number;
}

export interface OfflinePack {
  version: 1;
  downloadedAt: string;
  trip: ItineraryDetail;
}

export function offlinePacksSupported(): boolean {
  return typeof window !== 'undefined' && 'caches' in window && 'serviceWorker' in navigator;
}

function packKey(id: string): string {
  return `/__offline-pack/${encodeURIComponent(id)}.json`;
}

export function listOfflinePacks(): OfflinePackSummary[] {
  try {
    const raw = window.localStorage.getItem(INDEX_KEY);
    const parsed = raw ? (JSON.parse(raw) as OfflinePackSummary[]) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeIndex(packs: OfflinePackSummary[]): void {
  try {
    window.localStorage.setItem(INDEX_KEY, JSON.stringify(packs));
  } catch {
    // Storage blocked: the pack still exists in the cache, it just won't
    // be listed.
  }
}

export function getOfflinePackSummary(id: string): OfflinePackSummary | null {
  return listOfflinePacks().find((p) => p.id === id) ?? null;
}

/** Same-origin photo URLs for the trip's stops, thumbnails preferred. */
export function packImageUrls(stops: ItineraryStopDetail[], origin: string): string[] {
  const urls: string[] = [];
  for (const stop of stops) {
    const path = stop.place?.images[0] ?? stop.event?.images[0] ?? stop.carListing?.images[0];
    if (!path) continue;
    const url = resolveThumbUrl(path) ?? resolveImageUrl(path);
    try {
      const parsed = new URL(url, origin);
      if (parsed.origin === origin && !urls.includes(parsed.href)) urls.push(parsed.href);
    } catch {
      // Not a usable URL (e.g. a data: URI): skip.
    }
  }
  return urls.slice(0, MAX_IMAGES);
}

/** Downloads (or refreshes) a trip for offline use. Photos that fail to
 * download are skipped; the trip data itself must succeed. */
export async function saveOfflinePack(trip: ItineraryDetail): Promise<OfflinePackSummary> {
  const cache = await caches.open(PACK_CACHE);
  const downloadedAt = new Date().toISOString();
  const pack: OfflinePack = { version: 1, downloadedAt, trip };
  await cache.put(
    packKey(trip.id),
    new Response(JSON.stringify(pack), { headers: { 'Content-Type': 'application/json' } }),
  );

  const images = packImageUrls(trip.stops, window.location.origin);
  const results = await Promise.allSettled(images.map((url) => cache.add(url)));
  const imageCount = results.filter((r) => r.status === 'fulfilled').length;

  // The offline viewer page and its scripts, so it opens with no
  // connection. Best-effort: if this fails the data is still saved.
  await cacheOfflinePage(cache).catch(() => undefined);

  const summary: OfflinePackSummary = {
    id: trip.id,
    title: trip.title,
    downloadedAt,
    stopCount: trip.stops.length,
    imageCount,
  };
  writeIndex([summary, ...listOfflinePacks().filter((p) => p.id !== trip.id)]);
  return summary;
}

async function cacheOfflinePage(cache: Cache): Promise<void> {
  const res = await fetch(OFFLINE_PAGE, { credentials: 'same-origin' });
  if (!res.ok) return;
  const html = await res.clone().text();
  await cache.put(OFFLINE_PAGE, res);
  const assets = [...html.matchAll(/(?:src|href)="(\/_next\/static\/[^"]+\.(?:js|css))"/g)].map((m) => m[1]);
  await Promise.allSettled([...new Set(assets)].map((asset) => cache.add(asset)));
}

export async function loadOfflinePack(id: string): Promise<OfflinePack | null> {
  if (!('caches' in window)) return null;
  const cache = await caches.open(PACK_CACHE);
  const res = await cache.match(packKey(id));
  if (!res) return null;
  try {
    const pack = (await res.json()) as OfflinePack;
    return pack.version === 1 ? pack : null;
  } catch {
    return null;
  }
}

export async function removeOfflinePack(id: string): Promise<void> {
  const pack = await loadOfflinePack(id).catch(() => null);
  const cache = await caches.open(PACK_CACHE);
  await cache.delete(packKey(id));
  if (pack) {
    // Photos shared with another downloaded trip stay.
    const keep = new Set<string>();
    for (const other of listOfflinePacks().filter((p) => p.id !== id)) {
      const otherPack = await loadOfflinePack(other.id);
      if (otherPack) packImageUrls(otherPack.trip.stops, window.location.origin).forEach((u) => keep.add(u));
    }
    await Promise.all(
      packImageUrls(pack.trip.stops, window.location.origin)
        .filter((u) => !keep.has(u))
        .map((u) => cache.delete(u)),
    );
  }
  writeIndex(listOfflinePacks().filter((p) => p.id !== id));
}
