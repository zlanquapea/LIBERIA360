"use client";
import { useEffect, useState } from "react";
import {
  BellIcon,
  BellSlashIcon,
  ArrowPathIcon,
} from "@heroicons/react/24/outline";
import { apiRequest } from "@/lib/http";
type Activity = {
  id: string;
  kind: "suggested" | "added";
  title: string;
  actor: string;
  target: string;
  createdAt: string;
};
type Feed = { items: Activity[]; hasMore: boolean; muted: boolean };
export function TripActivityPanel({ tripId }: { tripId: string }) {
  const [data, setData] = useState<Feed | null>(null);
  const [page, setPage] = useState(0);
  const [reload, setReload] = useState(0);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const path = `/itineraries/${tripId}/activity`;
  useEffect(() => {
    let active = true;
    setData(null);
    setError("");
    apiRequest<Feed>(`${path}?page=${page}`, { cache: "no-store" })
      .then((d) => {
        if (active) setData(d);
      })
      .catch(() => {
        if (active) setError("Could not load trip activity. Please retry.");
      });
    return () => {
      active = false;
    };
  }, [path, page, reload]);
  useEffect(() => {
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible" && !busy && page === 0)
        setReload((n) => n + 1);
    }, 30000);
    return () => window.clearInterval(timer);
  }, [busy, page]);
  useEffect(() => {
    const target = window.location.hash.slice(1);
    if (!/^trip-(stop|suggestion)-/.test(target)) return;
    const scroll = () => {
      const el = document.getElementById(target);
      if (el) {
        el.scrollIntoView?.({ block: "center" });
        return true;
      }
      return false;
    };
    if (scroll()) return;
    const observer = new MutationObserver(() => {
      if (scroll()) observer.disconnect();
    });
    observer.observe(document.body, { childList: true, subtree: true });
    const timer = window.setTimeout(() => observer.disconnect(), 10000);
    return () => {
      observer.disconnect();
      window.clearTimeout(timer);
    };
  }, [tripId]);
  async function toggle() {
    if (!data) return;
    setBusy(true);
    setError("");
    try {
      const saved = await apiRequest<{ muted: boolean }>(
        `${path}/preferences`,
        { method: "PUT", body: JSON.stringify({ muted: !data.muted }) },
      );
      setData((d) => (d ? { ...d, muted: saved.muted } : d));
    } catch {
      setError("Could not save notification preference. Please retry.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <section
      id="trip-activity"
      className="space-y-4 rounded-2xl border border-slate-200 bg-white p-4 sm:p-6 dark:border-neutral-700 dark:bg-neutral-900"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold">Trip activity</h2>
          <p className="mt-1 text-sm text-slate-500 dark:text-neutral-400">
            Suggestions and itinerary additions, shared with your trip members.
          </p>
        </div>
        <button
          type="button"
          aria-label="Refresh trip activity"
          disabled={busy}
          onClick={() => setReload((n) => n + 1)}
          className="rounded-full border p-3"
        >
          <ArrowPathIcon className="h-5 w-5" aria-hidden="true" />
        </button>
      </div>
      {error && (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {error}
        </p>
      )}
      {notice && (
        <p role="status" className="text-sm">
          {notice}
        </p>
      )}
      {!data && !error && (
        <p role="status" className="text-sm">
          Loading activity…
        </p>
      )}
      {data && (
        <>
          <button
            type="button"
            aria-pressed={data.muted}
            disabled={busy}
            onClick={toggle}
            className="flex min-h-11 items-center gap-2 rounded-xl border px-3 py-2 text-sm"
          >
            {data.muted ? (
              <BellSlashIcon className="h-5 w-5" aria-hidden="true" />
            ) : (
              <BellIcon className="h-5 w-5" aria-hidden="true" />
            )}
            {data.muted ? "Unmute trip updates" : "Mute trip updates"}
          </button>
          <p className="text-xs text-slate-500 dark:text-neutral-400">
            {data.muted
              ? "Activity notifications are muted for this trip. History stays visible."
              : "New suggestions and additions appear in your in-app notifications."}{" "}
            Messages and booking alerts keep their own settings.
          </p>
          {!data.items.length && (
            <p className="rounded-xl bg-slate-50 p-4 text-sm dark:bg-neutral-800">
              No activity yet. New suggestions and itinerary additions will
              appear here.
            </p>
          )}
          <ol className="space-y-3">
            {data.items.map((item) => (
              <li
                key={item.id}
                className="border-s-2 border-brand-500 ps-4 py-1"
              >
                <p className="text-sm">
                  <span className="font-semibold">{item.actor}</span>{" "}
                  {item.kind === "suggested"
                    ? "suggested"
                    : "added to the itinerary"}
                </p>
                <a
                  href={`#${item.target}`}
                  onClick={(e) => {
                    if (!document.getElementById(item.target)) {
                      e.preventDefault();
                      setNotice(
                        "This item is no longer available in the current trip. Its history is kept here.",
                      );
                    } else setNotice("");
                  }}
                  className="mt-1 inline-block break-words font-semibold text-brand-700 underline decoration-brand-200 underline-offset-4 dark:text-brand-300"
                >
                  {item.title}
                </a>
                <time
                  dateTime={item.createdAt}
                  className="mt-1 block text-xs text-slate-500 dark:text-neutral-400"
                >
                  {new Date(item.createdAt).toLocaleString()}
                </time>
              </li>
            ))}
          </ol>
          <div className="flex items-center justify-between gap-3">
            <button
              type="button"
              disabled={page === 0 || busy}
              onClick={() => setPage((p) => p - 1)}
              className="min-h-11 rounded-lg border px-3 disabled:opacity-40"
            >
              Newer
            </button>
            <span className="text-xs">Page {page + 1}</span>
            <button
              type="button"
              disabled={!data.hasMore || busy}
              onClick={() => setPage((p) => p + 1)}
              className="min-h-11 rounded-lg border px-3 disabled:opacity-40"
            >
              Older
            </button>
          </div>
        </>
      )}
    </section>
  );
}
