"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import {
  getEventTicketOrders,
  reviewEventTicketOrder,
} from "@/lib/event-ticket-api";
import { HttpError } from "@/lib/http";
import type { EventTicketOrder } from "@/lib/types";
import { EventTicketScanner } from "@/components/EventTicketScanner";

export default function EventTicketOrdersPage() {
  const params = useParams<{ id: string }>();
  const { token, ready, user } = useAuth();
  const [orders, setOrders] = useState<EventTicketOrder[]>([]);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!token || !params.id) return;
    try {
      setOrders(await getEventTicketOrders(token, params.id));
    } catch (err) {
      setError(
        err instanceof HttpError
          ? err.message
          : "Unable to load ticket orders.",
      );
    }
  }, [token, params.id]);
  useEffect(() => {
    void load();
  }, [load]);

  async function review(
    order: EventTicketOrder,
    status: "approved" | "rejected",
  ) {
    if (!token) return;
    try {
      await reviewEventTicketOrder(token, order.id, status);
      await load();
    } catch (err) {
      setError(
        err instanceof HttpError ? err.message : "Unable to review this order.",
      );
    }
  }

  if (!ready)
    return (
      <main className="mx-auto max-w-2xl px-4 py-10 text-sm text-slate-500">
        Loading…
      </main>
    );
  if (!user)
    return (
      <main className="mx-auto max-w-2xl px-4 py-10 text-center">
        <h1 className="text-xl font-bold">Ticket orders</h1>
        <p className="mt-2 text-sm text-slate-500">Log in to continue.</p>
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
          href="/account/my-events"
          className="text-sm text-brand-700 hover:underline dark:text-brand-300"
        >
          ← My Events
        </Link>
        <h1 className="mt-2 text-2xl font-bold text-slate-900 dark:text-slate-50">
          Ticket orders
        </h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Verify payment references before issuing tickets, then scan each pass at the entrance.
        </p>
      </div>
      {token && <EventTicketScanner eventId={params.id} token={token} />}
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
          No ticket orders yet.
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
                  <p className="font-semibold text-slate-900 dark:text-slate-50">
                    {order.buyer?.name || "Attendee"}
                  </p>
                  <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                    {order.quantity} ticket{order.quantity === 1 ? "" : "s"} ·{" "}
                    {order.currency} {Number(order.totalAmount).toFixed(2)}
                  </p>
                </div>
                <span className="text-xs font-medium text-slate-500">
                  {order.status}
                </span>
              </div>
              <p className="mt-3 text-sm">
                <span className="font-medium">Payment reference:</span>{" "}
                {order.paymentReference}
              </p>
              {order.paymentNote && (
                <p className="mt-1 text-sm text-slate-500">
                  Note: {order.paymentNote}
                </p>
              )}
              {order.status === "pending_payment_review" && (
                <div className="mt-4 flex gap-2">
                  <button
                    type="button"
                    onClick={() => review(order, "approved")}
                    className="rounded-full bg-emerald-700 px-4 py-2 text-xs font-semibold text-white"
                  >
                    Approve and issue ticket
                  </button>
                  <button
                    type="button"
                    onClick={() => review(order, "rejected")}
                    className="rounded-full border border-red-300 px-4 py-2 text-xs font-semibold text-red-700 dark:border-red-800 dark:text-red-300"
                  >
                    Reject
                  </button>
                </div>
              )}
              {order.ticketCode && (
                <p className="mt-3 font-mono text-sm text-emerald-700 dark:text-emerald-300">
                  Issued: {order.ticketCode}
                </p>
              )}
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
