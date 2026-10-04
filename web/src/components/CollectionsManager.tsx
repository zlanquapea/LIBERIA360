"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import {
  collectionItem,
  collectionShareUrl,
  readSharedCollection,
  type SavedCollection,
} from "@/lib/collections";

export function CollectionsManager() {
  const { user, ready } = useAuth();
  const key = `liberia360:collections:${user?.id ?? "guest"}`;
  const [collections, setCollections] = useState<SavedCollection[]>([]);
  const [loadedKey, setLoadedKey] = useState("");
  const [shared, setShared] = useState<SavedCollection | null>(null);
  const [name, setName] = useState("");
  const [title, setTitle] = useState("");
  const [url, setUrl] = useState("");
  const [selected, setSelected] = useState("");
  const [notice, setNotice] = useState("");
  const [shareUrl, setShareUrl] = useState("");
  useEffect(() => {
    if (!ready) return;
    setLoadedKey("");
    setCollections([]);
    setSelected("");
    try {
      const data = JSON.parse(localStorage.getItem(key) || "[]");
      if (Array.isArray(data))
        setCollections(
          data.slice(0, 30).flatMap((raw) => {
            const checked = readSharedCollection(
              encodeURIComponent(JSON.stringify(raw)),
            );
            return checked && typeof raw.id === "string"
              ? [{ ...checked, id: raw.id }]
              : [];
          }),
        );
    } catch {
      setNotice("Saved collections could not be read on this device.");
    }
    setLoadedKey(key);
    const readHash = () => {
      const hash = window.location.hash;
      setShared(hash ? readSharedCollection(hash) : null);
      if (hash && !readSharedCollection(hash))
        setNotice("This shared collection link is invalid.");
    };
    readHash();
    window.addEventListener("hashchange", readHash);
    return () => window.removeEventListener("hashchange", readHash);
  }, [key, ready]);
  function save(next: SavedCollection[]) {
    if (loadedKey !== key) return;
    try {
      localStorage.setItem(key, JSON.stringify(next));
      setCollections(next);
      setNotice("Collection saved on this device.");
    } catch {
      setNotice("Could not save. Device storage may be full or unavailable.");
    }
  }
  const active = collections.find((item) => item.id === selected);
  if (!ready || loadedKey !== key)
    return <p role="status">Loading collections…</p>;
  return (
    <div className="space-y-6">
      <p className="text-sm text-slate-500 dark:text-slate-400">
        Keep places, posts and experiences together. Collections are saved on
        this device. Shared links contain a snapshot; later edits need a new
        link.
      </p>
      {notice && (
        <p
          role="status"
          className="rounded-xl bg-slate-100 p-3 text-sm dark:bg-slate-800"
        >
          {notice}
        </p>
      )}
      {shared && (
        <section className="rounded-2xl border border-emerald-300 p-5">
          <h2 className="text-xl font-bold">{shared.name}</h2>
          <p className="mt-1 text-xs text-slate-500">
            Shared collection · read-only snapshot
          </p>
          <ul className="mt-3 space-y-2">
            {shared.items.map((item) => (
              <li key={item.path}>
                <Link
                  className="block rounded-xl border border-slate-200 p-3 dark:border-slate-700"
                  href={item.path}
                >
                  {item.title} →
                </Link>
              </li>
            ))}
          </ul>
          <button
            type="button"
            disabled={collections.length >= 30}
            className="mt-4 min-h-11 rounded-full bg-brand-700 px-4 font-semibold text-white disabled:opacity-50"
            onClick={() => {
              const copy = { ...shared, id: crypto.randomUUID() };
              save([...collections, copy]);
              setSelected(copy.id);
            }}
          >
            Save my own copy
          </button>
        </section>
      )}
      <form
        className="flex flex-wrap gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          if (!name.trim() || collections.length >= 30) return;
          const created = {
            id: crypto.randomUUID(),
            name: name.trim(),
            items: [],
          };
          save([...collections, created]);
          setSelected(created.id);
          setName("");
        }}
      >
        <input
          aria-label="New collection name"
          required
          maxLength={80}
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="Weekend ideas, places to visit…"
          className="min-h-12 min-w-0 flex-1 rounded-xl border border-slate-300 bg-transparent p-3 dark:border-slate-700"
        />
        <button
          disabled={collections.length >= 30}
          className="min-h-12 rounded-xl bg-brand-700 px-4 font-semibold text-white disabled:opacity-50"
        >
          Create collection
        </button>
      </form>
      <label className="block text-sm font-semibold">
        Your collections
        <select
          className="mt-2 min-h-12 w-full rounded-xl border border-slate-300 bg-white p-3 dark:border-slate-700 dark:bg-slate-900"
          value={selected}
          onChange={(event) => {
            setSelected(event.target.value);
            setShareUrl("");
          }}
        >
          <option value="">Choose a collection</option>
          {collections.map((item) => (
            <option key={item.id} value={item.id}>
              {item.name} ({item.items.length})
            </option>
          ))}
        </select>
      </label>
      {active && (
        <section className="space-y-4 rounded-2xl border border-slate-200 p-4 dark:border-slate-700">
          <h2 className="text-xl font-bold">{active.name}</h2>
          <form
            className="space-y-3"
            onSubmit={(event) => {
              event.preventDefault();
              const item = collectionItem(title, url);
              if (!item) {
                setNotice(
                  "Paste a Liberia360 place, creator post, or experience link.",
                );
                return;
              }
              if (
                active.items.some((existing) => existing.path === item.path)
              ) {
                setNotice("This item is already in the collection.");
                return;
              }
              if (active.items.length >= 30) {
                setNotice("Each collection holds up to 30 items.");
                return;
              }
              save(
                collections.map((collection) =>
                  collection.id === active.id
                    ? { ...collection, items: [...collection.items, item] }
                    : collection,
                ),
              );
              setTitle("");
              setUrl("");
              setShareUrl("");
            }}
          >
            <input
              aria-label="Item name"
              maxLength={100}
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Item name (optional)"
              className="min-h-11 w-full rounded-xl border border-slate-300 bg-transparent p-3 dark:border-slate-700"
            />
            <input
              aria-label="Listing or post link"
              required
              value={url}
              maxLength={500}
              onChange={(event) => setUrl(event.target.value)}
              placeholder="Paste a Liberia360 link"
              className="min-h-11 w-full rounded-xl border border-slate-300 bg-transparent p-3 dark:border-slate-700"
            />
            <button className="min-h-11 rounded-full bg-brand-700 px-4 font-semibold text-white">
              Add to collection
            </button>
          </form>
          <ul className="space-y-2">
            {active.items.map((item) => (
              <li
                key={item.path}
                className="flex items-center gap-3 rounded-xl bg-slate-50 p-3 dark:bg-slate-800"
              >
                <Link
                  className="min-w-0 flex-1 break-words font-medium"
                  href={item.path}
                >
                  {item.title} →
                </Link>
                <button
                  type="button"
                  aria-label={`Remove ${item.title}`}
                  className="min-h-11 px-2 text-sm text-rose-600 dark:text-rose-300"
                  onClick={() => {
                    save(
                      collections.map((collection) =>
                        collection.id === active.id
                          ? {
                              ...collection,
                              items: collection.items.filter(
                                (value) => value.path !== item.path,
                              ),
                            }
                          : collection,
                      ),
                    );
                    setShareUrl("");
                  }}
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
          <button
            type="button"
            className="min-h-11 rounded-full border border-slate-300 px-4 font-semibold dark:border-slate-700"
            onClick={async () => {
              try {
                const link = collectionShareUrl(active, window.location.origin);
                setShareUrl(link);
                await navigator.clipboard.writeText(link);
                setNotice("Share link copied.");
              } catch (error) {
                setNotice(
                  error instanceof Error && error.message.includes("too large")
                    ? error.message
                    : "Copy the share link below.",
                );
              }
            }}
          >
            Copy share link
          </button>
          {shareUrl && (
            <input
              aria-label="Collection share link"
              readOnly
              value={shareUrl}
              onFocus={(event) => event.target.select()}
              className="min-h-11 w-full rounded-xl border border-slate-300 bg-transparent p-3 text-xs dark:border-slate-700"
            />
          )}
        </section>
      )}
    </div>
  );
}
