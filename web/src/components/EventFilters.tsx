"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { formatEventCategory } from "@/lib/format";
import {
  getThisMonthRange,
  getThisWeekendRange,
  getTodayRange,
  type DateRange,
} from "@/lib/date-ranges";
import type { County, EventCategory } from "@/lib/types";

const EVENT_CATEGORIES: EventCategory[] = [
  "concert",
  "festival",
  "sports",
  "nightlife",
  "seasonal",
  "other",
];

const QUICK_RANGES: { key: string; label: string; range: () => DateRange }[] = [
  { key: "today", label: "Today", range: getTodayRange },
  { key: "weekend", label: "This weekend", range: getThisWeekendRange },
  { key: "month", label: "This month", range: getThisMonthRange },
];

// Whether `iso` falls on the same local calendar day as `other` — used to
// tell which quick-filter button (if any) produced the dateFrom currently
// in the URL, without needing exact millisecond equality.
function sameLocalDay(iso: string, other: Date): boolean {
  const d = new Date(iso);
  return (
    d.getFullYear() === other.getFullYear() &&
    d.getMonth() === other.getMonth() &&
    d.getDate() === other.getDate()
  );
}

export function EventFilters({ counties }: { counties: County[] }) {
  const router = useRouter();
  const searchParams = useSearchParams();

  function updateParam(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value) {
      params.set(key, value);
    } else {
      params.delete(key);
    }
    params.delete("page");
    router.push(`/events?${params.toString()}`);
  }

  function applyRange({ from, to }: DateRange) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("dateFrom", from);
    params.set("dateTo", to);
    params.delete("page");
    router.push(`/events?${params.toString()}`);
  }

  function clearRange() {
    const params = new URLSearchParams(searchParams.toString());
    params.delete("dateFrom");
    params.delete("dateTo");
    params.delete("page");
    router.push(`/events?${params.toString()}`);
  }

  const currentDateFrom = searchParams.get("dateFrom");
  const currentDateTo = searchParams.get("dateTo");
  const activeRangeKey = currentDateFrom
    ? QUICK_RANGES.find(
        (q) =>
          sameLocalDay(currentDateFrom, new Date(q.range().from)) &&
          Boolean(
            currentDateTo &&
            sameLocalDay(currentDateTo, new Date(q.range().to)),
          ),
      )?.key
    : undefined;

  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-2 gap-3">
        <select
          aria-label="Category"
          className="min-h-12 w-full min-w-0 rounded-xl border border-slate-200 bg-white px-2 text-sm text-slate-700 focus-visible:ring-2 focus-visible:ring-brand-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
          value={searchParams.get("category") ?? ""}
          onChange={(e) => updateParam("category", e.target.value)}
        >
          <option value="">All categories</option>
          {EVENT_CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {formatEventCategory(c)}
            </option>
          ))}
        </select>

        <select
          aria-label="County"
          className="min-h-12 w-full min-w-0 rounded-xl border border-slate-200 bg-white px-2 text-sm text-slate-700 focus-visible:ring-2 focus-visible:ring-brand-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
          value={searchParams.get("county") ?? ""}
          onChange={(e) => updateParam("county", e.target.value)}
        >
          <option value="">All counties</option>
          {counties.map((c) => (
            <option key={c.id} value={c.slug}>
              {c.name}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {QUICK_RANGES.map((q) => (
          <button
            key={q.key}
            type="button"
            onClick={() => applyRange(q.range())}
            aria-pressed={activeRangeKey === q.key}
            className={`min-h-11 rounded-full border px-3 py-2 text-xs font-medium focus-visible:ring-2 focus-visible:ring-brand-500 ${
              activeRangeKey === q.key
                ? "border-brand-500 bg-brand-50 text-brand-700 dark:bg-brand-950/40 dark:text-brand-300"
                : "border-slate-300 text-slate-600 hover:border-brand-500 hover:text-brand-700 dark:border-slate-700 dark:text-slate-300 dark:hover:text-brand-300"
            }`}
          >
            {q.label}
          </button>
        ))}
        {(currentDateFrom || currentDateTo) && (
          <button
            type="button"
            onClick={clearRange}
            className="min-h-11 px-2 text-xs font-medium text-slate-500 hover:underline dark:text-slate-400"
          >
            Clear dates
          </button>
        )}
      </div>
    </div>
  );
}
