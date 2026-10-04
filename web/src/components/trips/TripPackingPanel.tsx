"use client";
import { useEffect, useRef, useState } from "react";
import {
  ClipboardDocumentCheckIcon,
  PlusIcon,
} from "@heroicons/react/24/outline";
import { HttpError } from "@/lib/http";
import {
  addPackingStarter,
  getTripPacking,
  saveTripPacking,
  PACKING_STARTERS,
  type PackingItem,
  type TripPackingList,
} from "@/lib/trip-packing-api";
const button =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-slate-300 px-3 py-2 text-sm font-semibold disabled:opacity-50 dark:border-slate-700";
const field =
  "mt-1 min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950";
const categories = ["essentials", "clothing", "toiletries", "gear", "other"];

export function TripPackingPanel({ tripId }: { tripId: string }) {
  const [data, setData] = useState<TripPackingList | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const saving = useRef(false);
  const [reload, setReload] = useState(0);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [conflict, setConflict] = useState(false);
  const [filter, setFilter] = useState<"all" | "remaining" | "packed">("all");
  const [draft, setDraft] = useState<PackingItem | null>(null);
  const [removeId, setRemoveId] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setData(null);
    setError("");
    setNotice("");
    setConflict(false);
    setDraft(null);
    setRemoveId(null);
    getTripPacking(tripId)
      .then((list) => {
        if (!cancelled) setData(list);
      })
      .catch((err) => {
        if (!cancelled)
          setError(
            err instanceof Error
              ? err.message
              : "Unable to load your checklist.",
          );
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [tripId, reload]);
  async function save(items: PackingItem[]) {
    if (!data || saving.current || conflict) return false;
    if (items.length > 200) {
      setError("Your checklist can contain up to 200 items.");
      return false;
    }
    saving.current = true;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      setData(await saveTripPacking(tripId, { version: data.version, items }));
      setNotice("Checklist saved.");
      return true;
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to save. Please try again.",
      );
      if (err instanceof HttpError && err.status === 409) setConflict(true);
      return false;
    } finally {
      saving.current = false;
      setBusy(false);
    }
  }
  const disabled = busy || conflict;
  const packed = data?.items.filter((item) => item.packed).length ?? 0;
  const items =
    data?.items.filter(
      (item) =>
        filter === "all" || (filter === "packed" ? item.packed : !item.packed),
    ) ?? [];
  function startItem(item?: PackingItem) {
    setError("");
    setNotice("");
    setRemoveId(null);
    setDraft(
      item
        ? { ...item }
        : {
            id: crypto.randomUUID(),
            name: "",
            category: "other",
            quantity: 1,
            packed: false,
          },
    );
  }
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!data || !draft) return;
    const name = draft.name.trim();
    if (
      !name ||
      !Number.isInteger(draft.quantity) ||
      draft.quantity < 1 ||
      draft.quantity > 99
    ) {
      setError("Enter an item name and a quantity from 1 to 99.");
      return;
    }
    if (
      data.items.some(
        (item) =>
          item.id !== draft.id &&
          item.name.toLowerCase() === name.toLowerCase(),
      )
    ) {
      setError("This item is already on your list. Edit its quantity instead.");
      return;
    }
    const exists = data.items.some((item) => item.id === draft.id);
    const item = { ...draft, name };
    if (
      await save(
        exists
          ? data.items.map((entry) => (entry.id === item.id ? item : entry))
          : [...data.items, item],
      )
    ) {
      setDraft(null);
      setFilter("all");
    }
  }
  return (
    <section
      className="space-y-4 rounded-2xl border border-slate-200 bg-white p-4 text-slate-900 shadow-sm dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100 sm:p-6"
      aria-label="My packing checklist"
    >
      <div className="flex items-start gap-3">
        <span className="rounded-xl bg-brand-50 p-3 text-brand-800 dark:bg-brand-950 dark:text-brand-200">
          <ClipboardDocumentCheckIcon aria-hidden className="h-6 w-6" />
        </span>
        <div>
          <h2 className="text-xl font-bold">My packing checklist</h2>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Your own list for this trip. Only you can see or change it.
          </p>
        </div>
      </div>
      {loading && <p role="status">Loading your checklist…</p>}
      {error && (
        <div
          role="alert"
          className="rounded-xl bg-rose-50 p-3 text-sm text-rose-700 dark:bg-rose-950 dark:text-rose-200"
        >
          {error}
          {(!data || conflict) && (
            <button
              className={`${button} mt-2`}
              onClick={() => setReload((value) => value + 1)}
            >
              {conflict
                ? "Reload latest checklist (discard draft)"
                : "Retry checklist"}
            </button>
          )}
        </div>
      )}
      {notice && (
        <p
          role="status"
          className="text-sm text-emerald-700 dark:text-emerald-300"
        >
          {notice}
        </p>
      )}
      {data && (
        <>
          <div className="rounded-xl bg-slate-50 p-4 dark:bg-slate-800">
            <div className="flex flex-wrap justify-between gap-2 text-sm">
              <strong>
                {packed} of {data.items.length} packed
              </strong>
              <span>
                {data.items.length > 0 && packed === data.items.length
                  ? "Everything on your list is packed!"
                  : `${data.items.length - packed} remaining`}
              </span>
            </div>
            <progress
              aria-label="Packing progress"
              value={packed}
              max={data.items.length || 1}
              className="mt-3 h-2 w-full accent-emerald-600"
            />
          </div>
          <div>
            <p className="mb-2 text-sm font-medium">Add a starter list</p>
            <div className="flex flex-wrap gap-2">
              {Object.keys(PACKING_STARTERS).map((starter) => (
                <button
                  key={starter}
                  className={button}
                  disabled={disabled || !!draft}
                  onClick={() => {
                    const next = addPackingStarter(data.items, starter);
                    if (next.length === data.items.length) {
                      setNotice("These items are already on your list.");
                      return;
                    }
                    void save(next);
                  }}
                >
                  {starter}
                </button>
              ))}
            </div>
            <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
              Starter lists are editable suggestions. Existing items and packed
              progress are preserved.
            </p>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div
              className="flex flex-wrap gap-1"
              aria-label="Filter packing items"
            >
              {(["all", "remaining", "packed"] as const).map((value) => (
                <button
                  key={value}
                  className={`${button} ${filter === value ? "bg-brand-50 text-brand-800 dark:bg-brand-950 dark:text-brand-200" : ""}`}
                  aria-pressed={filter === value}
                  onClick={() => setFilter(value)}
                >
                  {value[0].toUpperCase() + value.slice(1)}
                </button>
              ))}
            </div>
            <button
              className={`${button} bg-brand-800 text-white dark:bg-brand-700`}
              disabled={disabled || !!draft || data.items.length >= 200}
              onClick={() => startItem()}
            >
              <PlusIcon aria-hidden className="h-4 w-4" />
              Add item
            </button>
          </div>
          {draft && (
            <form
              onSubmit={submit}
              className="space-y-3 rounded-xl border border-slate-200 p-4 dark:border-slate-700"
            >
              <h3 className="font-semibold">
                {data.items.some((item) => item.id === draft.id)
                  ? "Edit packing item"
                  : "New packing item"}
              </h3>
              <fieldset disabled={disabled} className="space-y-3">
                <label className="block text-sm">
                  Item name
                  <input
                    autoFocus
                    required
                    maxLength={100}
                    className={field}
                    value={draft.name}
                    onChange={(event) =>
                      setDraft({ ...draft, name: event.target.value })
                    }
                    placeholder="e.g. Phone charger"
                  />
                </label>
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="text-sm">
                    Quantity
                    <input
                      required
                      type="number"
                      min={1}
                      max={99}
                      step={1}
                      className={field}
                      value={draft.quantity || ""}
                      onChange={(event) =>
                        setDraft({
                          ...draft,
                          quantity: Number(event.target.value),
                        })
                      }
                    />
                  </label>
                  <label className="text-sm">
                    Category
                    <select
                      className={field}
                      value={draft.category}
                      onChange={(event) =>
                        setDraft({ ...draft, category: event.target.value })
                      }
                    >
                      {categories.map((category) => (
                        <option key={category} value={category}>
                          {category[0].toUpperCase() + category.slice(1)}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
              </fieldset>
              <div className="flex flex-wrap gap-2">
                <button className={button} disabled={disabled}>
                  {busy ? "Saving…" : "Save item"}
                </button>
                <button
                  type="button"
                  className={button}
                  disabled={busy}
                  onClick={() => setDraft(null)}
                >
                  Cancel
                </button>
              </div>
            </form>
          )}
          {!data.items.length && (
            <p className="rounded-xl bg-slate-50 p-4 text-sm text-slate-500 dark:bg-slate-800 dark:text-slate-400">
              Start with Essentials or add your first item. Your progress saves
              to your account.
            </p>
          )}
          {data.items.length > 0 && !items.length && (
            <p className="text-sm text-slate-500 dark:text-slate-400">
              {filter === "remaining"
                ? "Nothing left to pack."
                : "No packed items yet."}
            </p>
          )}
          <ul className="space-y-2">
            {items.map((item) => (
              <li
                key={item.id}
                className="rounded-xl border border-slate-200 p-3 dark:border-slate-700"
              >
                <div className="flex items-start gap-3">
                  <label className="flex min-h-11 min-w-0 flex-1 cursor-pointer items-center gap-3">
                    <input
                      type="checkbox"
                      className="h-5 w-5 shrink-0 accent-emerald-600"
                      checked={item.packed}
                      disabled={disabled || !!draft}
                      onChange={() =>
                        void save(
                          data.items.map((entry) =>
                            entry.id === item.id
                              ? { ...entry, packed: !entry.packed }
                              : entry,
                          ),
                        )
                      }
                      aria-label={`Packed: ${item.name}`}
                    />
                    <span className="min-w-0">
                      <span
                        className={`block break-words text-sm font-medium ${item.packed ? "text-slate-500 line-through dark:text-slate-400" : ""}`}
                      >
                        {item.name}
                      </span>
                      <span className="block text-xs capitalize text-slate-500 dark:text-slate-400">
                        {item.category} · Qty {item.quantity}
                      </span>
                    </span>
                  </label>
                  <button
                    className={button}
                    disabled={disabled || !!draft}
                    onClick={() => startItem(item)}
                    aria-label={`Edit ${item.name}`}
                  >
                    Edit
                  </button>
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-2">
                  {removeId === item.id ? (
                    <>
                      <span className="w-full text-sm">
                        Remove “{item.name}” from your checklist?
                      </span>
                      <button
                        className={button}
                        disabled={disabled}
                        onClick={async () => {
                          if (
                            await save(
                              data.items.filter(
                                (entry) => entry.id !== item.id,
                              ),
                            )
                          )
                            setRemoveId(null);
                        }}
                      >
                        Confirm remove
                      </button>
                      <button
                        className={button}
                        disabled={busy}
                        onClick={() => setRemoveId(null)}
                      >
                        Cancel
                      </button>
                    </>
                  ) : (
                    <button
                      className="min-h-11 px-2 text-xs text-slate-500 underline disabled:opacity-50 dark:text-slate-400"
                      disabled={disabled || !!draft}
                      onClick={() => setRemoveId(item.id)}
                      aria-label={`Remove ${item.name}`}
                    >
                      Remove
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
