"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import {
  ArrowRightIcon,
  ChatBubbleOvalLeftEllipsisIcon,
  ClockIcon,
  MapPinIcon,
  PhoneIcon,
} from "@heroicons/react/24/outline";
import { OrderStepper } from "@/components/orders/OrderStepper";
import { ChoiceCard, CopyButton } from "@/components/menu/CartSheet";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { SafeImage } from "@/components/SafeImage";
import { LoneStar } from "@/components/LoneStar";
import {
  cancelTripBooking,
  getTripBooking,
  payTripBooking,
  type TripBooking,
  type TripPaymentMethod,
} from "@/lib/group-trips-api";
import {
  PAYMENT_BADGES,
  PAYMENT_METHOD_LABELS,
  STATUS_STYLES,
  TRAVELLER_STATUS_LABELS,
  bookingSteps,
  clock,
  countdown,
  dateRange,
  isActiveBooking,
  money,
  shortDate,
  telLink,
  whatsappLink,
} from "@/lib/group-trips";
import { resolveImageUrl } from "@/lib/images";
import { METHOD_ICON } from "./BookSpotSheet";

const PAYMENT_STATUS_TEXT = {
  awaiting_verification: "Being checked",
  received: "Received",
  rejected: "Not found",
} as const;

function NextStep({ b }: { b: TripBooking }) {
  const waiting = b.payments.some((p) => p.status === "awaiting_verification");
  const rejected = b.payments.at(-1)?.status === "rejected";
  let text: string | null = null;
  if (b.status === "waitlisted")
    text =
      "The trip is full right now. If a spot opens up the organiser can give it to you — we'll let you know straight away.";
  else if (b.status === "pending" && rejected)
    text =
      "The organiser couldn't find your payment. Check the transaction ID and send it again below.";
  else if (b.status === "pending" && waiting)
    text =
      "The organiser is checking your payment. Your spots are held meanwhile.";
  else if (b.status === "pending" && b.paymentMethod === "cash")
    text = `Hand ${money(b.amountToHold, b.currency)} in cash to the organiser to secure your spots — call or WhatsApp them to arrange it.`;
  else if (b.status === "pending")
    text = "The organiser will confirm your booking soon.";
  else if (b.status === "confirmed" && b.outstanding > 0)
    text = `You're going! ${money(b.outstanding, b.currency)} is still to pay${b.balanceDueDate ? ` by ${shortDate(b.balanceDueDate)}` : " before the trip"}.`;
  else if (b.status === "confirmed")
    text = "You’re all set. Show this ticket when you board.";
  else if (b.status === "declined" || b.status === "cancelled")
    text =
      b.paymentStatus === "refund_due"
        ? `The organiser owes you a refund of ${money(b.amountPaid, b.currency)}.`
        : b.paymentStatus === "refunded"
          ? `Your ${money(b.amountPaid, b.currency)} has been refunded.`
          : null;
  if (!text) return null;
  return (
    <p className="rounded-2xl bg-brand-50 px-4 py-3 text-sm text-brand-900 dark:bg-brand-950/40 dark:text-brand-100">
      {text}
    </p>
  );
}

