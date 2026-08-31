/* Atlantic Signal ticketing: ocean-ink framing, warm ticket stock, signal-yellow waypoints, tactile pass details, visual-only refinement. */
"use client";

import Link from "next/link";
import { useState } from "react";
import {
  ArrowRightIcon,
  BanknotesIcon,
  CheckCircleIcon,
  InformationCircleIcon,
  TicketIcon,
} from "@heroicons/react/24/outline";
import { useAuth } from "@/hooks/useAuth";
import { createEventTicketOrder } from "@/lib/event-ticket-api";
import { HttpError } from "@/lib/http";
import type { Event, EventTicketOrder } from "@/lib/types";

export function EventTicketPurchase({ event }: { event: Event }) {
  const { user, token } = useAuth();
  const [quantity, setQuantity] = useState(1);
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [paymentReference, setPaymentReference] = useState("");
  const [paymentNote, setPaymentNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Set once an order is created — swaps the whole form for a dedicated
  // confirmation screen rather than an inline message the buyer might miss.
  const [submittedOrder, setSubmittedOrder] = useState<EventTicketOrder | null>(null);

  const ticketTypes = event.ticketTypes ?? [];
  if (!ticketTypes.length && (!event.ticketPrice || Number(event.ticketPrice) <= 0)) return null;

  const unitPrice = Number(event.ticketPrice ?? 0);
  const selectedQuantity = ticketTypes.reduce((sum, ticket) => sum + (quantities[ticket.id] || 0), 0);
  const total = ticketTypes.length ? ticketTypes.reduce((sum, ticket) => sum + Number(ticket.price) * (quantities[ticket.id] || 0), 0) : unitPrice * quantity;

  function resetForm() {
    // "Submit Another Payment" starts from a genuinely blank form — nothing
    // from the previous submission should linger unless the buyer re-enters it.
    setQuantity(1);
    setQuantities({});
    setPaymentReference("");
    setPaymentNote("");
    setError(null);
    setSubmittedOrder(null);
  }

  async function submit() {
    if (!token) return;
    setSubmitting(true);
    setError(null);
    try {
      const order = await createEventTicketOrder(token, event.id, {
        quantity: ticketTypes.length ? undefined : quantity,
        selections: ticketTypes.length ? ticketTypes.filter((ticket) => quantities[ticket.id]).map((ticket) => ({ ticketTypeId: ticket.id, quantity: quantities[ticket.id] })) : undefined,
        paymentReference: paymentReference.trim(),
        paymentNote: paymentNote.trim() || undefined,
      });
      setSubmittedOrder(order);
    } catch (err) {
      setError(
        err instanceof HttpError
          ? err.message
          : "Unable to submit payment. Please try again.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  if (submittedOrder) {
    return (
      <section className="ticket-purchase-shell" aria-labelledby="ticket-purchase-title">
        <div className="flex flex-col items-center gap-3 py-6 text-center animate-fade-in-up">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">
            <CheckCircleIcon aria-hidden className="h-8 w-8" />
          </div>
          <h2 id="ticket-purchase-title" className="text-xl font-black text-slate-900 dark:text-white">Payment Submitted</h2>
          <p className="max-w-sm text-sm leading-6 text-slate-600 dark:text-slate-300">
            Your payment reference has been submitted successfully. We will verify your payment and update your ticket status once the payment has been confirmed.
          </p>
          <p className="mt-1 rounded-lg bg-slate-100 px-3 py-2 font-mono text-xs text-slate-600 dark:bg-slate-800 dark:text-slate-300">
            Reference: {submittedOrder.paymentReference}
          </p>
          <div className="mt-3 flex w-full max-w-xs flex-col gap-2">
            <Link href="/account/my-tickets" className="flex min-h-11 items-center justify-center gap-1.5 rounded-full bg-brand-700 px-5 text-sm font-semibold text-white hover:bg-brand-800">
              View My Payment <ArrowRightIcon aria-hidden className="h-4 w-4" />
            </Link>
            <button type="button" onClick={resetForm} className="flex min-h-11 items-center justify-center rounded-full border border-slate-300 px-5 text-sm font-semibold text-slate-700 hover:border-brand-400 dark:border-slate-700 dark:text-slate-200">
              Submit Another Payment
            </button>
            <Link href={`/events/${event.id}`} className="mt-1 text-xs font-medium text-slate-500 hover:underline dark:text-slate-400">
              Back to event
            </Link>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="ticket-purchase-shell" aria-labelledby="ticket-purchase-title">
      <div className="ticket-purchase-header">
        <div>
          <p className="ticket-purchase-eyebrow"><TicketIcon aria-hidden className="h-4 w-4" /> LIBERIA360 EVENT PASS</p>
          <h2 id="ticket-purchase-title">Get tickets for this event.</h2>
          <p className="ticket-purchase-subtitle">Secure your place, then keep the issued QR pass in My Tickets.</p>
        </div>
        <span className="ticket-manual-badge"><BanknotesIcon aria-hidden className="h-4 w-4" /> Manual payment</span>
      </div>

      {ticketTypes.length > 0 && <div className="grid gap-3 sm:grid-cols-2">
        {ticketTypes.map((ticket) => {
          const count = quantities[ticket.id] || 0;
          const almostGone = ticket.quantity <= 10;
          // Mirrors createOrder's own sales-window check (event-tickets.service.ts)
          // — reflect it here too rather than only letting the buyer discover it
          // via a submit-time error.
          const now = Date.now();
          const notYetOnSale = ticket.salesStart && new Date(ticket.salesStart).getTime() > now;
          const salesEnded = ticket.salesEnd && new Date(ticket.salesEnd).getTime() < now;
          const onSale = !notYetOnSale && !salesEnded;
          // The API also caps total selected quantity across all ticket types
          // at 20 per order, so the "+" button must stop there too — not just
          // at this type's own remaining stock.
          const atOrderLimit = selectedQuantity >= 20;
          const canIncrement = onSale && !atOrderLimit && count < ticket.quantity;
          const badgeLabel = !onSale ? (notYetOnSale ? "Not yet on sale" : "Sales ended") : almostGone ? "Almost sold out" : "Available";
          const badgeClassName = !onSale ? "bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-300" : almostGone ? "bg-amber-100 text-amber-800" : "bg-emerald-100 text-emerald-800";
          return <article key={ticket.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900">
            <div className="flex items-start justify-between gap-2"><div><h3 className="font-bold text-slate-900 dark:text-white">{ticket.name}</h3><p className="mt-1 text-2xl font-black text-brand-700">{event.ticketCurrency} {Number(ticket.price).toFixed(2)}</p></div><span className={`rounded-full px-2 py-1 text-[10px] font-bold uppercase ${badgeClassName}`}>{badgeLabel}</span></div>
            {ticket.description && <p className="mt-2 text-sm text-slate-500">{ticket.description}</p>}
            <div className="mt-4 flex items-center justify-between"><span className="text-xs font-semibold text-slate-500">Quantity</span><div className="flex items-center overflow-hidden rounded-full border border-slate-300"><button type="button" aria-label={`Remove one ${ticket.name}`} disabled={count === 0} onClick={() => setQuantities((all) => ({ ...all, [ticket.id]: Math.max(0, count - 1) }))} className="h-10 w-10 text-lg disabled:cursor-not-allowed disabled:opacity-40">−</button><strong className="w-8 text-center">{onSale ? count : 0}</strong><button type="button" aria-label={`Add one ${ticket.name}`} disabled={!canIncrement} onClick={() => setQuantities((all) => ({ ...all, [ticket.id]: Math.min(ticket.quantity, count + 1) }))} className="h-10 w-10 text-lg disabled:cursor-not-allowed disabled:opacity-40">+</button></div></div>
            {atOrderLimit && count === 0 && <p className="mt-2 text-xs text-slate-500">You&apos;ve reached the 20-ticket order limit.</p>}
          </article>;
        })}
      </div>}

      <div className="ticket-purchase-summary">
        <div>
          <span className="ticket-summary-label">Selected</span>
          <strong>{ticketTypes.length ? selectedQuantity : quantity} ticket{(ticketTypes.length ? selectedQuantity : quantity) === 1 ? '' : 's'}</strong>
        </div>
        {event.ticketCapacity && <div><span className="ticket-summary-label">Available</span><strong>{event.ticketCapacity} spots</strong></div>}
        <div><span className="ticket-summary-label">Your total</span><strong>{event.ticketCurrency} {total.toFixed(2)}</strong></div>
      </div>

      {event.paymentInstructions && (
        <div className="ticket-instructions">
          <div className="ticket-instructions-icon"><InformationCircleIcon aria-hidden className="h-5 w-5" /></div>
          <div><p>Payment instructions</p><p>{event.paymentInstructions}</p></div>
        </div>
      )}

      {!user ? (
        <div className="ticket-login-prompt">
          <p>Log in to submit your payment reference and request a ticket.</p>
          <Link href="/login" className="ticket-action-link">Log in to continue <ArrowRightIcon aria-hidden className="h-4 w-4" /></Link>
        </div>
      ) : (
        <div className="ticket-purchase-form">
          <div className="ticket-form-grid">
            {!ticketTypes.length && <label>
              <span>Quantity</span>
              <input
                type="number"
                min={1}
                max={20}
                value={quantity}
                onChange={(e) => setQuantity(Math.max(1, Math.min(20, Number(e.target.value) || 1)))}
              />
            </label>}
            <label>
              <span>Payment reference</span>
              <input
                required
                value={paymentReference}
                onChange={(e) => setPaymentReference(e.target.value)}
                placeholder="Transaction/reference number"
              />
            </label>
          </div>
          {error && <p role="alert" className="ticket-form-message ticket-form-error">{error}</p>}
          <label className="ticket-note-field">
            <span>Note <em>optional</em></span>
            <textarea
              value={paymentNote}
              onChange={(e) => setPaymentNote(e.target.value)}
              placeholder="Any helpful payment detail"
              rows={2}
            />
          </label>
          <button type="button" disabled={submitting || !paymentReference.trim() || (ticketTypes.length > 0 && (selectedQuantity === 0 || selectedQuantity > 20))} onClick={submit} className="ticket-submit-button">
            {submitting ? "Submitting…" : "Submit payment reference"}
            <ArrowRightIcon aria-hidden className="h-4 w-4" />
          </button>
        </div>
      )}

      <div className="ticket-purchase-footnote"><span className="ticket-footnote-dot" /> Payment is verified by the event organizer before a QR ticket is issued.</div>
    </section>
  );
}
