'use client';

// Phase 1 "Save / bucket list" is device-local storage, no account required
// (Tech Spec §3.1). `localStorage` only fires a `storage` event in *other*
// tabs, so same-tab listeners (the profile page's SaveButton and the Saved
// screen, say) need their own event to stay in sync — hence the custom
// `liberia360:saved-changed` dispatch alongside every write.

const STORAGE_KEY = 'liberia360:saved-places';
const CHANGE_EVENT = 'liberia360:saved-changed';

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
