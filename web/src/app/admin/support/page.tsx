"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { getAdminSupportTickets } from "@/lib/support-api";
import type {
  SupportTicket,
  SupportTicketCategory,
  SupportTicketPriority,
  SupportTicketStatus,
} from "@/lib/types";
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
const label = (v: string) =>
  v.replaceAll("_", " ").replace(/\b\w/g, (c) => c.toUpperCase());
export default function SupportDashboard() {
  const { token } = useAuth();
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [priority, setPriority] = useState("");
  const [category, setCategory] = useState("");
  useEffect(() => {
    if (!token) return;
    const timer = setTimeout(
      () =>
        getAdminSupportTickets(
          token,
          Object.fromEntries(
            Object.entries({ search, status, priority, category }).filter(
              ([, v]) => v,
            ),
          ),
        ).then((r) => setTickets(r.data)),
      250,
    );
    return () => clearTimeout(timer);
  }, [token, search, status, priority, category]);
  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Customer Support"
        description="Manage, prioritize, and resolve customer requests."
      />
      <div className="grid gap-3 rounded-2xl border p-4 sm:grid-cols-4 dark:border-slate-800">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search customer or ticket"
          className="rounded-xl border p-2.5 dark:bg-slate-900"
        />
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="rounded-xl border p-2.5 dark:bg-slate-900"
        >
          {statuses.map((x) => (
            <option key={x} value={x}>
              {x ? label(x) : "All statuses"}
            </option>
          ))}
        </select>
        <select
          value={priority}
          onChange={(e) => setPriority(e.target.value)}
          className="rounded-xl border p-2.5 dark:bg-slate-900"
        >
          {priorities.map((x) => (
            <option key={x} value={x}>
              {x ? label(x) : "All priorities"}
            </option>
          ))}
        </select>
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="rounded-xl border p-2.5 dark:bg-slate-900"
        >
          {categories.map((x) => (
            <option key={x} value={x}>
              {x ? label(x) : "All categories"}
            </option>
          ))}
        </select>
      </div>
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
            {tickets.map((t) => (
              <tr
                key={t.id}
                className="border-t hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-900"
              >
                <td className="p-3">
                  <Link
                    className="font-semibold text-brand-700 dark:text-brand-300"
                    href={`/admin/support/${t.id}`}
                  >
                    {t.reference}
                  </Link>
                  <p className="max-w-xs truncate">{t.subject}</p>
                </td>
                <td className="p-3">
                  {t.customer.name}
                  <p className="text-xs text-slate-500">{t.customer.email}</p>
                </td>
                <td className="p-3">{label(t.category)}</td>
                <td className="p-3">{label(t.priority)}</td>
                <td className="p-3">{label(t.status)}</td>
                <td className="p-3">
                  {new Date(t.updatedAt).toLocaleDateString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {tickets.length === 0 && (
          <p className="p-8 text-center text-slate-500">
            No tickets match these filters.
          </p>
        )}
      </div>
    </div>
  );
}
