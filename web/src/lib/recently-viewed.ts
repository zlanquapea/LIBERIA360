export type RecentlyViewedKind = "place" | "creator" | "event";

export interface RecentlyViewedItem {
  id: string;
  kind: RecentlyViewedKind;
  href: string;
  title: string;
  subtitle: string | null;
  imageUrl: string | null;
  viewedAt: string;
}

const STORAGE_KEY = "liberia360:recently-viewed";
const CHANGE_EVENT = "liberia360:recently-viewed-changed";
const MAX_ITEMS = 12;

function readItems(): RecentlyViewedItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (item): item is RecentlyViewedItem =>
        item &&
        typeof item.id === "string" &&
        (item.kind === "place" ||
          item.kind === "creator" ||
          item.kind === "event") &&
        typeof item.href === "string" &&
        typeof item.title === "string" &&
        (item.subtitle === null || typeof item.subtitle === "string") &&
        (item.imageUrl === null || typeof item.imageUrl === "string") &&
        typeof item.viewedAt === "string",
    );
  } catch {
    return [];
  }
}

function writeItems(items: RecentlyViewedItem[]): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    window.dispatchEvent(new Event(CHANGE_EVENT));
  } catch {
    // Local history is a convenience; a full or unavailable storage area must
    // never interfere with page navigation or the primary product flow.
  }
}

export function getRecentlyViewed(limit = 6): RecentlyViewedItem[] {
  return readItems().slice(0, Math.max(0, limit));
}

export function addRecentlyViewed(
  item: Omit<RecentlyViewedItem, "viewedAt">,
): void {
  const next: RecentlyViewedItem = {
    ...item,
    viewedAt: new Date().toISOString(),
  };
  const remaining = readItems().filter(
    (existing) => !(existing.id === item.id && existing.kind === item.kind),
  );
  writeItems([next, ...remaining].slice(0, MAX_ITEMS));
}

export function clearRecentlyViewed(): void {
  writeItems([]);
}

export function subscribeToRecentlyViewed(callback: () => void): () => void {
  window.addEventListener(CHANGE_EVENT, callback);
  window.addEventListener("storage", callback);
  return () => {
    window.removeEventListener(CHANGE_EVENT, callback);
    window.removeEventListener("storage", callback);
  };
}
