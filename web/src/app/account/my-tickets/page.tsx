"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { getMyTicketOrders } from "@/lib/event-ticket-api";
import { HttpError } from "@/lib/http";
import type { EventTicketOrder } from "@/lib/types";

const STATUS_LABELS: Record<EventTicketOrder["status"], string> = {
  pending_payment_review: "Payment under review",
  approved: "Ticket issued",
  rejected: "Payment rejected",
  cancelled: "Cancelled",
};

export default function MyTicketsPage() {
  const { user, token, ready } = useAuth();
  const [orders, setOrders] = useState<EventTicketOrder[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    getMyTicketOrders(token)
      .then(setOrders)
      .catch((err) =>
        setError(
          err instanceof HttpError
            ? err.message
            : "Unable to load your tickets.",
        ),
      );
  }, [token]);

  if (!ready)
    return (
      <main className="mx-auto max-w-2xl px-4 py-10 text-sm text-slate-500">
        Loading…
      </main>
    );
  if (!user)
    return (
      <main className="mx-auto max-w-2xl px-4 py-10 text-center">
        <h1 className="text-xl font-bold">My Tickets</h1>
        <p className="mt-2 text-sm text-slate-500">
          Log in to view your ticket orders.
        </p>
        <Link
          href="/login"
          className="mt-4 inline-block rounded-full bg-brand-700 px-5 py-2.5 text-sm font-semibold text-white"
        >
          Log in
        </Link>
      </main>
    );

  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-5 px-4 py-8">
      <div>
        <Link
          href="/account"
          className="text-sm text-brand-700 hover:underline dark:text-brand-300"
        >
          ← Account
        </Link>
        <h1 className="mt-2 text-2xl font-bold text-slate-900 dark:text-slate-50">
          My Tickets
        </h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Your event ticket orders and issued ticket codes.
        </p>
      </div>
      {error && (
        <p
          role="alert"
          className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950/30 dark:text-red-300"
        >
          {error}
        </p>
      )}
      {orders.length === 0 ? (
        <p className="rounded-xl border border-dashed border-slate-300 px-4 py-8 text-center text-sm text-slate-500 dark:border-slate-700">
          You have no ticket orders yet.{" "}
          <Link
            href="/events"
            className="font-semibold text-brand-700 hover:underline dark:text-brand-300"
          >
            Browse events
          </Link>
          .
        </p>
      ) : (
        <ul className="grid gap-3">
          {orders.map((order) => (
            <li
              key={order.id}
              className="rounded-xl border border-slate-200 p-4 dark:border-slate-800"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <Link
                    href={`/events/${order.event.id}`}
                    className="font-semibold text-slate-900 hover:underline dark:text-slate-50"
                  >
                    {order.event.name}
                  </Link>
                  <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                    {order.quantity} ticket{order.quantity === 1 ? "" : "s"} ·{" "}
                    {order.currency} {Number(order.totalAmount).toFixed(2)}
                  </p>
                </div>
                <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                  {STATUS_LABELS[order.status]}
                </span>
              </div>
              {order.status === "approved" && order.ticketCode && (
                <div className="mt-3 rounded-lg bg-emerald-50 px-3 py-2 dark:bg-emerald-950/30">
                  <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-300">
                    Ticket code
                  </p>
                  <p className="mt-1 font-mono text-lg font-bold text-emerald-900 dark:text-emerald-100">
                    {order.ticketCode}
                  </p>
                </div>
              )}
              {order.status === "pending_payment_review" && (
                <p className="mt-3 text-sm text-amber-700 dark:text-amber-300">
                  Payment reference: {order.paymentReference}. The organizer
                  must verify it before issuing your ticket.
                </p>
              )}
              {order.status === "rejected" && order.reviewNote && (
                <p className="mt-3 text-sm text-red-700 dark:text-red-300">
                  Note: {order.reviewNote}
                </p>
              )}
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
