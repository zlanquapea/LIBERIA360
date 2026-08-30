"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowDownTrayIcon, CheckBadgeIcon, QrCodeIcon } from "@heroicons/react/24/outline";
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

function formatDate(value: string) {
  return new Date(value).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default function MyTicketsPage() {
  const { user, token, ready } = useAuth();
  const [orders, setOrders] = useState<EventTicketOrder[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    getMyTicketOrders(token)
      .then(setOrders)
      .catch((err) =>
        setError(err instanceof HttpError ? err.message : "Unable to load your tickets."),
      );
  }, [token]);

  if (!ready) {
    return <main className="mx-auto max-w-2xl px-4 py-10 text-sm text-slate-500">Loading…</main>;
  }
  if (!user) {
    return (
      <main className="mx-auto max-w-2xl px-4 py-10 text-center">
        <h1 className="text-xl font-bold">My Tickets</h1>
        <p className="mt-2 text-sm text-slate-500">Log in to view your ticket orders.</p>
        <Link href="/login" className="mt-4 inline-block rounded-full bg-brand-700 px-5 py-2.5 text-sm font-semibold text-white">Log in</Link>
      </main>
    );
  }

  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-5 px-4 py-8">
      <div>
        <Link href="/account" className="text-sm text-brand-700 hover:underline dark:text-brand-300">← Account</Link>
        <h1 className="mt-2 text-2xl font-bold text-slate-900 dark:text-slate-50">My Tickets</h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Keep each QR code private. It is valid for one scan only.</p>
      </div>
      {error && <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950/30 dark:text-red-300">{error}</p>}
      {orders.length === 0 ? (
        <p className="rounded-xl border border-dashed border-slate-300 px-4 py-8 text-center text-sm text-slate-500 dark:border-slate-700">
          You have no ticket orders yet. <Link href="/events" className="font-semibold text-brand-700 hover:underline dark:text-brand-300">Browse events</Link>.
        </p>
      ) : (
        <ul className="grid gap-5">
          {orders.map((order) => (
            <li key={order.id} className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <div className="flex items-start justify-between gap-3 border-b border-slate-100 bg-brand-950 px-4 py-4 text-white dark:border-slate-800">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gold-300">LIBERIA360 EVENT PASS</p>
                  <Link href={`/events/${order.event.id}`} className="mt-1 block text-lg font-bold hover:underline">{order.event.name}</Link>
                  <p className="mt-1 text-xs text-slate-200">{formatDate(order.event.startDate)} · {order.event.locationText ?? order.event.county?.name ?? "Liberia"}</p>
                </div>
                <span className="shrink-0 rounded-full bg-white/15 px-2 py-1 text-[11px] font-semibold">{STATUS_LABELS[order.status]}</span>
              </div>
              <div className="p-4">
                <div className="flex items-center justify-between gap-3 text-sm text-slate-600 dark:text-slate-300">
                  <span>{order.quantity} pass{order.quantity === 1 ? "" : "es"} · {order.currency} {Number(order.totalAmount).toFixed(2)}</span>
                  {order.ticketCode && <span className="font-mono text-xs text-slate-500">{order.ticketCode}</span>}
                </div>
                {order.status === "approved" && order.tickets && order.tickets.length > 0 ? (
                  <div className="mt-4 grid gap-4 sm:grid-cols-2">
                    {order.tickets.map((ticket) => (
                      <div key={ticket.id} className="rounded-xl border border-brand-100 bg-brand-50/60 p-3 dark:border-brand-900/60 dark:bg-brand-950/20">
                        <div className="flex items-center justify-between text-xs font-semibold text-brand-900 dark:text-brand-100">
                          <span className="flex items-center gap-1.5"><QrCodeIcon className="h-4 w-4" aria-hidden /> Pass {ticket.sequence}</span>
                          {ticket.status === "redeemed" ? <span className="flex items-center gap-1 text-emerald-700 dark:text-emerald-300"><CheckBadgeIcon className="h-4 w-4" aria-hidden /> Used</span> : <span className="text-amber-700 dark:text-amber-300">Valid</span>}
                        </div>
                        {ticket.qrDataUrl && <img src={ticket.qrDataUrl} alt={`QR code for ${order.event.name}, pass ${ticket.sequence}`} className={`mx-auto mt-3 h-48 w-48 rounded-lg bg-white p-2 object-contain ${ticket.status === "redeemed" ? "opacity-45 grayscale" : ""}`} />}
                        {ticket.status === "redeemed" ? (
                          <p className="mt-3 text-center text-xs text-slate-500">Scanned on {ticket.redeemedAt ? new Date(ticket.redeemedAt).toLocaleString() : "event day"}.</p>
                        ) : ticket.qrDataUrl ? (
                          <a href={ticket.qrDataUrl} download={`liberia360-${order.event.name.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}-pass-${ticket.sequence}.png`} className="mt-3 flex min-h-11 items-center justify-center gap-2 rounded-lg bg-brand-700 px-3 py-2 text-sm font-semibold text-white hover:bg-brand-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"><ArrowDownTrayIcon className="h-4 w-4" aria-hidden /> Download QR</a>
                        ) : null}
                      </div>
                    ))}
                  </div>
                ) : order.status === "approved" ? (
                  <p className="mt-4 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:bg-amber-950/30 dark:text-amber-200">Your payment was approved. The organizer is finishing ticket issuance; refresh shortly.</p>
                ) : order.status === "pending_payment_review" ? (
                  <p className="mt-4 text-sm text-amber-700 dark:text-amber-300">Payment reference: {order.paymentReference}. The organizer must verify it before issuing your QR ticket.</p>
                ) : order.status === "rejected" && order.reviewNote ? (
                  <p className="mt-4 text-sm text-red-700 dark:text-red-300">Note: {order.reviewNote}</p>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
