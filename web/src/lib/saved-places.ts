'use client';

import type { Place } from './types';

// Phase 1 "Save / bucket list" is device-local storage, no account required
// (Tech Spec §3.1). `localStorage` only fires a `storage` event in *other*
// tabs, so same-tab listeners (the profile page's SaveButton and the Saved
// screen, say) need their own event to stay in sync — hence the custom
// `liberia360:saved-changed` dispatch alongside every write.
//
// Offline-capable saved places (Tech Spec §6.3's fuller PWA goal): the
// slug list below is the source of truth for *which* places are saved, but
// the Saved screen needs the actual Place data to render, and that's a
// live API call — no good the one time it matters most (no signal). So
// every successful load of a saved place's data is snapshotted here too;
// the Saved screen falls back to the last snapshot when the live fetch
// fails for any reason other than a 404 (place removed from the catalog).

const STORAGE_KEY = 'liberia360:saved-places';
const SNAPSHOT_KEY = 'liberia360:saved-places-cache';
const CHANGE_EVENT = 'liberia360:saved-changed';

export interface CachedPlaceSnapshot {
  place: Place;
  cachedAt: string;
}

function readSlugs(): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeSlugs(slugs: string[]): void {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(slugs));
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

export function getSavedSlugs(): string[] {
  return readSlugs();
}

export function isPlaceSaved(slug: string): boolean {
  return readSlugs().includes(slug);
}

export function toggleSavedPlace(slug: string): boolean {
  const slugs = readSlugs();
  const index = slugs.indexOf(slug);
  if (index === -1) {
    writeSlugs([...slugs, slug]);
    return true;
  }
  writeSlugs([...slugs.slice(0, index), ...slugs.slice(index + 1)]);
  pruneCachedPlaceSnapshot(slug);
  return false;
}

export function subscribeToSavedPlaces(callback: () => void): () => void {
  window.addEventListener(CHANGE_EVENT, callback);
  window.addEventListener('storage', callback);
  return () => {
    window.removeEventListener(CHANGE_EVENT, callback);
    window.removeEventListener('storage', callback);
  };
}

function readSnapshots(): Record<string, CachedPlaceSnapshot> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = window.localStorage.getItem(SNAPSHOT_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function writeSnapshots(snapshots: Record<string, CachedPlaceSnapshot>): void {
  try {
    window.localStorage.setItem(SNAPSHOT_KEY, JSON.stringify(snapshots));
  } catch {
    // Snapshot caching is a nice-to-have (an offline fallback only) — if
    // storage is full or unavailable, saving/unsaving itself (the slug
    // list above) still works fine, so swallow the write failure here
    // rather than let it break the save flow.
  }
}

/** Called on every successful fetch of a saved place, so there's always a
 * last-known copy to fall back to if a later fetch fails offline. */
export function cachePlaceSnapshot(place: Place): void {
  const snapshots = readSnapshots();
  snapshots[place.slug] = { place, cachedAt: new Date().toISOString() };
  writeSnapshots(snapshots);
}

export function getCachedPlaceSnapshot(slug: string): CachedPlaceSnapshot | null {
  return readSnapshots()[slug] ?? null;
}

function pruneCachedPlaceSnapshot(slug: string): void {
  const snapshots = readSnapshots();
  if (slug in snapshots) {
    delete snapshots[slug];
    writeSnapshots(snapshots);
  }
}
