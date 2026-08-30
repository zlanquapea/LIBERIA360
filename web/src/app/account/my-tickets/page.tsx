/* Atlantic Signal ticketing: ocean-ink framing, warm ticket stock, signal-yellow waypoints, tactile pass details, visual-only refinement. */
"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  ArrowDownTrayIcon,
  ArrowLeftIcon,
  ArrowRightIcon,
  CalendarDaysIcon,
  CheckBadgeIcon,
  ClockIcon,
  InformationCircleIcon,
  MapPinIcon,
  QrCodeIcon,
  TicketIcon,
} from "@heroicons/react/24/outline";
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

function statusClass(status: EventTicketOrder["status"]) {
  if (status === "approved") return "ticket-status-issued";
  if (status === "pending_payment_review") return "ticket-status-review";
  if (status === "rejected") return "ticket-status-rejected";
  return "ticket-status-cancelled";
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
    return <main className="ticket-page-state"><div className="ticket-loading-mark"><TicketIcon aria-hidden className="h-6 w-6" /></div><p>Loading your ticket shelf…</p></main>;
  }

  if (!user) {
    return (
      <main className="ticket-page-state ticket-page-state-login">
        <div className="ticket-state-icon"><TicketIcon aria-hidden className="h-7 w-7" /></div>
        <p className="ticket-page-eyebrow">LIBERIA360 / EVENTS</p>
        <h1>Keep your passes close.</h1>
        <p>Log in to view ticket orders, issued QR passes, and payment status in one place.</p>
        <Link href="/login" className="ticket-primary-link">Log in <ArrowRightIcon aria-hidden className="h-4 w-4" /></Link>
      </main>
    );
  }

  return (
    <main className="ticket-page-shell">
      <div className="ticket-page-head">
        <Link href="/account" className="ticket-back-link"><ArrowLeftIcon aria-hidden className="h-4 w-4" /> Account</Link>
        <div className="ticket-page-heading-row">
          <div><p className="ticket-page-eyebrow"><span className="ticket-waypoint" /> LIBERIA360 / EVENTS</p><h1>My ticket shelf.</h1><p>Keep each QR code private. It is valid for one scan only.</p></div>
          <Link href="/events" className="ticket-browse-link">Browse events <ArrowRightIcon aria-hidden className="h-4 w-4" /></Link>
        </div>
      </div>

      <div className="ticket-account-strip">
        <div><span><TicketIcon aria-hidden className="h-4 w-4" /> ACTIVE PASSES</span><strong>{orders.filter((order) => order.status === "approved").length}</strong></div>
        <div><span><CalendarDaysIcon aria-hidden className="h-4 w-4" /> TICKET ORDERS</span><strong>{orders.length}</strong></div>
        <div><span><ClockIcon aria-hidden className="h-4 w-4" /> PRIVATE BY DEFAULT</span><strong>1× scan</strong></div>
      </div>

      {error && <p role="alert" className="ticket-page-alert"><InformationCircleIcon aria-hidden className="h-5 w-5" /> {error}</p>}
      {orders.length === 0 ? (
        <div className="ticket-empty-state"><div className="ticket-state-icon"><TicketIcon aria-hidden className="h-7 w-7" /></div><h2>No passes yet.</h2><p>When you request a ticket, its payment status and QR pass will appear here.</p><Link href="/events" className="ticket-primary-link">Browse events <ArrowRightIcon aria-hidden className="h-4 w-4" /></Link></div>
      ) : (
        <ul className="ticket-orders-list">
          {orders.map((order) => (
            <li key={order.id} className="ticket-order-card">
              <div className="ticket-order-topline"><span className="ticket-order-label"><span className="ticket-waypoint" /> LIBERIA360 EVENT PASS</span><span className={`ticket-order-status ${statusClass(order.status)}`}>{STATUS_LABELS[order.status]}</span></div>
              <div className="ticket-order-heading">
                <div><Link href={`/events/${order.event.id}`} className="ticket-order-title">{order.event.name}</Link><p className="ticket-order-location"><CalendarDaysIcon aria-hidden className="h-4 w-4" /> {formatDate(order.event.startDate)} <span>·</span> <MapPinIcon aria-hidden className="h-4 w-4" /> {order.event.locationText ?? order.event.county?.name ?? "Liberia"}</p></div>
                <div className="ticket-order-total"><span>{order.quantity} pass{order.quantity === 1 ? "" : "es"}</span><strong>{order.currency} {Number(order.totalAmount).toFixed(2)}</strong></div>
              </div>

              {order.status === "approved" && order.tickets && order.tickets.length > 0 ? (
                <div className="issued-pass-grid">
                  {order.tickets.map((ticket) => (
                    <div key={ticket.id} className="issued-pass-card">
                      <div className="issued-pass-head"><span><QrCodeIcon aria-hidden className="h-4 w-4" /> Pass {ticket.sequence}</span>{ticket.status === "redeemed" ? <span className="issued-pass-used"><CheckBadgeIcon aria-hidden className="h-4 w-4" /> Used</span> : <span className="issued-pass-valid">Valid</span>}</div>
                      {ticket.qrDataUrl && <img src={ticket.qrDataUrl} alt={`QR code for ${order.event.name}, pass ${ticket.sequence}`} className={`issued-pass-qr ${ticket.status === "redeemed" ? "issued-pass-qr-used" : ""}`} />}
                      {ticket.status === "redeemed" ? (
                        <p className="issued-pass-note">Scanned on {ticket.redeemedAt ? new Date(ticket.redeemedAt).toLocaleString() : "event day"}.</p>
                      ) : ticket.qrDataUrl ? (
                        <a href={ticket.qrDataUrl} download={`liberia360-${order.event.name.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}-pass-${ticket.sequence}.png`} className="issued-pass-download"><ArrowDownTrayIcon aria-hidden className="h-4 w-4" /> Download QR</a>
                      ) : null}
                    </div>
                  ))}
                </div>
              ) : order.status === "approved" ? (
                <p className="ticket-order-message ticket-order-message-review">Your payment was approved. The organizer is finishing ticket issuance; refresh shortly.</p>
              ) : order.status === "pending_payment_review" ? (
                <p className="ticket-order-message ticket-order-message-review">Payment reference: {order.paymentReference}. The organizer must verify it before issuing your QR ticket.</p>
              ) : order.status === "rejected" && order.reviewNote ? (
                <p className="ticket-order-message ticket-order-message-rejected">Note: {order.reviewNote}</p>
              ) : null}

              <div className="ticket-order-foot"><span><InformationCircleIcon aria-hidden className="h-4 w-4" /> Keep this QR code private.</span><Link href={`/events/${order.event.id}`}>View event <ArrowRightIcon aria-hidden className="h-4 w-4" /></Link></div>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
