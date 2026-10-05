"use client";
import { useEffect, useState } from "react";
import { apiRequest } from "@/lib/http";
type Metrics = {
  profile_views: number;
  experience_views: number;
  booking_requests: number;
};
type Insights = {
  available: boolean;
  totals: Metrics;
  byDay: (Metrics & { date: string })[];
  experiences: {
    id: string;
    title: string;
    views: number;
    booking_requests: number;
  }[];
};
export function GuideInsightsPanel() {
  const [days, setDays] = useState(30);
  const [data, setData] = useState<Insights | null>(null);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    let active = true;
    setData(null);
    setError("");
    apiRequest<Insights>(`/guide-insights/me?days=${days}`, {
      cache: "no-store",
    })
      .then((d) => {
        if (active) setData(d);
      })
      .catch(() => {
        if (active) setError("Could not load guide insights.");
      });
    return () => {
      active = false;
    };
  }, [days, retry]);
  if (data && !data.available) return null;
  return (
    <section className="space-y-4 rounded-2xl border border-slate-200 p-4 dark:border-slate-700">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-bold">Guide & experience insights</h2>
        <label className="text-sm">
          Period{" "}
          <select
            aria-label="Insights period"
            value={days}
            onChange={(e) => setDays(Number(e.target.value))}
            className="rounded border bg-transparent p-2"
          >
            {[7, 30, 90].map((d) => (
              <option key={d} value={d}>
                Last {d} days
              </option>
            ))}
          </select>
        </label>
      </div>
      {error ? (
        <p role="alert">
          {error}{" "}
          <button
            type="button"
            onClick={() => setRetry((n) => n + 1)}
            className="underline"
          >
            Retry
          </button>
        </p>
      ) : !data ? (
        <p>Loading insights…</p>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {(
              [
                ["Profile views", data.totals.profile_views],
                ["Experience views", data.totals.experience_views],
                ["Booking requests", data.totals.booking_requests],
              ] as const
            ).map(([label, value]) => (
              <div
                key={label}
                className="rounded-xl bg-slate-50 p-3 dark:bg-slate-900"
              >
                <p className="text-2xl font-bold">{value.toLocaleString()}</p>
                <p className="text-sm">{label}</p>
              </div>
            ))}
          </div>
          <p className="text-xs text-slate-500">
            Views count tracked page visits, not unique people, and begin when
            tracking launches. Repeat views in the same tab within 30 minutes
            count once. Booking requests include all requests created during
            this period, including those later cancelled or declined. Dates use
            UTC.
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <caption className="text-left font-semibold mb-2">
                Experience performance
              </caption>
              <thead>
                <tr>
                  <th scope="col">Experience</th>
                  <th scope="col">Views</th>
                  <th scope="col">Requests</th>
                </tr>
              </thead>
              <tbody>
                {data.experiences.map((e) => (
                  <tr key={e.id} className="border-t">
                    <td className="py-2">{e.title}</td>
                    <td>{e.views}</td>
                    <td>{e.booking_requests}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!data.experiences.length && (
              <p className="text-sm">No experiences yet.</p>
            )}
          </div>
          <details>
            <summary className="cursor-pointer text-sm font-semibold">
              Daily activity
            </summary>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr>
                    <th scope="col">Date</th>
                    <th scope="col">Profile views</th>
                    <th scope="col">Experience views</th>
                    <th scope="col">Requests</th>
                  </tr>
                </thead>
                <tbody>
                  {data.byDay.map((d) => (
                    <tr key={d.date} className="border-t">
                      <td className="py-2">{d.date}</td>
                      <td>{d.profile_views}</td>
                      <td>{d.experience_views}</td>
                      <td>{d.booking_requests}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
        </>
      )}
    </section>
  );
}
