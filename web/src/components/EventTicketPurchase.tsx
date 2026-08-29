"use client";

import Link from "next/link";
import { useState } from "react";
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
    <section className="mt-6 rounded-2xl border border-brand-200 bg-brand-50/60 p-5 dark:border-brand-900/60 dark:bg-brand-950/30">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-slate-900 dark:text-slate-50">
            Get tickets
          </h2>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
            {event.ticketCurrency} {Number(event.ticketPrice).toFixed(2)} per
            ticket
            {event.ticketCapacity
              ? ` · ${event.ticketCapacity} total available`
              : ""}
          </p>
        </div>
        <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-900 dark:bg-amber-900/40 dark:text-amber-200">
          Manual payment
        </span>
      </div>
      {event.paymentInstructions && (
        <div className="mt-4 rounded-xl bg-white p-3 text-sm text-slate-700 dark:bg-slate-900 dark:text-slate-200">
          <p className="font-semibold">Payment instructions</p>
          <p className="mt-1 whitespace-pre-wrap">
            {event.paymentInstructions}
          </p>
        </div>
      )}
      {!user ? (
        <p className="mt-4 text-sm text-slate-600 dark:text-slate-300">
          <Link
            href="/login"
            className="font-semibold text-brand-700 hover:underline dark:text-brand-300"
          >
            Log in
          </Link>{" "}
          to submit your payment reference.
        </p>
      ) : (
        <div className="mt-4 grid gap-3">
          <label className="text-sm font-medium text-slate-700 dark:text-slate-200">
            Quantity
            <input
              type="number"
              min={1}
              max={20}
              value={quantity}
              onChange={(e) =>
                setQuantity(
                  Math.max(1, Math.min(20, Number(e.target.value) || 1)),
                )
              }
              className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 dark:border-slate-700 dark:bg-slate-950"
            />
          </label>
          <label className="text-sm font-medium text-slate-700 dark:text-slate-200">
            Payment reference
            <input
              required
              value={paymentReference}
              onChange={(e) => setPaymentReference(e.target.value)}
              placeholder="Transaction/reference number"
              className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 dark:border-slate-700 dark:bg-slate-950"
            />
          </label>
          <label className="text-sm font-medium text-slate-700 dark:text-slate-200">
            Note (optional)
            <textarea
              value={paymentNote}
              onChange={(e) => setPaymentNote(e.target.value)}
              placeholder="Any helpful payment detail"
              rows={2}
              className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 dark:border-slate-700 dark:bg-slate-950"
            />
          </label>
          {error && (
            <p role="alert" className="text-sm text-red-700 dark:text-red-300">
              {error}
            </p>
          )}
          {message && (
            <p className="text-sm text-emerald-700 dark:text-emerald-300">
              {message}{" "}
              <Link
                href="/account/my-tickets"
                className="font-semibold underline"
              >
                View My Tickets
              </Link>
            </p>
          )}
          <button
            type="button"
            disabled={submitting || !paymentReference.trim()}
            onClick={submit}
            className="rounded-full bg-brand-700 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
          >
            {submitting ? "Submitting…" : "Submit payment reference"}
          </button>
        </div>
      )}
    </section>
  );
}
