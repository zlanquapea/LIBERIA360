"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { getCounties, getEvent } from "@/lib/api";
import { deleteEvent, getMyEvents } from "@/lib/event-api";
import {
  getEventTicketOrders,
  reviewEventTicketOrder,
  voidEventTicket,
} from "@/lib/event-ticket-api";
import { getFriendlyErrorMessage, isNotFoundError } from "@/lib/errors";
import { HttpError } from "@/lib/http";
import { BrandLoader } from "@/components/BrandLoader";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { NewEventForm } from "@/components/NewEventForm";
import { SuccessBanner } from "@/components/SuccessBanner";
import type {
  County,
  Event,
  EventTicketInstance,
  EventTicketOrder,
} from "@/lib/types";

// The organizer's operational hub for one event — everything that takes an
// action (edit details, review payments, cancel a ticket, cancel the whole
// event, open the scanner) lives here. Understanding how the event is
// *performing* lives on the separate Insights page — see that page's own
// comment for why the two are kept apart instead of both being called some
// variant of "Metrics".
export default function ManageEventPage() {
  const params = useParams<{ id: string }>();
  const { token, ready, user } = useAuth();
  const [event, setEvent] = useState<Event | null>(null);
  const [counties, setCounties] = useState<County[]>([]);
  const [orders, setOrders] = useState<EventTicketOrder[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const [pendingCancelTicket, setPendingCancelTicket] = useState<EventTicketInstance | null>(null);
  const [cancelTicketLoading, setCancelTicketLoading] = useState(false);
  const [cancelTicketError, setCancelTicketError] = useState<string | null>(null);

  const [pendingCancelEvent, setPendingCancelEvent] = useState(false);
  const [cancelEventLoading, setCancelEventLoading] = useState(false);
  const [cancelEventError, setCancelEventError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!token || !params.id) return;
    try {
      const [eventData, orderData] = await Promise.all([
        getEvent(params.id),
        getEventTicketOrders(token, params.id),
      ]);
      setEvent(eventData);
      setOrders(orderData);
    } catch (err) {
      setError(
        err instanceof HttpError
          ? err.message
          : "Unable to load this event.",
      );
    }
  }, [token, params.id]);
  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    getCounties().then(setCounties);
  }, []);

  useEffect(() => {
    if (!successMessage) return;
    const id = setTimeout(() => setSuccessMessage(null), 4000);
    return () => clearTimeout(id);
  }, [successMessage]);

  const hasTicketing = !!(
    event &&
    ((event.ticketPrice && Number(event.ticketPrice) > 0) ||
      event.ticketTypes?.length > 0)
  );

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
    if (!token || !pendingCancelTicket) return;
    setCancelTicketLoading(true);
    setCancelTicketError(null);
    try {
      await voidEventTicket(token, pendingCancelTicket.id);
      setPendingCancelTicket(null);
      await load();
    } catch (err) {
      setCancelTicketError(
        err instanceof HttpError ? err.message : "Unable to cancel this ticket.",
      );
    } finally {
      setCancelTicketLoading(false);
    }
  }

  async function confirmCancelEvent() {
    if (!token || !event) return;
    setCancelEventLoading(true);
    setCancelEventError(null);
    try {
      await deleteEvent(token, event.id);
      setPendingCancelEvent(false);
      setSuccessMessage(`"${event.name}" was cancelled.`);
      // Re-run getMyEvents so a cached list elsewhere in the app (My Events)
      // doesn't show a now-deleted event on next visit — best-effort, not
      // load-blocking.
      void getMyEvents(token).catch(() => undefined);
    } catch (err) {
      if (isNotFoundError(err)) {
        setPendingCancelEvent(false);
        setSuccessMessage("This event was already removed.");
      } else {
        setCancelEventError(
          getFriendlyErrorMessage(err, {
            context: { action: "cancel-event", eventId: event.id },
          }),
        );
      }
    } finally {
      setCancelEventLoading(false);
    }
  }

  if (!ready)
    return (
      <main className="flex min-h-[70vh] flex-col items-center justify-center gap-5 px-4">
        <BrandLoader />
        <p className="text-sm font-medium tracking-wide text-slate-500 dark:text-slate-400">Loading…</p>
      </main>
    );
  if (!user)
    return (
      <main className="mx-auto max-w-2xl px-4 py-10 text-center">
        <h1 className="text-xl font-bold">Manage Event</h1>
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
          Manage Event
        </h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          {event ? event.name : "Edit details, review payments, and scan tickets from here."}
        </p>
      </div>

      {successMessage && <SuccessBanner>{successMessage}</SuccessBanner>}

      {error && (
        <p
          role="alert"
          className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950/30 dark:text-red-300"
        >
          {error}
        </p>
      )}

      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          onClick={() => setEditing((v) => !v)}
          className="rounded-full border border-slate-300 px-4 py-2 text-xs font-semibold text-slate-700 hover:border-brand-400 dark:border-slate-700 dark:text-slate-200"
        >
          {editing ? "Close editor" : "Edit event details"}
        </button>
        <Link
          href={`/account/my-events/tickets/${params.id}/metrics`}
          className="rounded-full border border-slate-300 px-4 py-2 text-xs font-semibold text-slate-700 hover:border-brand-400 dark:border-slate-700 dark:text-slate-200"
        >
          View Insights
        </Link>
        <button
          type="button"
          onClick={() => setPendingCancelEvent(true)}
          className="rounded-full border border-red-300 px-4 py-2 text-xs font-semibold text-red-700 hover:bg-red-50 dark:border-red-800 dark:text-red-300 dark:hover:bg-red-950/30"
        >
          Cancel event
        </button>
      </div>

      {editing && event && (
        <NewEventForm
          counties={counties}
          event={event}
          onSaved={(updated) => {
            setEvent(updated);
            setEditing(false);
            setSuccessMessage("Event details updated.");
          }}
        />
      )}

      {hasTicketing && (
        <>
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
          </div>

          <div>
            <h2 className="text-sm font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
              Orders &amp; Payments
            </h2>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              Review payment references and issue tickets. Each attendee&apos;s tickets are listed under their order.
            </p>
          </div>

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
                                onClick={() => setPendingCancelTicket(ticket)}
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
        </>
      )}

      <ConfirmDialog
        open={pendingCancelTicket !== null}
        title={pendingCancelTicket ? `Cancel ${pendingCancelTicket.ticketTypeName} ticket ${pendingCancelTicket.ticketNumber}?` : ""}
        description="The attendee will no longer be able to use this ticket for entry. This does not affect any other ticket in the same order."
        confirmLabel="Cancel ticket"
        cancelLabel="Keep ticket"
        loadingLabel="Cancelling…"
        isLoading={cancelTicketLoading}
        error={cancelTicketError}
        onConfirm={confirmCancelTicket}
        onCancel={() => {
          setPendingCancelTicket(null);
          setCancelTicketError(null);
        }}
      />

      <ConfirmDialog
        open={pendingCancelEvent}
        title={event ? `Cancel "${event.name}"?` : "Cancel this event?"}
        description="This removes the event listing for everyone. Anyone who was planning around it won't be notified."
        confirmLabel="Cancel Event"
        loadingLabel="Cancelling…"
        isLoading={cancelEventLoading}
        error={cancelEventError}
        onConfirm={confirmCancelEvent}
        onCancel={() => {
          if (cancelEventLoading) return;
          setPendingCancelEvent(false);
          setCancelEventError(null);
        }}
      />
    </main>
  );
}