/** Pay the deposit again, or the balance, by mobile money. */
function PayForm({
  b,
  onPaid,
}: {
  b: TripBooking;
  onPaid: (b: TripBooking) => void;
}) {
  const mobile = b.paymentOptions.filter((o) => o.method !== "cash");
  const [method, setMethod] = useState<TripPaymentMethod>(
    mobile[0]?.method ?? "mtn_momo",
  );
  const [amount, setAmount] = useState(String(b.outstanding));
  const [reference, setReference] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const option = mobile.find((o) => o.method === method);
  if (!mobile.length) return null;

  async function send() {
    setBusy(true);
    setError("");
    try {
      onPaid(
        await payTripBooking(b.id, {
          amount: Number(amount),
          method,
          reference: reference.trim(),
        }),
      );
      setReference("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not send. Try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="flex flex-col gap-3 rounded-[2rem] border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
      <h2 className="font-bold text-slate-950 dark:text-slate-50">
        Pay by mobile money
      </h2>
      <div className="flex flex-col gap-2">
        {mobile.map((o) => (
          <ChoiceCard
            key={o.method}
            name="trip-balance-method"
            checked={method === o.method}
            onSelect={() => setMethod(o.method)}
            icon={METHOD_ICON[o.method]}
            title={PAYMENT_METHOD_LABELS[o.method]}
            detail={o.account ?? undefined}
          />
        ))}
      </div>
      {option?.account && (
        <div className="flex items-center justify-between gap-3 rounded-2xl bg-slate-50 px-4 py-3 dark:bg-slate-800/60">
          <span>
            <span className="block font-mono text-lg font-bold tabular-nums">
              {option.account}
            </span>
            {b.accountName && (
              <span className="text-xs text-slate-500">{b.accountName}</span>
            )}
          </span>
          <CopyButton
            value={option.account.replace(/\s/g, "")}
            label="number"
          />
        </div>
      )}
      <div className="grid gap-3 sm:grid-cols-[8rem_minmax(0,1fr)]">
        <label className="text-sm font-medium text-slate-700 dark:text-slate-200">
          Amount ({b.currency})
          <input
            type="number"
            inputMode="decimal"
            min={0}
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="input mt-1 w-full"
          />
        </label>
        <label className="text-sm font-medium text-slate-700 dark:text-slate-200">
          Transaction ID from your SMS
          <input
            value={reference}
            onChange={(e) => setReference(e.target.value)}
            maxLength={80}
            placeholder="e.g. MP240115.1234.A56789"
            className="input mt-1 w-full font-mono"
          />
        </label>
      </div>
      {error && (
        <p role="alert" className="text-sm text-flag-700 dark:text-flag-300">
          {error}
        </p>
      )}
      <button
        type="button"
        disabled={busy || !reference.trim() || !(Number(amount) > 0)}
        onClick={() => void send()}
        className="min-h-11 rounded-full bg-brand-700 px-5 text-sm font-bold text-white hover:bg-brand-800 disabled:opacity-50"
      >
        {busy
          ? "Sending…"
          : `I've sent ${Number(amount) > 0 ? money(Number(amount), b.currency) : "it"}`}
      </button>
    </section>
  );
}

/**
 * A traveller's booking on an organised trip: the ticket itself (with a
 * QR the organiser scans at the bus), where and when to be, what's been
 * paid and what's left, and a way to pay the rest by mobile money.
 */
export function TripTicket({ id }: { id: string }) {
  const [b, setB] = useState<TripBooking | null>(null);
  const [error, setError] = useState("");
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [cancelError, setCancelError] = useState("");

  const load = useCallback(() => {
    getTripBooking(id)
      .then(setB)
      .catch((e) =>
        setError(
          e instanceof Error ? e.message : "Could not load this booking.",
        ),
      );
  }, [id]);
  useEffect(load, [load]);

  if (error)
    return <p className="error-state mx-auto my-10 max-w-md">{error}</p>;
  if (!b)
    return (
      <p className="mx-auto my-10 max-w-md text-sm text-slate-500">Loading…</p>
    );

  const trip = b.trip;
  const pay = PAYMENT_BADGES[b.paymentStatus];
  const leaves = b.status === "confirmed" ? countdown(trip.startDate) : null;
  const paidPct =
    b.totalAmount > 0
      ? Math.min(100, Math.round((b.amountPaid / b.totalAmount) * 100))
      : 100;
  const canPay =
    (b.status === "pending" || b.status === "confirmed") && b.outstanding > 0;
  const live = isActiveBooking(b) && trip.status === "upcoming";

  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-5 px-4 py-6">
      <Link
        href="/account/trip-bookings"
        className="w-fit text-sm font-semibold text-brand-700 hover:underline dark:text-brand-300"
      >
        ← My trip bookings
      </Link>

      {/* The ticket */}
      <section className="overflow-hidden rounded-[2rem] shadow-card ring-1 ring-black/5">
        <div className="relative isolate bg-slate-950 px-5 pb-5 pt-4 text-white">
          {trip.coverImage && (
            <SafeImage
              src={resolveImageUrl(trip.coverImage)}
              alt=""
              className="absolute inset-0 -z-10 h-full w-full object-cover opacity-40"
              fallback={null}
            />
          )}
          <span
            aria-hidden
            className="absolute inset-0 -z-10 bg-gradient-to-r from-slate-950 via-slate-950/80 to-slate-950/30"
          />
          <div className="flex items-center justify-between gap-3">
            <span className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.24em] text-gold-300">
              <LoneStar className="h-3.5 w-3.5 text-white" /> Trip ticket
            </span>
            <span
              className={`rounded-full px-3 py-1 text-[11px] font-bold ${STATUS_STYLES[b.status]}`}
            >
              {TRAVELLER_STATUS_LABELS[b.status]}
            </span>
          </div>
          <h1 className="mt-3 font-display text-3xl font-black uppercase leading-none tracking-tight [overflow-wrap:anywhere]">
            {trip.title}
          </h1>
          <p className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-white/80">
            <span>{dateRange(trip.startDate, trip.endDate)}</span>
            {trip.destination && (
              <span>
                {trip.destination.name}
                {trip.destination.county ? `, ${trip.destination.county}` : ""}
              </span>
            )}
          </p>
        </div>
        <div className="relative grid gap-4 bg-[#fffaf1] px-5 py-5 sm:grid-cols-[minmax(0,1fr)_10rem] dark:bg-slate-900">
          <span
            aria-hidden
            className="absolute -top-3 left-0 h-6 w-3 rounded-r-full bg-slate-100 dark:bg-slate-950"
          />
          <span
            aria-hidden
            className="absolute -top-3 right-0 h-6 w-3 rounded-l-full bg-slate-100 dark:bg-slate-950"
          />
          <dl className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <dt className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">
                Booking
              </dt>
              <dd className="font-mono text-xl font-black tracking-widest text-slate-950 dark:text-white">
                {b.code}
              </dd>
            </div>
            <div>
              <dt className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">
                Spots
              </dt>
              <dd className="font-display text-xl font-black text-slate-950 dark:text-white">
                {b.seats}
              </dd>
            </div>
            <div className="col-span-2">
              <dt className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">
                Travellers
              </dt>
              <dd className="font-semibold text-slate-900 dark:text-slate-100">
                {b.travellers.map((t) => t.name).join(" · ")}
              </dd>
            </div>
            {(b.meetingPoint || b.departureTime) && (
              <div className="col-span-2 flex gap-2">
                <dt className="sr-only">Departure</dt>
                <MapPinIcon
                  aria-hidden
                  className="mt-0.5 h-5 w-5 shrink-0 text-brand-600"
                />
                <dd className="text-slate-700 dark:text-slate-200">
                  <span className="font-semibold text-slate-950 dark:text-white">
                    {trip.startDate ? shortDate(trip.startDate) : ""}
                    {b.departureTime ? `, ${clock(b.departureTime)}` : ""}
                  </span>
                  {b.meetingPoint && (
                    <span className="block">{b.meetingPoint}</span>
                  )}
                </dd>
              </div>
            )}
          </dl>
          <div className="flex flex-col items-center justify-center gap-1 border-t border-dashed border-slate-300 pt-4 sm:border-l sm:border-t-0 sm:pl-4 sm:pt-0 dark:border-slate-700">
            {b.qrDataUrl ? (
              <>
                {/* eslint-disable-next-line @next/next/no-img-element -- data URL from the API */}
                <img
                  src={b.qrDataUrl}
                  alt={`Ticket QR code for booking ${b.code}`}
                  className="h-36 w-36 rounded-xl bg-white p-1"
                />
                <p className="text-[11px] font-semibold text-slate-500">
                  Show this when you board
                </p>
              </>
            ) : (
              <p className="text-center text-xs text-slate-500">
                Your QR code appears here once you&apos;re confirmed.
              </p>
            )}
          </div>
        </div>
      </section>

      {leaves && (
        <p className="flex items-center justify-center gap-2 rounded-full bg-sunset-100 px-4 py-2 text-sm font-bold text-sunset-900 dark:bg-sunset-950/50 dark:text-sunset-200">
          <ClockIcon aria-hidden className="h-5 w-5" /> {leaves}
        </p>
      )}

      {b.status !== "declined" &&
        b.status !== "cancelled" &&
        b.status !== "waitlisted" && <OrderStepper steps={bookingSteps(b)} />}
      <NextStep b={b} />
      {b.hostNote && (
        <p className="rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-700 dark:border-slate-700 dark:text-slate-200">
          <span className="font-semibold">From the organiser:</span>{" "}
          {b.hostNote}
        </p>
      )}

      {b.totalAmount > 0 && (
        <section className="flex flex-col gap-3 rounded-[2rem] border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between gap-3">
            <h2 className="font-bold text-slate-950 dark:text-slate-50">
              Payment
            </h2>
            <span
              className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${pay.style}`}
            >
              {pay.label}
            </span>
          </div>
          <div className="h-2.5 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
            <div
              className="h-full rounded-full bg-emerald-500"
              style={{ width: `${paidPct}%` }}
            />
          </div>
          <p className="flex justify-between text-sm text-slate-600 dark:text-slate-300">
            <span>
              Paid{" "}
              <strong className="text-slate-950 dark:text-white">
                {money(b.amountPaid, b.currency)}
              </strong>{" "}
              of {money(b.totalAmount, b.currency)}
            </span>
            {b.outstanding > 0 && (
              <span>{money(b.outstanding, b.currency)} to go</span>
            )}
          </p>
          {b.payments.length > 0 && (
            <ul className="flex flex-col divide-y divide-slate-100 text-sm dark:divide-slate-800">
              {b.payments.map((p) => (
                <li
                  key={p.id}
                  className="flex items-center justify-between gap-3 py-2"
                >
                  <span className="min-w-0">
                    <span className="font-semibold">
                      {money(p.amount, b.currency)}
                    </span>{" "}
                    · {PAYMENT_METHOD_LABELS[p.method]}
                    {p.reference && (
                      <span className="block truncate font-mono text-xs text-slate-500">
                        {p.reference}
                      </span>
                    )}
                  </span>
                  <span
                    className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold ${
                      p.status === "received"
                        ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-200"
                        : p.status === "rejected"
                          ? "bg-red-100 text-red-800 dark:bg-red-950/50 dark:text-red-200"
                          : "bg-amber-100 text-amber-900 dark:bg-amber-950/50 dark:text-amber-200"
                    }`}
                  >
                    {PAYMENT_STATUS_TEXT[p.status]}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {canPay && <PayForm b={b} onPaid={setB} />}

      <section className="flex flex-col gap-3 rounded-[2rem] border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
        <h2 className="font-bold text-slate-950 dark:text-slate-50">
          The organiser
        </h2>
        {b.contactPhone ? (
          <div className="flex flex-wrap gap-2">
            <a
              href={telLink(b.contactPhone)}
              className="flex min-h-10 items-center gap-1.5 rounded-full border border-slate-300 px-4 text-sm font-semibold dark:border-slate-600"
            >
              <PhoneIcon aria-hidden className="h-4 w-4" /> Call
            </a>
            <a
              href={whatsappLink(
                b.contactPhone,
                `Hi! About my booking ${b.code} on "${trip.title}"`,
              )}
              target="_blank"
              rel="noreferrer"
              className="flex min-h-10 items-center gap-1.5 rounded-full bg-[#25D366] px-4 text-sm font-semibold text-white"
            >
              <ChatBubbleOvalLeftEllipsisIcon aria-hidden className="h-4 w-4" />{" "}
              WhatsApp
            </a>
          </div>
        ) : (
          <p className="text-sm text-slate-500">
            The organiser hasn&apos;t shared a phone number.
          </p>
        )}
        <Link
          href={`/trips/${trip.id}`}
          className="flex items-center gap-1 text-sm font-bold text-brand-700 hover:underline dark:text-brand-300"
        >
          {b.status === "confirmed"
            ? "Open the trip plan and group chat"
            : "See the trip"}{" "}
          <ArrowRightIcon aria-hidden className="h-4 w-4" />
        </Link>
      </section>

      {live && (
        <button
          type="button"
          onClick={() => setConfirmCancel(true)}
          className="self-center text-sm font-semibold text-flag-700 hover:underline dark:text-flag-300"
        >
          Cancel my booking
        </button>
      )}
      <ConfirmDialog
        open={confirmCancel}
        title="Cancel this booking?"
        description={
          b.amountPaid > 0
            ? `Your ${b.seats === 1 ? "spot" : "spots"} will be given up. Ask the organiser about refunding the ${money(b.amountPaid, b.currency)} you paid.`
            : `Your ${b.seats === 1 ? "spot" : "spots"} will be given up for someone else.`
        }
        confirmLabel="Cancel booking"
        cancelLabel="Keep it"
        loadingLabel="Cancelling…"
        isLoading={cancelling}
        error={cancelError || null}
        onCancel={() => setConfirmCancel(false)}
        onConfirm={async () => {
          setCancelling(true);
          setCancelError("");
          try {
            setB(await cancelTripBooking(b.id));
            setConfirmCancel(false);
          } catch (e) {
            setCancelError(
              e instanceof Error ? e.message : "Could not cancel.",
            );
          } finally {
            setCancelling(false);
          }
        }}
      />
    </main>
  );
}
