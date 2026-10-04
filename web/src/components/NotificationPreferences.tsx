"use client";
import { useEffect, useState } from "react";
import { apiRequest } from "@/lib/http";
import { PushNotificationToggle } from "./PushNotificationToggle";
type Preferences = {
  bookings: boolean;
  messages: boolean;
  trips: boolean;
  creators: boolean;
};
export function NotificationPreferences() {
  const [prefs, setPrefs] = useState<Preferences | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  async function load() {
    try {
      setPrefs(await apiRequest<Preferences>("/notifications/preferences"));
      setMessage("");
    } catch {
      setMessage("Could not load preferences. Please retry.");
    }
  }
  useEffect(() => {
    void load();
  }, []);
  async function toggle(key: keyof Preferences) {
    if (!prefs || busy) return;
    setBusy(true);
    setMessage("");
    try {
      setPrefs(
        await apiRequest<Preferences>("/notifications/preferences", {
          method: "PATCH",
          body: JSON.stringify({ ...prefs, [key]: !prefs[key] }),
        }),
      );
      setMessage("Preferences saved.");
    } catch {
      setMessage("Could not save preferences. Please retry.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <details className="rounded-2xl border border-slate-200 p-4 dark:border-slate-700">
      <summary className="min-h-11 cursor-pointer font-semibold">
        Notification preferences
      </summary>
      <p className="my-3 text-sm text-slate-500">
        Choose which alerts may send push notifications. All activity stays in
        your inbox. Security alerts are unaffected.
      </p>
      <PushNotificationToggle />
      {prefs ? (
        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          {(["bookings", "messages", "trips", "creators"] as const).map(
            (key) => (
              <label
                className="flex min-h-12 items-center justify-between gap-3 rounded-xl border p-3 capitalize"
                key={key}
              >
                {key}
                <input
                  type="checkbox"
                  disabled={busy}
                  checked={prefs[key]}
                  onChange={() => void toggle(key)}
                />
              </label>
            ),
          )}
        </div>
      ) : (
        <button className="min-h-11 underline" onClick={() => void load()}>
          Retry loading preferences
        </button>
      )}
      {message && (
        <p role="status" className="mt-3 text-sm">
          {message}
        </p>
      )}
    </details>
  );
}
