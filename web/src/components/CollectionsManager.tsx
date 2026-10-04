"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { apiRequest } from "@/lib/http";
import {
  collectionItem,
  readSharedCollection,
  type SavedCollection,
} from "@/lib/collections";
import { DeviceCollectionsManager } from "./DeviceCollectionsManager";
type AccountCollection = SavedCollection & {
  version: number;
  shareToken: string | null;
};
const input =
  "min-h-12 w-full min-w-0 rounded-xl border border-slate-300 bg-transparent p-3 dark:border-slate-700";
const button =
  "min-h-11 rounded-xl border border-slate-300 px-4 py-2 font-semibold disabled:opacity-50 dark:border-slate-700";
export function CollectionsManager() {
  const { user, ready } = useAuth();
  return (
    <>
      {ready && <LiveSharedCollection />}
      {!ready ? (
        <p role="status">Loading collections…</p>
      ) : user ? (
        <AccountCollections key={user.id} userId={user.id} />
      ) : (
        <>
          <p className="mb-4 text-sm">
            <Link className="underline" href="/login?next=/collections">
              Sign in
            </Link>{" "}
            to sync collections across devices.
          </p>
          <DeviceCollectionsManager />
        </>
      )}
    </>
  );
}
function LiveSharedCollection() {
  const [shared, setShared] = useState<SavedCollection | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    let alive = true;
    const token = new URLSearchParams(window.location.search).get("share");
    if (!token) return;
    apiRequest<Omit<SavedCollection, "id">>(
      `/collections/shared/${encodeURIComponent(token)}`,
      { cache: "no-store" },
    )
      .then((row) => {
        if (alive) setShared({ ...row, id: "shared" });
      })
      .catch(() => {
        if (alive)
          setError(
            "This collection is unavailable or its owner has stopped sharing it.",
          );
      });
    return () => {
      alive = false;
    };
  }, []);
  if (error)
    return (
      <p role="alert" className="mb-6">
        {error}
      </p>
    );
  if (!shared) return null;
  return (
    <section className="mb-6 rounded-2xl border border-emerald-400 p-5">
      <h2 className="text-xl font-bold">{shared.name}</h2>
      <p className="mt-1 text-sm text-slate-500">
        Shared collection · reflects the owner&apos;s latest saved changes when
        opened
      </p>
      <ul className="mt-4 space-y-3">
        {shared.items.map((item) => (
          <li key={item.path}>
            <Link
              className="block break-words rounded-xl border p-3"
              href={item.path}
            >
              {item.title} →
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
function AccountCollections({ userId }: { userId: string }) {
  const [rows, setRows] = useState<AccountCollection[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [selected, setSelected] = useState("");
  const [name, setName] = useState("");
  const [title, setTitle] = useState("");
  const [url, setUrl] = useState("");
  const [imports, setImports] = useState<SavedCollection[]>([]);
  const [shareUrl, setShareUrl] = useState("");
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  async function load() {
    setError("");
    try {
      const result = await apiRequest<AccountCollection[]>("/collections", {
        cache: "no-store",
      });
      if (mounted.current) {
        setRows(result);
        setLoaded(true);
      }
    } catch {
      if (mounted.current)
        setError(
          "Could not load your account collections. Check your connection and retry.",
        );
    }
  }
  useEffect(() => {
    void load();
    try {
      const stored = JSON.parse(
        localStorage.getItem(`liberia360:collections:${userId}`) || "[]",
      );
      const local = Array.isArray(stored)
        ? stored.slice(0, 30).flatMap((raw) => {
            const checked = readSharedCollection(
              encodeURIComponent(JSON.stringify(raw)),
            );
            return checked && typeof raw.id === "string"
              ? [{ ...checked, id: raw.id }]
              : [];
          })
        : [];
      const legacy = window.location.hash
        ? readSharedCollection(window.location.hash)
        : null;
      setImports(
        legacy ? [...local, { ...legacy, id: crypto.randomUUID() }] : local,
      );
    } catch {
      /* Device data stays untouched if unreadable. */
    }
  }, [userId]);
  async function save(
    row: SavedCollection & { version?: number; shareToken?: string | null },
    shared?: boolean,
  ) {
    const saved = await apiRequest<AccountCollection>(
      `/collections/${row.id}`,
      {
        method: "PUT",
        body: JSON.stringify({
          name: row.name,
          items: row.items,
          version: row.version ?? 0,
          ...(shared === undefined ? {} : { shared }),
        }),
      },
    );
    if (mounted.current) {
      setRows((previous) => [
        ...previous.filter((value) => value.id !== saved.id),
        saved,
      ]);
      setSelected(saved.id);
      setNotice("Saved to your account.");
    }
    return saved;
  }
  async function run(action: () => Promise<unknown>) {
    if (busy) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await action();
    } catch (err) {
      if (mounted.current)
        setError(
          err instanceof Error ? err.message : "Could not save. Please retry.",
        );
    } finally {
      if (mounted.current) setBusy(false);
    }
  }
  const active = rows.find((row) => row.id === selected);
  return (
    <div className="space-y-5">
      <p className="text-sm text-slate-500">
        Your collections sync across devices when you sign in. Collections are
        private until you enable sharing. Anyone with a shared link can view it.
      </p>
      {error && (
        <div role="alert" className="rounded-xl border border-rose-300 p-4">
          <p>{error}</p>
          <button
            type="button"
            className={button + " mt-2"}
            disabled={busy}
            onClick={() => void load()}
          >
            Reload collections
          </button>
        </div>
      )}
      {notice && <p role="status">{notice}</p>}
      {!loaded ? (
        <p role="status">
          {error ? "Waiting to reconnect." : "Loading your collections…"}
        </p>
      ) : (
        <fieldset disabled={busy} className="min-w-0 space-y-5">
          {imports.length > 0 && (
            <section className="rounded-xl border p-4">
              <p>
                {imports.length} existing device or snapshot collection(s) are
                available to import. Your originals will be kept.
              </p>
              <button
                className={button + " mt-3"}
                type="button"
                onClick={() =>
                  void run(async () => {
                    for (const item of imports) {
                      if (rows.some((row) => row.id === item.id)) continue;
                      await save(item);
                    }
                    setImports([]);
                    setNotice("Collections imported to your account.");
                  })
                }
              >
                Import existing collections
              </button>
            </section>
          )}
          <form
            className="flex flex-wrap gap-2"
            onSubmit={(event) => {
              event.preventDefault();
              if (!name.trim()) return;
              void run(async () => {
                await save({
                  id: crypto.randomUUID(),
                  name: name.trim(),
                  items: [],
                });
                setName("");
              });
            }}
          >
            <input
              className={input + " flex-1"}
              required
              maxLength={80}
              aria-label="New collection name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Weekend ideas, places to visit…"
            />
            <button className={button} disabled={rows.length >= 30}>
              Create collection
            </button>
          </form>
          <label className="block font-semibold">
            Your collections
            <select
              className={input + " mt-2 dark:bg-slate-900"}
              value={selected}
              onChange={(e) => {
                setSelected(e.target.value);
                setShareUrl("");
              }}
            >
              <option value="">Choose a collection</option>
              {rows.map((row) => (
                <option key={row.id} value={row.id}>
                  {row.name} ({row.items.length})
                </option>
              ))}
            </select>
          </label>
          {active && (
            <section className="space-y-4 rounded-2xl border p-4">
              <h2 className="break-words text-xl font-bold">{active.name}</h2>
              <form
                className="space-y-3"
                onSubmit={(event) => {
                  event.preventDefault();
                  const item = collectionItem(title, url);
                  if (!item) {
                    setError(
                      "Paste a Liberia360 place, creator post, or experience link.",
                    );
                    return;
                  }
                  if (
                    active.items.some((existing) => existing.path === item.path)
                  ) {
                    setError("This item is already in the collection.");
                    return;
                  }
                  void run(async () => {
                    await save({ ...active, items: [...active.items, item] });
                    setTitle("");
                    setUrl("");
                  });
                }}
              >
                <input
                  className={input}
                  aria-label="Item name"
                  maxLength={100}
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Item name (optional)"
                />
                <input
                  className={input}
                  aria-label="Listing or post link"
                  required
                  maxLength={500}
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="Paste a Liberia360 link"
                />
                <button disabled={active.items.length >= 30} className={button}>
                  Add to collection
                </button>
              </form>
              <ul className="space-y-2">
                {active.items.map((item) => (
                  <li
                    className="flex items-center gap-3 rounded-xl bg-slate-50 p-3 dark:bg-slate-800"
                    key={item.path}
                  >
                    <Link
                      className="min-w-0 flex-1 break-words"
                      href={item.path}
                    >
                      {item.title} →
                    </Link>
                    <button
                      type="button"
                      className={button}
                      aria-label={`Remove ${item.title}`}
                      onClick={() =>
                        void run(() =>
                          save({
                            ...active,
                            items: active.items.filter(
                              (value) => value.path !== item.path,
                            ),
                          }),
                        )
                      }
                    >
                      Remove
                    </button>
                  </li>
                ))}
              </ul>
              <p className="text-sm">
                {active.shareToken
                  ? "Sharing enabled. Edits appear the next time someone opens the link."
                  : "Private collection. Enabling sharing makes its name and items visible to anyone with the link."}
              </p>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  className={button}
                  onClick={() =>
                    void run(async () => {
                      const saved = active.shareToken
                        ? active
                        : await save(active, true);
                      const link = `${window.location.origin}/collections?share=${saved.shareToken}`;
                      setShareUrl(link);
                      try {
                        await navigator.clipboard.writeText(link);
                        setNotice("Share link copied.");
                      } catch {
                        setNotice("Copy the share link below.");
                      }
                    })
                  }
                >
                  {active.shareToken
                    ? "Copy live share link"
                    : "Enable sharing & copy link"}
                </button>
                {active.shareToken && (
                  <button
                    type="button"
                    className={button}
                    onClick={() =>
                      void run(async () => {
                        await save(active, false);
                        setShareUrl("");
                        setNotice(
                          "Sharing stopped. The old link no longer works.",
                        );
                      })
                    }
                  >
                    Stop sharing
                  </button>
                )}
                <button
                  type="button"
                  className={button + " text-rose-600"}
                  onClick={() => {
                    if (
                      !window.confirm(
                        `Delete “${active.name}” from your account?`,
                      )
                    )
                      return;
                    void run(async () => {
                      await apiRequest(`/collections/${active.id}`, {
                        method: "DELETE",
                      });
                      setRows(rows.filter((row) => row.id !== active.id));
                      setSelected("");
                      setShareUrl("");
                      setNotice("Collection deleted.");
                    });
                  }}
                >
                  Delete collection
                </button>
              </div>
              {shareUrl && (
                <input
                  className={input}
                  aria-label="Collection share link"
                  readOnly
                  value={shareUrl}
                  onFocus={(e) => e.target.select()}
                />
              )}
            </section>
          )}
        </fieldset>
      )}
    </div>
  );
}
