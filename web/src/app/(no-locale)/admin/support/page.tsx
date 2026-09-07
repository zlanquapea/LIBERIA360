"use client";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { getAdminSupportTickets } from "@/lib/support-api";
import type { PaginatedSupportTickets } from "@/lib/types";
import { AdminPageHeader } from "@/components/admin-ui";

const statuses = [
  "",
  "open",
  "in_progress",
  "waiting_for_customer",
  "resolved",
  "closed",
];
const priorities = ["", "low", "medium", "high", "urgent"];
const categories = [
  "",
  "account",
  "booking",
  "payment",
  "listing",
  "technical",
  "safety",
  "feedback",
  "other",
];
const label = (value: string) =>
  value.replaceAll("_", " ").replace(/\b\w/g, (c) => c.toUpperCase());
const empty: PaginatedSupportTickets = {
  data: [],
  meta: { total: 0, page: 1, limit: 25, totalPages: 1 },
};

export default function SupportDashboard() {
  const { token } = useAuth();
  const [result, setResult] = useState(empty);
  const [filters, setFilters] = useState(() => {
    const query =
      typeof window === "undefined"
        ? new URLSearchParams()
        : new URLSearchParams(window.location.search);
    return {
      search: query.get("search") ?? "",
      status: query.get("status") ?? "",
      priority: query.get("priority") ?? "",
      category: query.get("category") ?? "",
      page: Number(query.get("page")) || 1,
      limit: Number(query.get("limit")) || 25,
      sortBy: query.get("sortBy") ?? "updatedAt",
      sortOrder: query.get("sortOrder") ?? "DESC",
    };
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const setFilter = (name: string, value: string | number) =>
    setFilters((current) => ({
      ...current,
      [name]: value,
      page: name === "page" ? Number(value) : 1,
    }));
  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError("");
    const params = Object.fromEntries(
      Object.entries(filters)
        .filter(([, value]) => value !== "")
        .map(([key, value]) => [key, String(value)]),
    );
    window.history.replaceState(
      null,
      "",
      `${window.location.pathname}?${new URLSearchParams(params)}`,
    );
    try {
      setResult(await getAdminSupportTickets(token, params));
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Unable to load the support queue.",
      );
    } finally {
      setLoading(false);
    }
  }, [token, filters]);
  useEffect(() => {
    const timer = setTimeout(() => void load(), 250);
    return () => clearTimeout(timer);
  }, [load]);

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Customer Support"
        description="Manage, prioritize, and resolve customer requests."
      />
      <div className="grid gap-3 rounded-2xl border p-4 sm:grid-cols-4 dark:border-slate-800">
        <input
          value={filters.search}
          onChange={(e) => setFilter("search", e.target.value)}
          placeholder="Search customer or ticket"
          className="rounded-xl border p-2.5 dark:bg-slate-900"
        />
        {(
          [
            ["status", "All statuses", statuses],
            ["priority", "All priorities", priorities],
            ["category", "All categories", categories],
          ] as const
        ).map(([name, all, values]) => (
          <select
            key={name}
            value={filters[name]}
            onChange={(e) => setFilter(name, e.target.value)}
            className="rounded-xl border p-2.5 dark:bg-slate-900"
          >
            {values.map((value) => (
              <option key={value} value={value}>
                {value ? label(value) : all}
              </option>
            ))}
          </select>
        ))}
      </div>
      {error && (
        <div role="alert" className="rounded-xl bg-red-50 p-4 text-red-700">
          {error}{" "}
          <button
            onClick={() => void load()}
            className="ml-2 font-semibold underline"
          >
            Retry
          </button>
        </div>
      )}
      <div className="overflow-x-auto rounded-2xl border dark:border-slate-800">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase text-slate-500 dark:bg-slate-900">
            <tr>
              {["Ticket", "Customer", "Category", "Priority", "Status"].map(
                (heading) => (
                  <th key={heading} className="p-3">
                    {heading}
                  </th>
                ),
              )}
              <th className="p-3">
                <button
                  onClick={() =>
                    setFilters((current) => ({
                      ...current,
                      page: 1,
                      sortBy: "updatedAt",
                      sortOrder: current.sortOrder === "DESC" ? "ASC" : "DESC",
                    }))
                  }
                >
                  Updated {filters.sortOrder === "DESC" ? "↓" : "↑"}
                </button>
              </th>
            </tr>
          </thead>
          <tbody>
            {result.data.map((ticket) => (
              <tr
                key={ticket.id}
                className="border-t hover:bg-slate-50 dark:border-slate-800"
              >
                <td className="p-3">
                  <Link
                    className="font-semibold text-brand-700 dark:text-brand-300"
                    href={`/admin/support/${ticket.id}`}
                  >
                    {ticket.reference}
                  </Link>
                  <p className="max-w-xs truncate">{ticket.subject}</p>
                </td>
                <td className="p-3">
                  {ticket.customer.name}
                  <p className="text-xs text-slate-500">
                    {ticket.customer.email}
                  </p>
                </td>
                <td className="p-3">{label(ticket.category)}</td>
                <td className="p-3">{label(ticket.priority)}</td>
                <td className="p-3">{label(ticket.status)}</td>
                <td className="p-3">
                  {new Date(ticket.updatedAt).toLocaleDateString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {loading && (
          <p role="status" className="p-8 text-center text-slate-500">
            Loading tickets…
          </p>
        )}
        {!loading && !error && result.data.length === 0 && (
          <p className="p-8 text-center text-slate-500">
            No tickets match these filters.
          </p>
        )}
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
        <p>
          {result.meta.total} ticket{result.meta.total === 1 ? "" : "s"} · Page{" "}
          {result.meta.page} of {result.meta.totalPages}
        </p>
        <div className="flex items-center gap-2">
          <label>
            Rows{" "}
            <select
              value={filters.limit}
              onChange={(e) => setFilter("limit", Number(e.target.value))}
              className="rounded-lg border p-2 dark:bg-slate-900"
            >
              {[10, 25, 50, 100].map((size) => (
                <option key={size}>{size}</option>
              ))}
            </select>
          </label>
          <button
            disabled={loading || filters.page <= 1}
            onClick={() => setFilter("page", filters.page - 1)}
            className="rounded-lg border px-3 py-2 disabled:opacity-40"
          >
            Previous
          </button>
          <button
            disabled={loading || filters.page >= result.meta.totalPages}
            onClick={() => setFilter("page", filters.page + 1)}
            className="rounded-lg border px-3 py-2 disabled:opacity-40"
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
}
