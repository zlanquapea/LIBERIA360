"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import {
  getEventTicketOrders,
  reviewEventTicketOrder,
  voidEventTicket,
} from "@/lib/event-ticket-api";
import { HttpError } from "@/lib/http";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import type { EventTicketInstance, EventTicketOrder } from "@/lib/types";

export default function EventTicketOrdersPage() {
  const params = useParams<{ id: string }>();
  const { token, ready, user } = useAuth();
  const [orders, setOrders] = useState<EventTicketOrder[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [pendingCancel, setPendingCancel] = useState<EventTicketInstance | null>(null);
  const [cancelLoading, setCancelLoading] = useState(false);
  const [cancelError, setCancelError] = useState<string | null>(null);

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

  async function confirmCancelTicket() {
    if (!token || !pendingCancel) return;
    setCancelLoading(true);
    setCancelError(null);
    try {
      await voidEventTicket(token, pendingCancel.id);
      setPendingCancel(null);
      await load();
    } catch (err) {
      setCancelError(
        err instanceof HttpError ? err.message : "Unable to cancel this ticket.",
      );
    } finally {
      setCancelLoading(false);
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
          Review payment references and issue tickets from this page.
        </p>
      </div>
      <div className="flex flex-col gap-3 sm:flex-row">
        <Link
          href={`/account/my-events/tickets/${params.id}/scan`}
          className="flex min-h-14 flex-1 items-center justify-between gap-3 rounded-2xl border border-brand-200 bg-brand-50 px-4 py-3 text-brand-950 hover:border-brand-400 hover:bg-brand-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 dark:border-brand-900/60 dark:bg-brand-950/25 dark:text-brand-50 dark:hover:bg-brand-950/45"
        >
          <span>
            <span className="block text-sm font-bold">Open ticket scanner</span>
            <span className="mt-0.5 block text-xs text-slate-600 dark:text-slate-300">Scan and validate passes at the entrance on a separate page.</span>
          </span>
          <span aria-hidden className="text-xl">→</span>
        </Link>
        <Link
          href={`/account/my-events/tickets/${params.id}/metrics`}
          className="flex min-h-14 flex-1 items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-900 hover:border-brand-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-50"
        >
          <span>
            <span className="block text-sm font-bold">View sales metrics</span>
            <span className="mt-0.5 block text-xs text-slate-500 dark:text-slate-400">Revenue, ticket types, orders, and attendance in one place.</span>
          </span>
          <span aria-hidden className="text-xl">→</span>
        </Link>
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
                  {/* Order ID identifies the transaction; each ticket below
                      carries its own separate Ticket ID — the two are never
                      the same identifier. */}
                  <p className="mt-1 font-mono text-[11px] text-slate-400 dark:text-slate-500">
                    Order: {order.ticketCode ?? `ORD-${order.id.slice(0, 8).toUpperCase()}`}
                    {" · "}
                    {new Date(order.createdAt).toLocaleDateString(undefined, {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })}
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
              {order.tickets && order.tickets.length > 0 && (
                <ul className="mt-3 flex flex-col gap-2 border-t border-dashed border-slate-200 pt-3 dark:border-slate-700">
                  {order.tickets.map((ticket) => (
                    <li
                      key={ticket.id}
                      className="flex items-center justify-between gap-2 rounded-lg bg-slate-50 px-3 py-2 text-xs dark:bg-slate-900"
                    >
                      <div className="min-w-0">
                        <p className="truncate font-semibold text-slate-900 dark:text-slate-50">
                          {ticket.ticketTypeName}
                          <span className="ml-1.5 font-normal text-slate-500">
                            · Ticket {ticket.sequence} of {order.quantity}
                          </span>
                        </p>
                        <p className="mt-0.5 font-mono text-[11px] text-slate-500">
                          {ticket.ticketNumber}
                        </p>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        <span
                          className={
                            ticket.status === "void"
                              ? "rounded-full bg-slate-200 px-2 py-0.5 font-semibold text-slate-600 dark:bg-slate-700 dark:text-slate-300"
                              : ticket.status === "redeemed"
                                ? "rounded-full bg-amber-100 px-2 py-0.5 font-semibold text-amber-800 dark:bg-amber-900/40 dark:text-amber-200"
                                : "rounded-full bg-emerald-100 px-2 py-0.5 font-semibold text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200"
                          }
                        >
                          {ticket.status === "void"
                            ? "Cancelled"
                            : ticket.status === "redeemed"
                              ? "Used"
                              : "Active"}
                        </span>
                        {ticket.status !== "void" && (
                          <button
                            type="button"
                            onClick={() => setPendingCancel(ticket)}
                            className="rounded-full border border-red-300 px-2 py-0.5 font-semibold text-red-700 hover:bg-red-50 dark:border-red-800 dark:text-red-300 dark:hover:bg-red-950/30"
                          >
                            Cancel
                          </button>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </li>
          ))}
        </ul>
      )}
      <ConfirmDialog
        open={pendingCancel !== null}
        title={pendingCancel ? `Cancel ${pendingCancel.ticketTypeName} ticket ${pendingCancel.ticketNumber}?` : ""}
        description="The attendee will no longer be able to use this ticket for entry. This does not affect any other ticket in the same order."
        confirmLabel="Cancel ticket"
        cancelLabel="Keep ticket"
        loadingLabel="Cancelling…"
        isLoading={cancelLoading}
        error={cancelError}
        onConfirm={confirmCancelTicket}
        onCancel={() => {
          setPendingCancel(null);
          setCancelError(null);
        }}
      />
    </main>
  );
}
