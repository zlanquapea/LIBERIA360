"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  AdminPageHeader,
  ErrorState,
  LoadingState,
} from "@/components/admin-ui";
import { useAuth } from "@/hooks/useAuth";
import { getFriendlyErrorMessage } from "@/lib/errors";
import { getAdminSupportTickets } from "@/lib/support-api";
import type { PaginatedSupportTickets, SupportTicket } from "@/lib/types";

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
  value
    .replaceAll("_", " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());

export default function SupportDashboard() {
  const { token } = useAuth();
  const [result, setResult] = useState<PaginatedSupportTickets | null>(null);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [priority, setPriority] = useState("");
  const [category, setCategory] = useState("");
  const [page, setPage] = useState(1);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!token) return;
    const controller = new AbortController();
    const timer = setTimeout(() => {
      setError("");
      getAdminSupportTickets(
        token,
        Object.fromEntries(
          Object.entries({
            search,
            status,
            priority,
            category,
            page: String(page),
            limit: "25",
          }).filter(([, value]) => value),
        ),
      )
        .then(setResult)
        .catch((reason) => {
          if (!controller.signal.aborted)
            setError(getFriendlyErrorMessage(reason));
        });
    }, 250);
    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [token, search, status, priority, category, page]);

  function changeFilter(setter: (value: string) => void, value: string) {
    setter(value);
    setPage(1);
  }
  const tickets: SupportTicket[] = result?.data ?? [];

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Customer Support"
        description="Manage, prioritize, and resolve customer requests."
      />
      <div className="grid gap-3 rounded-2xl border p-4 sm:grid-cols-4 dark:border-slate-800">
        <input
          value={search}
          onChange={(event) => changeFilter(setSearch, event.target.value)}
          placeholder="Search customer or ticket"
          className="rounded-xl border p-2.5 dark:bg-slate-900"
        />
        <select
          value={status}
          onChange={(event) => changeFilter(setStatus, event.target.value)}
          className="rounded-xl border p-2.5 dark:bg-slate-900"
        >
          {statuses.map((value) => (
            <option key={value} value={value}>
              {value ? label(value) : "All statuses"}
            </option>
          ))}
        </select>
        <select
          value={priority}
          onChange={(event) => changeFilter(setPriority, event.target.value)}
          className="rounded-xl border p-2.5 dark:bg-slate-900"
        >
          {priorities.map((value) => (
            <option key={value} value={value}>
              {value ? label(value) : "All priorities"}
            </option>
          ))}
        </select>
        <select
          value={category}
          onChange={(event) => changeFilter(setCategory, event.target.value)}
          className="rounded-xl border p-2.5 dark:bg-slate-900"
        >
          {categories.map((value) => (
            <option key={value} value={value}>
              {value ? label(value) : "All categories"}
            </option>
          ))}
        </select>
      </div>
      {error && <ErrorState message={error} />}
      {!result && !error ? (
        <LoadingState />
      ) : (
        <div className="overflow-x-auto rounded-2xl border dark:border-slate-800">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500 dark:bg-slate-900">
              <tr>
                <th className="p-3">Ticket</th>
                <th className="p-3">Customer</th>
                <th className="p-3">Category</th>
                <th className="p-3">Priority</th>
                <th className="p-3">Status</th>
                <th className="p-3">Updated</th>
              </tr>
            </thead>
            <tbody>
              {tickets.map((ticket) => (
                <tr
                  key={ticket.id}
                  className="border-t hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-900"
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
          {!tickets.length && (
            <p className="p-8 text-center text-slate-500">
              No tickets match these filters.
            </p>
          )}
        </div>
      )}
      {result && (
        <nav
          aria-label="Ticket pages"
          className="flex items-center justify-between"
        >
          <p className="text-sm text-slate-500">
            {result.meta.total} ticket{result.meta.total === 1 ? "" : "s"} ·
            Page {result.meta.page} of {result.meta.totalPages}
          </p>
          <div className="flex gap-2">
            <button
              disabled={page <= 1}
              onClick={() => setPage((value) => value - 1)}
              className="rounded-full border px-4 py-2 text-sm font-semibold disabled:opacity-40"
            >
              Previous
            </button>
            <button
              disabled={page >= result.meta.totalPages}
              onClick={() => setPage((value) => value + 1)}
              className="rounded-full border px-4 py-2 text-sm font-semibold disabled:opacity-40"
            >
              Next
            </button>
          </div>
        </nav>
      )}
    </div>
  );
}
