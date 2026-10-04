"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { BellAlertIcon } from "@heroicons/react/24/outline";
import { useAuth } from "@/hooks/useAuth";
import { apiRequest } from "@/lib/http";
type AvailabilityAlert = {
  id: string;
  experienceId: string;
  date: string;
  title: string;
  notifiedAt: string | null;
};
const path = "/guides/availability-alerts";
const button =
  "min-h-11 rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold disabled:opacity-50 dark:border-slate-700";
const errorMessage = (error: unknown) =>
  error instanceof Error
    ? error.message
    : "Unable to update alerts. Please try again.";

export function WatchGuideDate({
  experienceId,
  date,
}: {
  experienceId: string;
  date: string;
}) {
  const { user, ready } = useAuth();
  const [watching, setWatching] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    let alive = true;
    setWatching(false);
    setLoading(true);
    setError("");
    if (user)
      apiRequest<AvailabilityAlert[]>(path, { cache: "no-store" })
        .then((rows) => {
          if (alive)
            setWatching(
              rows.some(
                (row) =>
                  row.experienceId === experienceId &&
                  row.date === date &&
                  !row.notifiedAt,
              ),
            );
        })
        .catch((err) => {
          if (alive) setError(errorMessage(err));
        })
        .finally(() => {
          if (alive) setLoading(false);
        });
    return () => {
      alive = false;
    };
  }, [user?.id, experienceId, date, retry]);
  if (!ready) return null;
  if (!user)
    return (
      <p className="mt-3 text-sm">
        <Link
          className="underline"
          href={`/login?next=${encodeURIComponent(`/experiences/${experienceId}?date=${date}`)}`}
        >
          Sign in to get an availability alert
        </Link>
      </p>
    );
  return (
    <div className="mt-3 space-y-2 rounded-xl border border-slate-200 p-3 dark:border-slate-700">
      <p className="flex items-center gap-2 text-sm font-semibold">
        <BellAlertIcon aria-hidden className="h-5 w-5" />
        {watching ? "Availability alert active" : "Want this date?"}
      </p>
      <p className="text-xs text-slate-500 dark:text-slate-400">
        Get a notification in LIBERIA360 if {date} becomes available to request.
        This does not reserve a spot or confirm a booking.
      </p>
      {watching ? (
        <Link
          className="inline-flex min-h-11 items-center text-sm underline"
          href="/account#availability-alerts"
        >
          Manage alerts in Account
        </Link>
      ) : error ? (
        <>
          <p role="alert" className="text-sm text-rose-600 dark:text-rose-400">
            {error}
          </p>
          <button
            type="button"
            className={button}
            onClick={() => setRetry((value) => value + 1)}
          >
            Retry alert
          </button>
        </>
      ) : (
        <button
          type="button"
          className={button}
          disabled={loading || busy}
          onClick={async () => {
            setBusy(true);
            setError("");
            try {
              await apiRequest(
                `/experiences/${experienceId}/availability-alerts`,
                { method: "POST", body: JSON.stringify({ date }) },
              );
              setWatching(true);
            } catch (err) {
              setError(errorMessage(err));
            } finally {
              setBusy(false);
            }
          }}
        >
          {loading
            ? "Checking alert…"
            : busy
              ? "Saving…"
              : "Notify me when available"}
        </button>
      )}
    </div>
  );
}

export function GuideAvailabilityAlerts() {
  const { user } = useAuth();
  const [rows, setRows] = useState<AvailabilityAlert[] | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    let alive = true;
    setRows(null);
    setError("");
    if (user)
      apiRequest<AvailabilityAlert[]>(path, { cache: "no-store" })
        .then((data) => {
          if (alive) setRows(data);
        })
        .catch((err) => {
          if (alive) setError(errorMessage(err));
        });
    return () => {
      alive = false;
    };
  }, [user?.id, retry]);
  if (!user) return null;
  return (
    <section
      id="availability-alerts"
      className="scroll-mt-24 space-y-3 rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900 sm:p-6"
    >
      <h2 className="text-lg font-semibold">Guide availability alerts</h2>
      <p className="text-sm text-slate-500 dark:text-slate-400">
        Watch up to 20 unavailable dates. We check periodically and send one
        in-app notification when a date opens. Guide confirmation is still
        required.
      </p>
      {error && (
        <div role="alert" className="text-sm text-rose-600 dark:text-rose-400">
          {error}{" "}
          <button
            className={button}
            onClick={() => setRetry((value) => value + 1)}
          >
            Retry
          </button>
        </div>
      )}
      {!rows && !error && <p role="status">Loading alerts…</p>}
      {rows?.length === 0 && (
        <p className="text-sm">
          No upcoming alerts. Select an unavailable date on an experience to set
          one.
        </p>
      )}
      <ul className="space-y-3">
        {rows?.map((row) => (
          <li
            key={row.id}
            className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-slate-50 p-3 dark:bg-slate-800"
          >
            <div className="min-w-0 flex-1">
              <Link
                className="break-words font-medium underline"
                href={`/experiences/${row.experienceId}?date=${row.date}`}
              >
                {row.title}
              </Link>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                {row.date} ·{" "}
                {row.notifiedAt
                  ? "Notification sent"
                  : "Watching for availability"}
              </p>
            </div>
            <button
              className={button}
              disabled={busy !== null}
              onClick={async () => {
                setBusy(row.id);
                setError("");
                try {
                  await apiRequest(`${path}/${row.id}`, { method: "DELETE" });
                  setRows(
                    (current) =>
                      current?.filter((item) => item.id !== row.id) ?? [],
                  );
                } catch (err) {
                  setError(errorMessage(err));
                } finally {
                  setBusy(null);
                }
              }}
            >
              {busy === row.id
                ? "Removing…"
                : row.notifiedAt
                  ? "Remove"
                  : "Stop alert"}
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
