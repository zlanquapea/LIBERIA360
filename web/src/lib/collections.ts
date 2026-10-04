export interface CollectionItem {
  title: string;
  path: string;
}
export interface SavedCollection {
  id: string;
  name: string;
  items: CollectionItem[];
}
export function collectionItem(
  title: string,
  value: string,
): CollectionItem | null {
  try {
    const url = new URL(value, "https://liberia360.net");
    if (
      url.protocol !== "https:" ||
      !["liberia360.net", "www.liberia360.net"].includes(url.hostname) ||
      url.username ||
      url.password ||
      url.port
    )
      return null;
    const path = url.pathname
      .replace(/^\/(en|fr|ar|zh)\//, "/")
      .replace(/\/$/, "");
    if (
      !/^\/(places|experiences|creators\/posts)\/[a-zA-Z0-9_-]{1,200}$/.test(
        path,
      )
    )
      return null;
    return {
      title:
        title.trim().slice(0, 100) ||
        path.split("/").at(-1)!.replaceAll("-", " "),
      path,
    };
  } catch {
    return null;
  }
}
export function readSharedCollection(hash: string): SavedCollection | null {
  if (hash.length > 16000) return null;
  try {
    const parsed = JSON.parse(decodeURIComponent(hash.replace(/^#/, "")));
    if (
      typeof parsed.name !== "string" ||
      !Array.isArray(parsed.items) ||
      parsed.items.length > 30
    )
      return null;
    const items = parsed.items.map((item: CollectionItem) =>
      typeof item?.title === "string" && typeof item?.path === "string"
        ? collectionItem(item.title, item.path)
        : null,
    );
    if (items.some((item: CollectionItem | null) => !item)) return null;
    return { id: "shared", name: parsed.name.slice(0, 80), items };
  } catch {
    return null;
  }
}
export function collectionShareUrl(
  collection: SavedCollection,
  origin: string,
) {
  const url =
    origin +
    "/collections#" +
    encodeURIComponent(
      JSON.stringify({ name: collection.name, items: collection.items }),
    );
  if (url.length > 16000)
    throw new Error(
      "This collection is too large to share. Remove a few items first.",
    );
  return url;
}
