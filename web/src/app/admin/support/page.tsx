"use client";

import {
  ChatBubbleLeftRightIcon,
  ClockIcon,
  ExclamationTriangleIcon,
  MagnifyingGlassIcon,
} from "@heroicons/react/24/outline";
import Link from "next/link";
import { useEffect, useState } from "react";
import { AdminPageHeader } from "@/components/admin-ui";
import { useAuth } from "@/hooks/useAuth";
import { getAdminSupportTickets } from "@/lib/support-api";
import type {
  SupportTicket,
  SupportTicketPriority,
  SupportTicketStatus,
} from "@/lib/types";

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
const priorityClasses: Record<SupportTicketPriority, string> = {
  low: "bg-slate-100 text-slate-700",
  medium: "bg-sky-100 text-sky-800",
  high: "bg-orange-100 text-orange-800",
  urgent: "bg-red-100 text-red-800",
};
const statusClasses: Record<SupportTicketStatus, string> = {
  open: "bg-sky-50 text-sky-700",
  in_progress: "bg-indigo-50 text-indigo-700",
  waiting_for_customer: "bg-amber-50 text-amber-800",
  resolved: "bg-emerald-50 text-emerald-700",
  closed: "bg-slate-100 text-slate-600",
};

export default function SupportDashboard() {
  const { token, user } = useAuth();
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [priority, setPriority] = useState("");
  const [category, setCategory] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token) return;
    const timer = setTimeout(() => {
      setLoading(true);
      getAdminSupportTickets(
        token,
        Object.fromEntries(
          Object.entries({ search, status, priority, category }).filter(
            ([, value]) => value,
          ),
        ),
      )
        .then((result) => setTickets(result.data))
        .finally(() => setLoading(false));
    }, 250);
    return () => clearTimeout(timer);
  }, [token, search, status, priority, category]);

  const urgentCount = tickets.filter(
    (ticket) =>
      ticket.priority === "urgent" &&
      !["resolved", "closed"].includes(ticket.status),
  ).length;
  const waitingCount = tickets.filter(
    (ticket) => ticket.status === "waiting_for_customer",
  ).length;
  const unassignedCount = tickets.filter(
    (ticket) =>
      !ticket.assignedAgentUserId &&
      !["resolved", "closed"].includes(ticket.status),
  ).length;

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Customer Support"
        description="A focused queue for fast, thoughtful customer care."
      />
      <div className="grid gap-3 sm:grid-cols-3">
        <Metric
          icon={ExclamationTriangleIcon}
          label="Urgent"
          value={urgentCount}
          tone="red"
        />
        <Metric
          icon={ClockIcon}
          label="Waiting on customer"
          value={waitingCount}
          tone="amber"
        />
        <Metric
          icon={ChatBubbleLeftRightIcon}
          label="Unassigned"
          value={unassignedCount}
          tone="brand"
        />
      </div>
      <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="relative">
          <MagnifyingGlassIcon className="pointer-events-none absolute left-3 top-3 h-5 w-5 text-slate-400" />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search by reference, subject, customer, or email"
            className="w-full rounded-xl border border-slate-300 bg-transparent py-2.5 pl-10 pr-3 text-sm outline-none focus:border-brand-600 dark:border-slate-700"
          />
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <select
            value={status}
            onChange={(event) => setStatus(event.target.value)}
            className="rounded-full border border-slate-300 bg-transparent px-3 py-2 text-sm dark:border-slate-700"
          >
            {statuses.map((value) => (
              <option key={value} value={value}>
                {value ? label(value) : "All statuses"}
              </option>
            ))}
          </select>
          <select
            value={priority}
            onChange={(event) => setPriority(event.target.value)}
            className="rounded-full border border-slate-300 bg-transparent px-3 py-2 text-sm dark:border-slate-700"
          >
            {priorities.map((value) => (
              <option key={value} value={value}>
                {value ? label(value) : "All priorities"}
              </option>
            ))}
          </select>
          <select
            value={category}
            onChange={(event) => setCategory(event.target.value)}
            className="rounded-full border border-slate-300 bg-transparent px-3 py-2 text-sm dark:border-slate-700"
          >
            {categories.map((value) => (
              <option key={value} value={value}>
                {value ? label(value) : "All categories"}
              </option>
            ))}
          </select>
          {(search || status || priority || category) && (
            <button
              onClick={() => {
                setSearch("");
                setStatus("");
                setPriority("");
                setCategory("");
              }}
              className="px-3 py-2 text-sm font-semibold text-brand-700"
            >
              Clear filters
            </button>
          )}
        </div>
      </section>
      <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-center justify-between border-b px-5 py-4 dark:border-slate-800">
          <div>
            <h2 className="font-bold">Support queue</h2>
            <p className="text-xs text-slate-500">
              Oldest customer needs and urgent requests should come first.
            </p>
          </div>
          <span className="text-sm text-slate-500">{tickets.length} shown</span>
        </div>
        {loading ? (
          <p className="p-10 text-center text-sm text-slate-500">
            Refreshing queue…
          </p>
        ) : tickets.length === 0 ? (
          <p className="p-10 text-center text-sm text-slate-500">
            No tickets match these filters.
          </p>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {tickets.map((ticket) => {
              const mine = ticket.assignedAgentUserId === user?.id;
              return (
                <Link
                  key={ticket.id}
                  href={`/admin/support/${ticket.id}`}
                  className="group grid gap-3 p-4 transition hover:bg-brand-50/50 dark:hover:bg-brand-950/20 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:px-5"
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${priorityClasses[ticket.priority]}`}
                      >
                        {label(ticket.priority)}
                      </span>
                      <span
                        className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${statusClasses[ticket.status]}`}
                      >
                        {label(ticket.status)}
                      </span>
                      <span className="text-xs text-slate-400">
                        {ticket.reference}
                      </span>
                    </div>
                    <p className="mt-2 truncate font-semibold text-slate-950 group-hover:text-brand-800 dark:text-white dark:group-hover:text-brand-200">
                      {ticket.subject}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      {ticket.customer.name} · {label(ticket.category)} ·
                      Updated {new Date(ticket.updatedAt).toLocaleString()}
                    </p>
                  </div>
                  <div className="text-left sm:text-right">
                    {mine ? (
                      <span className="text-xs font-bold text-emerald-700">
                        Assigned to you
                      </span>
                    ) : ticket.assignedAgent ? (
                      <span className="text-xs text-slate-500">
                        {ticket.assignedAgent.name}
                      </span>
                    ) : (
                      <span className="text-xs font-semibold text-brand-700">
                        Unassigned
                      </span>
                    )}
                    <p className="mt-1 text-xs text-slate-400">Open ticket →</p>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}

function Metric({
  icon: Icon,
  label: metricLabel,
  value,
  tone,
}: {
  icon: typeof ClockIcon;
  label: string;
  value: number;
  tone: "red" | "amber" | "brand";
}) {
  const classes =
    tone === "red"
      ? "bg-red-50 text-red-700 dark:bg-red-950/30 dark:text-red-300"
      : tone === "amber"
        ? "bg-amber-50 text-amber-800 dark:bg-amber-950/30 dark:text-amber-300"
        : "bg-brand-50 text-brand-700 dark:bg-brand-950/30 dark:text-brand-300";
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
      <span className={`rounded-xl p-2 ${classes}`}>
        <Icon className="h-5 w-5" />
      </span>
      <div>
        <p className="text-2xl font-bold">{value}</p>
        <p className="text-xs text-slate-500">{metricLabel}</p>
      </div>
    </div>
  );
}
