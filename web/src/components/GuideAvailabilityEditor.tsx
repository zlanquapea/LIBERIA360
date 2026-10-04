"use client";

import { useEffect, useState } from "react";
import { apiRequest } from "@/lib/http";

interface Availability {
  enabled: boolean;
  weekdays: number[];
  blockedDates: string[];
  version: number;
}

export function GuideAvailabilityEditor() {
  const [value, setValue] = useState<Availability | null>(null);
  const [date, setDate] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function load() {
    try {
      setValue(await apiRequest<Availability>("/guides/me/availability"));
      setMessage("");
    } catch {
      setMessage("Could not load availability. Please retry.");
    }
  }

  useEffect(() => {
    void load();
  }, []);

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-900">
      <h2 className="text-xl font-bold">Your availability</h2>
      <p className="mt-2 text-sm text-slate-500">
        Choose your working days and block dates you cannot host. One confirmed
        booking reserves the day across your experiences. Existing confirmed
        bookings stay valid when you edit this schedule.
      </p>
      {!value ? (
        <button className="min-h-11 underline" onClick={() => void load()}>
          Load availability
        </button>
      ) : (
        <fieldset disabled={busy} className="mt-4 space-y-4">
          <label className="flex min-h-11 items-center gap-3">
            <input
              type="checkbox"
              checked={value.enabled}
              onChange={(e) =>
                setValue({ ...value, enabled: e.target.checked })
              }
            />
            Use my availability schedule
          </label>
          <p className="text-xs text-slate-500">
            When off, travelers can request any future date that is not already
            booked.
          </p>
          <div className="flex flex-wrap gap-2">
            {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map(
              (day, index) => (
                <label
                  key={day}
                  className="flex min-h-11 items-center gap-2 rounded-xl border p-3"
                >
                  <input
                    type="checkbox"
                    checked={value.weekdays.includes(index)}
                    onChange={(e) =>
                      setValue({
                        ...value,
                        weekdays: e.target.checked
                          ? [...value.weekdays, index]
                          : value.weekdays.filter((item) => item !== index),
                      })
                    }
                  />
                  {day}
                </label>
              ),
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            <input
              aria-label="Date to block"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="min-h-11 min-w-0 rounded-xl border bg-transparent p-3"
            />
            <button
              type="button"
              className="min-h-11 rounded-xl border px-4"
              disabled={!date || value.blockedDates.length >= 365}
              onClick={() => {
                if (!value.blockedDates.includes(date))
                  setValue({
                    ...value,
                    blockedDates: [...value.blockedDates, date].sort(),
                  });
                setDate("");
              }}
            >
              Block date
            </button>
          </div>
          <ul className="flex flex-wrap gap-2">
            {value.blockedDates.map((item) => (
              <li key={item}>
                <button
                  type="button"
                  className="min-h-11 rounded-xl border p-3 text-sm"
                  aria-label={`Unblock ${item}`}
                  onClick={() =>
                    setValue({
                      ...value,
                      blockedDates: value.blockedDates.filter(
                        (day) => day !== item,
                      ),
                    })
                  }
                >
                  {item} ×
                </button>
              </li>
            ))}
          </ul>
          <div className="flex gap-3">
            <button
              type="button"
              className="min-h-11 rounded-full bg-brand-700 px-5 text-white"
              onClick={async () => {
                setBusy(true);
                try {
                  setValue(
                    await apiRequest<Availability>("/guides/me/availability", {
                      method: "PATCH",
                      body: JSON.stringify(value),
                    }),
                  );
                  setMessage("Availability saved.");
                } catch (err) {
                  setMessage(
                    err instanceof Error
                      ? err.message
                      : "Could not save availability.",
                  );
                } finally {
                  setBusy(false);
                }
              }}
            >
              Save availability
            </button>
            <button
              type="button"
              className="min-h-11 underline"
              onClick={() => void load()}
            >
              Reload
            </button>
          </div>
        </fieldset>
      )}
      {message && (
        <p role="status" className="mt-3 text-sm">
          {message}
        </p>
      )}
    </section>
  );
}
