/* Atlantic Signal ticketing: ocean-ink framing, warm ticket stock, signal-yellow waypoints, tactile pass details, visual-only refinement. */
"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import {
  ArrowDownTrayIcon,
  ArrowLeftIcon,
  ArrowRightIcon,
  CalendarDaysIcon,
  CheckBadgeIcon,
  CheckIcon,
  ClockIcon,
  InformationCircleIcon,
  MapPinIcon,
  PaperAirplaneIcon,
  QrCodeIcon,
  TicketIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";
import { useAuth } from "@/hooks/useAuth";
import {
  acceptTicketTransfer,
  cancelTicketTransfer,
  declineTicketTransfer,
  getMyTicketOrders,
} from "@/lib/event-ticket-api";
import { HttpError } from "@/lib/http";
import type { EventTicketOrder, MyTicketsResponse } from "@/lib/types";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { SendTicketModal } from "@/components/SendTicketModal";

// The customer-facing payment status vocabulary — deliberately just these
// three (plus Cancelled) so a buyer never has to guess what a status
// means or wonder whether their reference was even received.
const STATUS_LABELS: Record<EventTicketOrder["status"], string> = {
  pending_payment_review: "Pending Verification",
  approved: "Approved",
  rejected: "Rejected",
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

// An individual issued pass still counts as "this buyer's" as long as it
// hasn't been used, voided, or already handed off — a pending *outgoing*
// transfer doesn't disqualify it yet, since the buyer can still cancel
// that transfer and get it back (see the cancel-transfer control below).
function isTicketStillActive(ticket: { status: string; transfer?: { status: string } }) {
  if (ticket.status === "redeemed" || ticket.status === "void") return false;
  if (ticket.transfer?.status === "sent") return false;
  return true;
}

// Product ask (Sep 9, 2026): "past tickets, active tickets, and tickets
// shared with you" as three distinct, easy-to-reach views — previously
// every order (pending, approved, rejected, cancelled, from this month or
// two years ago) rendered in one unbroken list, with "Tickets you
// received" tacked on at the very bottom below all of it. A buyer with
// even a modest order history had to scroll past every past order just to
// discover a ticket a friend had sent them. This is that grouping: an
// order counts as "active" while it's still awaiting payment review, or
// approved with at least one pass the buyer can still use or transfer
// themselves — everything else (rejected, cancelled, or approved orders
// where every pass has been used/voided/given away) is "past".
function isOrderActive(order: EventTicketOrder): boolean {
  if (order.status === "pending_payment_review") return true;
  if (order.status === "rejected" || order.status === "cancelled") return false;
  // Approved. An order not yet showing its issued tickets (organizer still
  // finishing issuance — see the "Your payment was approved..." message
  // below) has nothing to judge yet, so it stays active rather than
  // disappearing into Past the moment it's approved.
  if (!order.tickets || order.tickets.length === 0) return true;
  return order.tickets.some(isTicketStillActive);
}

const EMPTY_RESPONSE: MyTicketsResponse = { orders: [], receivedTickets: [], pendingTransfers: [] };

type TicketTab = "active" | "past" | "shared";

export default function MyTicketsPage() {
  const { user, token, ready } = useAuth();
  const [data, setData] = useState<MyTicketsResponse>(EMPTY_RESPONSE);
  const [tab, setTab] = useState<TicketTab>("active");
  const [error, setError] = useState<string | null>(null);
  const [sendTarget, setSendTarget] = useState<{
    instanceId: string;
    eventName: string;
    ticketTypeName: string;
  } | null>(null);
  const [cancelTarget, setCancelTarget] = useState<string | null>(null);
  const [declineTarget, setDeclineTarget] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const load = useCallback(() => {
    if (!token) return;
    getMyTicketOrders(token)
      .then(setData)
      .catch((err) =>
        setError(err instanceof HttpError ? err.message : "Unable to load your tickets."),
      );
  }, [token]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleAccept(transferId: string) {
    if (!token) return;
    setActionLoading(true);
    setActionError(null);
    try {
      setData(await acceptTicketTransfer(token, transferId));
    } catch (err) {
      setActionError(err instanceof HttpError ? err.message : "Could not accept this ticket.");
    } finally {
      setActionLoading(false);
    }
  }

  async function handleDecline() {
    if (!token || !declineTarget) return;
    setActionLoading(true);
    setActionError(null);
    try {
      await declineTicketTransfer(token, declineTarget);
      setDeclineTarget(null);
      load();
    } catch (err) {
      setActionError(err instanceof HttpError ? err.message : "Could not decline this ticket.");
    } finally {
      setActionLoading(false);
    }
  }

  async function handleCancel() {
    if (!token || !cancelTarget) return;
    setActionLoading(true);
    setActionError(null);
    try {
      setData(await cancelTicketTransfer(token, cancelTarget));
      setCancelTarget(null);
    } catch (err) {
      setActionError(err instanceof HttpError ? err.message : "Could not cancel this transfer.");
    } finally {
      setActionLoading(false);
    }
  }

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

  const { orders, receivedTickets, pendingTransfers } = data;
  const activeOrders = orders.filter(isOrderActive);
  const pastOrders = orders.filter((order) => !isOrderActive(order));
  const sharedCount = pendingTransfers.length + receivedTickets.length;
  const activePasses = activeOrders.length + receivedTickets.length;
  const hasAnyTickets = orders.length > 0 || receivedTickets.length > 0 || pendingTransfers.length > 0;

  function renderOrderCard(order: EventTicketOrder) {
    return (
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
                <div className="issued-pass-head">
                  <span><QrCodeIcon aria-hidden className="h-4 w-4" /> Ticket {ticket.sequence} of {order.quantity}</span>
                  {ticket.status === "redeemed" ? (
                    <span className="issued-pass-used"><CheckBadgeIcon aria-hidden className="h-4 w-4" /> Used</span>
                  ) : ticket.status === "void" ? (
                    <span className="issued-pass-used">Cancelled</span>
                  ) : ticket.transfer ? (
                    <span className="issued-pass-valid">{ticket.transfer.status === "pending" ? "Pending transfer" : "Sent"}</span>
                  ) : (
                    <span className="issued-pass-valid">Active</span>
                  )}
                </div>
                {/* Ticket type is the single most prominent label on the
                    card — VIP, Regular, Backstage, etc. should be
                    unmistakable at a glance, not buried in small text. */}
                <p className="issued-pass-type">{ticket.ticketTypeName}</p>
                <div className="issued-pass-id" aria-label={`Ticket ID ${ticket.ticketNumber}`}>
                  <div className="issued-pass-id-label"><TicketIcon aria-hidden className="h-4 w-4" /> Ticket ID</div>
                  <code>{ticket.ticketNumber}</code>
                  <p>Use this ID if scanning fails or when reporting an issue.</p>
                </div>

                {ticket.transfer ? (
                  <div className="ticket-transfer-status-block">
                    <PaperAirplaneIcon aria-hidden className="h-5 w-5" />
                    {ticket.transfer.status === "pending" ? (
                      <>
                        <p>Pending transfer to <strong>{ticket.transfer.toEmail}</strong>. It stops being yours once they accept.</p>
                        <button type="button" onClick={() => setCancelTarget(ticket.transfer!.transferId)} className="ticket-transfer-cancel-link">
                          Cancel transfer
                        </button>
                      </>
                    ) : (
                      <p>Sent to <strong>{ticket.transfer.toEmail}</strong>. It&apos;s now their ticket.</p>
                    )}
                  </div>
                ) : (
                  <>
                    {ticket.qrDataUrl && <img src={ticket.qrDataUrl} alt={`QR code for ${order.event.name}, ${ticket.ticketTypeName} ticket ${ticket.sequence} of ${order.quantity}`} className={`issued-pass-qr ${ticket.status === "redeemed" ? "issued-pass-qr-used" : ""}`} />}
                    {ticket.status === "redeemed" ? (
                      <p className="issued-pass-note">Scanned on {ticket.redeemedAt ? new Date(ticket.redeemedAt).toLocaleString() : "event day"}.</p>
                    ) : ticket.status === "void" ? (
                      <p className="issued-pass-note">This ticket has been cancelled and can no longer be used.</p>
                    ) : (
                      <>
                        {ticket.qrDataUrl && (
                          <a href={ticket.qrDataUrl} download={`liberia360-${order.event.name.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}-${ticket.ticketNumber}.png`} className="issued-pass-download"><ArrowDownTrayIcon aria-hidden className="h-4 w-4" /> Download QR</a>
                        )}
                        <button
                          type="button"
                          onClick={() =>
                            setSendTarget({
                              instanceId: ticket.id,
                              eventName: order.event.name,
                              ticketTypeName: ticket.ticketTypeName,
                            })
                          }
                          className="issued-pass-send"
                        >
                          <PaperAirplaneIcon aria-hidden className="h-4 w-4" /> Send to someone
                        </button>
                      </>
                    )}
                  </>
                )}
              </div>
            ))}
          </div>
        ) : order.status === "approved" ? (
          <p className="ticket-order-message ticket-order-message-review">Your payment was approved. The organizer is finishing ticket issuance; refresh shortly.</p>
        ) : order.status === "pending_payment_review" ? (
          <p className="ticket-order-message ticket-order-message-review">Payment reference: {order.paymentReference}. The organizer must verify it before issuing your QR ticket.</p>
        ) : order.status === "rejected" ? (
          <p className="ticket-order-message ticket-order-message-rejected">
            {order.reviewNote ? `Reason: ${order.reviewNote}` : "This payment reference could not be verified."}{" "}
            <Link href={`/events/${order.event.id}`} className="font-semibold underline">Submit another payment reference</Link>
          </p>
        ) : null}

        <div className="ticket-order-foot"><span><InformationCircleIcon aria-hidden className="h-4 w-4" /> Keep this QR code private.</span><Link href={`/events/${order.event.id}`}>View event <ArrowRightIcon aria-hidden className="h-4 w-4" /></Link></div>
      </li>
    );
  }

  function renderTabEmpty(title: string, description: string) {
    return (
      <div className="ticket-empty-state ticket-tab-empty">
        <div className="ticket-state-icon"><TicketIcon aria-hidden className="h-7 w-7" /></div>
        <h2>{title}</h2>
        <p>{description}</p>
      </div>
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
        <div><span><TicketIcon aria-hidden className="h-4 w-4" /> ACTIVE PASSES</span><strong>{activePasses}</strong></div>
        <div><span><CalendarDaysIcon aria-hidden className="h-4 w-4" /> TICKET ORDERS</span><strong>{orders.length}</strong></div>
        <div><span><ClockIcon aria-hidden className="h-4 w-4" /> PRIVATE BY DEFAULT</span><strong>1× scan</strong></div>
      </div>

      {error && <p role="alert" className="ticket-page-alert"><InformationCircleIcon aria-hidden className="h-5 w-5" /> {error}</p>}
      {actionError && <p role="alert" className="ticket-page-alert"><InformationCircleIcon aria-hidden className="h-5 w-5" /> {actionError}</p>}

      {/* Unmissable regardless of which tab is open — a transfer awaiting
          accept/decline is time-sensitive (it expires), so it doesn't wait
          behind a tab click the way the rest of "Shared with you" can. */}
      {pendingTransfers.length > 0 && tab !== "shared" && (
        <div className="ticket-shared-banner">
          <p><PaperAirplaneIcon aria-hidden className="h-4 w-4" /> {pendingTransfers.length} ticket{pendingTransfers.length === 1 ? "" : "s"} sent to you, waiting for a response.</p>
          <button type="button" onClick={() => setTab("shared")}>Review</button>
        </div>
      )}

      {!hasAnyTickets ? (
        <div className="ticket-empty-state"><div className="ticket-state-icon"><TicketIcon aria-hidden className="h-7 w-7" /></div><h2>No passes yet.</h2><p>When you request a ticket, its payment status and QR pass will appear here.</p><Link href="/events" className="ticket-primary-link">Browse events <ArrowRightIcon aria-hidden className="h-4 w-4" /></Link></div>
      ) : (
        <>
          <div className="ticket-tabs" role="tablist" aria-label="Ticket views">
            <button type="button" role="tab" aria-selected={tab === "active"} onClick={() => setTab("active")} className="ticket-tab">
              <TicketIcon aria-hidden className="h-4 w-4" /> Active <span className="ticket-tab-count">{activeOrders.length}</span>
            </button>
            <button type="button" role="tab" aria-selected={tab === "past"} onClick={() => setTab("past")} className="ticket-tab">
              <ClockIcon aria-hidden className="h-4 w-4" /> Past <span className="ticket-tab-count">{pastOrders.length}</span>
            </button>
            <button type="button" role="tab" aria-selected={tab === "shared"} onClick={() => setTab("shared")} className="ticket-tab">
              <PaperAirplaneIcon aria-hidden className="h-4 w-4" /> Shared with you <span className="ticket-tab-count">{sharedCount}</span>
            </button>
          </div>

          {tab === "active" && (
            activeOrders.length === 0
              ? renderTabEmpty("No active passes right now.", "Approved orders with a usable QR pass, and anything still awaiting payment review, show up here.")
              : <ul className="ticket-orders-list">{activeOrders.map(renderOrderCard)}</ul>
          )}

          {tab === "past" && (
            pastOrders.length === 0
              ? renderTabEmpty("No past tickets yet.", "Rejected, cancelled, and fully used orders move here once they're no longer active.")
              : <ul className="ticket-orders-list">{pastOrders.map(renderOrderCard)}</ul>
          )}

          {tab === "shared" && (
            sharedCount === 0 ? (
              renderTabEmpty("Nothing shared with you yet.", "Tickets a friend sends you — pending or already accepted — will show up here.")
            ) : (
              <>
                {pendingTransfers.length > 0 && (
                  <section className="ticket-transfer-inbox">
                    <h2><PaperAirplaneIcon aria-hidden className="h-4 w-4" /> Ticket{pendingTransfers.length === 1 ? "" : "s"} sent to you</h2>
                    <ul>
                      {pendingTransfers.map((transfer) => (
                        <li key={transfer.id} className="ticket-transfer-inbox-row">
                          <div>
                            <p className="ticket-transfer-inbox-title">{transfer.ticketTypeName} — {transfer.event.name}</p>
                            <p className="ticket-transfer-inbox-meta">From {transfer.fromUserName} · {formatDate(transfer.event.startDate)}</p>
                          </div>
                          <div className="ticket-transfer-inbox-actions">
                            <button type="button" onClick={() => handleAccept(transfer.id)} disabled={actionLoading} className="ticket-transfer-accept">
                              <CheckIcon aria-hidden className="h-4 w-4" /> Accept
                            </button>
                            <button type="button" onClick={() => setDeclineTarget(transfer.id)} disabled={actionLoading} className="ticket-transfer-decline">
                              <XMarkIcon aria-hidden className="h-4 w-4" /> Decline
                            </button>
                          </div>
                        </li>
                      ))}
                    </ul>
                  </section>
                )}

                {receivedTickets.length > 0 && (
                  <section className="ticket-received-section">
                    <h2><TicketIcon aria-hidden className="h-4 w-4" /> Tickets you received</h2>
                    <div className="issued-pass-grid">
                      {receivedTickets.map((ticket) => (
                        <div key={ticket.id} className="issued-pass-card">
                          <div className="issued-pass-head">
                            <span><QrCodeIcon aria-hidden className="h-4 w-4" /> From {ticket.fromUserName}</span>
                            {ticket.status === "redeemed" ? (
                              <span className="issued-pass-used"><CheckBadgeIcon aria-hidden className="h-4 w-4" /> Used</span>
                            ) : ticket.status === "void" ? (
                              <span className="issued-pass-used">Cancelled</span>
                            ) : (
                              <span className="issued-pass-valid">Active</span>
                            )}
                          </div>
                          <p className="issued-pass-type">{ticket.ticketTypeName}</p>
                          <p className="ticket-order-location"><CalendarDaysIcon aria-hidden className="h-4 w-4" /> {formatDate(ticket.event.startDate)} <span>·</span> <MapPinIcon aria-hidden className="h-4 w-4" /> {ticket.event.locationText ?? "Liberia"}</p>
                          <div className="issued-pass-id" aria-label={`Ticket ID ${ticket.ticketNumber}`}>
                            <div className="issued-pass-id-label"><TicketIcon aria-hidden className="h-4 w-4" /> Ticket ID</div>
                            <code>{ticket.ticketNumber}</code>
                          </div>
                          {ticket.qrDataUrl && <img src={ticket.qrDataUrl} alt={`QR code for ${ticket.event.name}, ${ticket.ticketTypeName}`} className={`issued-pass-qr ${ticket.status === "redeemed" ? "issued-pass-qr-used" : ""}`} />}
                          {ticket.status === "redeemed" ? (
                            <p className="issued-pass-note">Scanned on {ticket.redeemedAt ? new Date(ticket.redeemedAt).toLocaleString() : "event day"}.</p>
                          ) : ticket.status === "void" ? (
                            <p className="issued-pass-note">This ticket has been cancelled and can no longer be used.</p>
                          ) : ticket.qrDataUrl ? (
                            <a href={ticket.qrDataUrl} download={`liberia360-${ticket.event.name.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}-${ticket.ticketNumber}.png`} className="issued-pass-download"><ArrowDownTrayIcon aria-hidden className="h-4 w-4" /> Download QR</a>
                          ) : null}
                        </div>
                      ))}
                    </div>
                  </section>
                )}
              </>
            )
          )}
        </>
      )}

      {sendTarget && token && (
        <SendTicketModal
          token={token}
          instanceId={sendTarget.instanceId}
          eventName={sendTarget.eventName}
          ticketTypeName={sendTarget.ticketTypeName}
          onClose={() => setSendTarget(null)}
          onSent={setData}
        />
      )}

      <ConfirmDialog
        open={cancelTarget !== null}
        title="Cancel this ticket transfer?"
        description="The ticket stays yours, with its QR pass restored, and the pending offer is withdrawn."
        confirmLabel="Cancel transfer"
        loadingLabel="Cancelling…"
        isLoading={actionLoading}
        error={actionError}
        onConfirm={handleCancel}
        onCancel={() => setCancelTarget(null)}
      />

      <ConfirmDialog
        open={declineTarget !== null}
        title="Decline this ticket?"
        description="It stays with whoever sent it — you won't be able to undo this from here."
        confirmLabel="Decline"
        loadingLabel="Declining…"
        isLoading={actionLoading}
        error={actionError}
        onConfirm={handleDecline}
        onCancel={() => setDeclineTarget(null)}
      />
    </main>
  );
}
