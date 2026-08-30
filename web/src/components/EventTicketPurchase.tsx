/* Atlantic Signal ticketing: ocean-ink framing, warm ticket stock, signal-yellow waypoints, tactile pass details, visual-only refinement. */
"use client";

import Link from "next/link";
import { useState } from "react";
import {
  ArrowRightIcon,
  BanknotesIcon,
  InformationCircleIcon,
  TicketIcon,
} from "@heroicons/react/24/outline";
import { useAuth } from "@/hooks/useAuth";
import { createEventTicketOrder } from "@/lib/event-ticket-api";
import { HttpError } from "@/lib/http";
import type { Event } from "@/lib/types";

export function EventTicketPurchase({ event }: { event: Event }) {
  const { user, token } = useAuth();
  const [quantity, setQuantity] = useState(1);
  const [paymentReference, setPaymentReference] = useState("");
  const [paymentNote, setPaymentNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!event.ticketPrice || Number(event.ticketPrice) <= 0) return null;

  const unitPrice = Number(event.ticketPrice);
  const total = unitPrice * quantity;

  async function submit() {
    if (!token) return;
    setSubmitting(true);
    setError(null);
    setMessage(null);
    try {
      await createEventTicketOrder(token, event.id, {
        quantity,
        paymentReference: paymentReference.trim(),
        paymentNote: paymentNote.trim() || undefined,
      });
      setMessage(
        "Payment submitted. The organizer will verify it and issue your ticket.",
      );
      setPaymentReference("");
      setPaymentNote("");
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

      <div className="ticket-purchase-summary">
        <div>
          <span className="ticket-summary-label">Price per ticket</span>
          <strong>{event.ticketCurrency} {unitPrice.toFixed(2)}</strong>
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
            <label>
              <span>Quantity</span>
              <input
                type="number"
                min={1}
                max={20}
                value={quantity}
                onChange={(e) => setQuantity(Math.max(1, Math.min(20, Number(e.target.value) || 1)))}
              />
            </label>
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
          <label className="ticket-note-field">
            <span>Note <em>optional</em></span>
            <textarea
              value={paymentNote}
              onChange={(e) => setPaymentNote(e.target.value)}
              placeholder="Any helpful payment detail"
              rows={2}
            />
          </label>
          {error && <p role="alert" className="ticket-form-message ticket-form-error">{error}</p>}
          {message && <p className="ticket-form-message ticket-form-success">{message} <Link href="/account/my-tickets">View My Tickets</Link></p>}
          <button type="button" disabled={submitting || !paymentReference.trim()} onClick={submit} className="ticket-submit-button">
            {submitting ? "Submitting…" : "Submit payment reference"}
            <ArrowRightIcon aria-hidden className="h-4 w-4" />
          </button>
        </div>
      )}

      <div className="ticket-purchase-footnote"><span className="ticket-footnote-dot" /> Payment is verified by the event organizer before a QR ticket is issued.</div>
    </section>
  );
}
