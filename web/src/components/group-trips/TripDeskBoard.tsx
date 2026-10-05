"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowTopRightOnSquareIcon,
  ChatBubbleOvalLeftEllipsisIcon,
  CheckCircleIcon,
  ClipboardDocumentListIcon,
  PhoneIcon,
} from "@heroicons/react/24/outline";
import { RxScanner } from "@/components/prescriptions/RxScanner";
import {
  boardTripBooking,
  cancelTripBooking,
  confirmTripBooking,
  declineTripBooking,
  getTripDesk,
  markTripRefunded,
  payTripBooking,
  promoteTripBooking,
  reviewTripPayment,
  type TripBooking,
  type TripDesk,
  type TripPaymentMethod,
} from "@/lib/group-trips-api";
import {
  HOST_STATUS_LABELS,
  PAYMENT_BADGES,
  PAYMENT_METHOD_LABELS,
  STATUS_STYLES,
  countdown,
  dateRange,
  fillPercent,
  money,
  telLink,
  whatsappLink,
} from "@/lib/group-trips";
import type { TripHosting } from "@/lib/types";
import { HostingEditor } from "./HostingEditor";

type Tab = "bookings" | "rollcall" | "setup";

function Stat({
  label,
  value,
  sub,
  tone = "plain",
}: {
  label: string;
  value: string;
  sub?: React.ReactNode;
  tone?: "plain" | "alert";
}) {
  return (
    <div
      className={`flex flex-col gap-1 rounded-3xl p-4 ${
        tone === "alert"
          ? "bg-amber-100 text-amber-950 dark:bg-amber-950/50 dark:text-amber-100"
          : "bg-white shadow-card dark:bg-slate-900"
      }`}
    >
      <span className="text-[11px] font-bold uppercase tracking-[0.14em] opacity-70">
        {label}
      </span>
      <span className="font-display text-2xl font-black tabular-nums">
        {value}
      </span>
      {sub}
    </div>
  );
}

/** One booking on the desk: who, how many, money, and what to do next. */
function BookingCard({
  b,
  open,
  onToggle,
  onChanged,
  spotsLeft,
}: {
  b: TripBooking;
  open: boolean;
  onToggle: () => void;
  onChanged: () => void;
  spotsLeft: number;
}) {
  const [note, setNote] = useState("");
  const [cashAmount, setCashAmount] = useState(String(b.outstanding || ""));
  const [cashMethod, setCashMethod] = useState<TripPaymentMethod>("cash");
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const pay = PAYMENT_BADGES[b.paymentStatus];
  const awaiting = b.payments.filter(
    (p) => p.status === "awaiting_verification",
  );

  async function act(key: string, fn: () => Promise<unknown>) {
    setBusy(key);
    setError("");
    try {
      await fn();
      onChanged();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setBusy("");
    }
  }

  const btn =
    "min-h-10 rounded-full px-4 text-sm font-bold disabled:opacity-50";
  return (
    <li
      id={`booking-${b.id}`}
      className="scroll-mt-24 overflow-hidden rounded-3xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900"
    >
      <button
        type="button"
        aria-expanded={open}
        onClick={onToggle}
        className="flex w-full items-start justify-between gap-3 p-4 text-start"
      >
        <span className="min-w-0">
          <span className="block truncate font-semibold text-slate-950 dark:text-slate-50">
            {b.contactName}
            {b.seats > 1 && (
              <span className="font-normal text-slate-500">
                {" "}
                +{b.seats - 1}
              </span>
            )}
          </span>
          <span className="block text-xs text-slate-500 dark:text-slate-400">
            #{b.code} · {b.seats} {b.seats === 1 ? "spot" : "spots"}
            {b.totalAmount > 0 &&
              ` · ${money(b.amountPaid, b.currency)} of ${money(b.totalAmount, b.currency)}`}
          </span>
        </span>
        <span className="flex shrink-0 flex-col items-end gap-1">
          <span
            className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${STATUS_STYLES[b.status]}`}
          >
            {HOST_STATUS_LABELS[b.status]}
          </span>
          {b.paymentStatus !== "free" && (
            <span
              className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${pay.style}`}
            >
              {pay.label}
            </span>
          )}
        </span>
      </button>

      {open && (
        <div className="flex flex-col gap-4 border-t border-slate-100 p-4 dark:border-slate-800">
          <div className="flex flex-wrap gap-2">
            <a
              href={telLink(b.phone)}
              className="flex min-h-10 items-center gap-1.5 rounded-full border border-slate-300 px-3 text-sm font-semibold dark:border-slate-600"
            >
              <PhoneIcon aria-hidden className="h-4 w-4" /> {b.phone}
            </a>
            <a
              href={whatsappLink(
                b.phone,
                `Hi ${b.contactName.split(" ")[0]}, about your booking ${b.code} on "${b.trip.title}"`,
              )}
              target="_blank"
              rel="noreferrer"
              className="flex min-h-10 items-center gap-1.5 rounded-full bg-[#25D366] px-3 text-sm font-semibold text-white"
            >
              <ChatBubbleOvalLeftEllipsisIcon aria-hidden className="h-4 w-4" />{" "}
              WhatsApp
            </a>
          </div>
          <div className="text-sm">
            <p className="font-semibold text-slate-900 dark:text-slate-100">
              Travellers
            </p>
            <ol className="mt-1 list-decimal ps-5 text-slate-700 dark:text-slate-200">
              {b.travellers.map((t, i) => (
                <li key={i}>
                  {t.name}{" "}
                  {t.boarded && (
                    <span className="text-xs font-semibold text-emerald-700">
                      · on board
                    </span>
                  )}
                </li>
              ))}
            </ol>
            {b.notes && (
              <p className="mt-2 rounded-2xl bg-slate-50 px-3 py-2 text-slate-700 dark:bg-slate-800 dark:text-slate-200">
                “{b.notes}”
              </p>
            )}
          </div>

          {b.payments.length > 0 && (
            <ul className="flex flex-col gap-2 text-sm">
              {b.payments.map((p) => (
                <li
                  key={p.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-2xl bg-slate-50 px-3 py-2 dark:bg-slate-800/60"
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
                    {p.account && (
                      <span className="block text-xs text-slate-500">
                        to {p.account}
                      </span>
                    )}
                  </span>
                  {p.status === "awaiting_verification" ? (
                    <span className="flex gap-2">
                      <button
                        type="button"
                        disabled={Boolean(busy)}
                        onClick={() =>
                          act(`ok-${p.id}`, () =>
                            reviewTripPayment(b.id, p.id, true),
                          )
                        }
                        className={`${btn} bg-emerald-600 text-white hover:bg-emerald-700`}
                      >
                        Received
                      </button>
                      <button
                        type="button"
                        disabled={Boolean(busy)}
                        onClick={() =>
                          act(`no-${p.id}`, () =>
                            reviewTripPayment(b.id, p.id, false),
                          )
                        }
                        className={`${btn} border border-slate-300 dark:border-slate-600`}
                      >
                        Not found
                      </button>
                    </span>
                  ) : (
                    <span
                      className={`text-xs font-semibold ${p.status === "received" ? "text-emerald-700 dark:text-emerald-300" : "text-red-700 dark:text-red-300"}`}
                    >
                      {p.status === "received"
                        ? p.recordedByHost
                          ? "Recorded by you"
                          : "Received"
                        : "Not found"}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          )}

          {(b.status === "pending" || b.status === "confirmed") &&
            b.outstanding > 0 && (
              <div className="flex flex-col gap-2 rounded-2xl border border-dashed border-slate-300 p-3 dark:border-slate-600">
                <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                  Record money you received
                </p>
                <div className="flex flex-wrap gap-2">
                  <input
                    type="number"
                    inputMode="decimal"
                    aria-label="Amount received"
                    value={cashAmount}
                    onChange={(e) => setCashAmount(e.target.value)}
                    className="input w-28"
                  />
                  <select
                    aria-label="Paid by"
                    value={cashMethod}
                    onChange={(e) =>
                      setCashMethod(e.target.value as TripPaymentMethod)
                    }
                    className="input w-40"
                  >
                    <option value="cash">Cash</option>
                    <option value="mtn_momo">MTN MoMo</option>
                    <option value="orange_money">Orange Money</option>
                  </select>
                  <button
                    type="button"
                    disabled={Boolean(busy) || !(Number(cashAmount) > 0)}
                    onClick={() =>
                      act("cash", () =>
                        payTripBooking(b.id, {
                          amount: Number(cashAmount),
                          method: cashMethod,
                        }),
                      )
                    }
                    className={`${btn} bg-brand-700 text-white hover:bg-brand-800`}
                  >
                    Record{" "}
                    {Number(cashAmount) > 0
                      ? money(Number(cashAmount), b.currency)
                      : ""}
                  </button>
                </div>
                <p className="text-xs text-slate-500">
                  {money(b.outstanding, b.currency)} still owed.
                </p>
              </div>
            )}

          {(b.status === "pending" ||
            b.status === "waitlisted" ||
            b.status === "confirmed") && (
            <label className="text-sm font-medium text-slate-700 dark:text-slate-200">
              Message to {b.contactName.split(" ")[0]} (optional)
              <input
                value={note}
                onChange={(e) => setNote(e.target.value)}
                maxLength={500}
                placeholder="e.g. See you at the gate at 6:30am!"
                className="input mt-1 w-full"
              />
            </label>
          )}

          <div className="flex flex-wrap gap-2">
            {b.status === "pending" && (
              <button
                type="button"
                disabled={Boolean(busy)}
                onClick={() =>
                  act("confirm", () =>
                    confirmTripBooking(b.id, note || undefined),
                  )
                }
                className={`${btn} bg-brand-700 text-white hover:bg-brand-800`}
              >
                {awaiting.length ? "Confirm anyway" : "Confirm"}
              </button>
            )}
            {b.status === "waitlisted" && (
              <button
                type="button"
                disabled={Boolean(busy) || b.seats > spotsLeft}
                onClick={() => act("promote", () => promoteTripBooking(b.id))}
                className={`${btn} bg-brand-700 text-white hover:bg-brand-800`}
                title={
                  b.seats > spotsLeft ? "Not enough free spots yet" : undefined
                }
              >
                Give {b.seats === 1 ? "a spot" : `${b.seats} spots`}
              </button>
            )}
            {(b.status === "pending" || b.status === "waitlisted") && (
              <button
                type="button"
                disabled={Boolean(busy)}
                onClick={() =>
                  act("decline", () =>
                    declineTripBooking(b.id, note || undefined),
                  )
                }
                className={`${btn} border border-slate-300 dark:border-slate-600`}
              >
                Decline
              </button>
            )}
            {b.status === "confirmed" && (
              <button
                type="button"
                disabled={Boolean(busy)}
                onClick={() => {
                  if (
                    window.confirm(
                      `Cancel ${b.contactName}'s booking and free ${b.seats === 1 ? "the spot" : "the spots"}?`,
                    )
                  )
                    void act("cancel", () =>
                      cancelTripBooking(b.id, note || undefined),
                    );
                }}
                className={`${btn} border border-flag-300 text-flag-700 dark:border-flag-700 dark:text-flag-300`}
              >
                Cancel booking
              </button>
            )}
            {b.paymentStatus === "refund_due" && (
              <button
                type="button"
                disabled={Boolean(busy)}
                onClick={() => act("refund", () => markTripRefunded(b.id))}
                className={`${btn} bg-slate-900 text-white dark:bg-white dark:text-slate-900`}
              >
                Mark {money(b.amountPaid, b.currency)} refunded
              </button>
            )}
          </div>
          {error && (
            <p
              role="alert"
              className="text-sm text-flag-700 dark:text-flag-300"
            >
              {error}
            </p>
          )}
        </div>
      )}
    </li>
  );
}

/** Departure day: tick everyone onto the bus, by name or by scanning tickets. */
function RollCall({
  desk,
  onChanged,
}: {
  desk: TripDesk;
  onChanged: () => void;
}) {
  const [code, setCode] = useState("");
  const [found, setFound] = useState<TripBooking | null>(null);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const confirmed = desk.bookings.filter((b) => b.status === "confirmed");
  const rows = confirmed
    .flatMap((b) => b.travellers.map((t, i) => ({ b, t, i })))
    .sort((x, y) => x.t.name.localeCompare(y.t.name));
  const onBoard = rows.filter((r) => r.t.boarded).length;

  function lookup(raw: string) {
    const clean = raw
      .toUpperCase()
      .replace(/[^0-9A-Z]/g, "")
      .replace(/^LIB360TRIP/, "");
    const b = desk.bookings.find((x) => x.code === clean) ?? null;
    setFound(b);
    setMessage(
      !b
        ? `No booking ${clean} on this trip.`
        : b.status !== "confirmed"
          ? `${b.contactName}'s booking is ${HOST_STATUS_LABELS[b.status].toLowerCase()} — not confirmed.`
          : b.outstanding > 0
            ? `${b.contactName} still owes ${money(b.outstanding, b.currency)}.`
            : "",
    );
  }

  async function board(b: TripBooking, boarded: boolean, traveller?: number) {
    setBusy(true);
    try {
      await boardTripBooking(b.id, { boarded, traveller });
      onChanged();
      if (found?.id === b.id) setFound(null);
    } finally {
      setBusy(false);
    }
  }

  const manifest = rows
    .map((r, n) => `${n + 1}. ${r.t.name} — ${r.b.phone} (#${r.b.code})`)
    .join("\n");

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 rounded-[2rem] bg-slate-950 p-5 text-white">
        <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-gold-300">
          Roll call
        </p>
        <p className="font-display text-4xl font-black tabular-nums">
          {onBoard}{" "}
          <span className="text-xl text-white/60">
            of {rows.length} on board
          </span>
        </p>
        <div className="h-2 overflow-hidden rounded-full bg-white/20">
          <div
            className="h-full rounded-full bg-emerald-400"
            style={{
              width: `${rows.length ? (onBoard / rows.length) * 100 : 0}%`,
            }}
          />
        </div>
      </div>

      <div className="flex flex-col gap-3 rounded-[2rem] border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
        <p className="font-bold text-slate-950 dark:text-slate-50">
          Scan a ticket or type the code
        </p>
        <RxScanner
          onCode={lookup}
          unavailableMessage="The camera isn't available. Type the code from the ticket instead."
        />
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            lookup(code);
          }}
        >
          <input
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="Booking code, e.g. HEFCN3"
            aria-label="Booking code"
            className="input flex-1 font-mono uppercase"
          />
          <button
            type="submit"
            className="min-h-11 rounded-full border border-slate-300 px-4 text-sm font-bold dark:border-slate-600"
          >
            Find
          </button>
        </form>
        {message && (
          <p className="rounded-2xl bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:bg-amber-950/40 dark:text-amber-100">
            {message}
          </p>
        )}
        {found?.status === "confirmed" && (
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl bg-emerald-50 px-3 py-3 dark:bg-emerald-950/40">
            <span className="text-sm font-semibold text-emerald-900 dark:text-emerald-100">
              #{found.code} · {found.travellers.map((t) => t.name).join(", ")}
            </span>
            <button
              type="button"
              disabled={busy}
              onClick={() => void board(found, true)}
              className="flex min-h-10 items-center gap-1.5 rounded-full bg-emerald-600 px-4 text-sm font-bold text-white"
            >
              <CheckCircleIcon aria-hidden className="h-5 w-5" /> Board{" "}
              {found.seats === 1 ? "" : `all ${found.seats}`}
            </button>
          </div>
        )}
      </div>

      <div className="flex flex-col gap-2 rounded-[2rem] border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="font-bold text-slate-950 dark:text-slate-50">
            Passenger list
          </p>
          <button
            type="button"
            onClick={() =>
              void navigator.clipboard?.writeText(
                `${desk.trip.title} — passengers\n${manifest}`,
              )
            }
            className="flex min-h-9 items-center gap-1.5 rounded-full border border-slate-300 px-3 text-xs font-semibold dark:border-slate-600"
          >
            <ClipboardDocumentListIcon aria-hidden className="h-4 w-4" /> Copy
            list
          </button>
        </div>
        {rows.length === 0 ? (
          <p className="text-sm text-slate-500">
            Confirmed travellers will appear here.
          </p>
        ) : (
          <ul className="flex flex-col divide-y divide-slate-100 dark:divide-slate-800">
            {rows.map(({ b, t, i }) => (
              <li key={`${b.id}-${i}`}>
                <label className="flex min-h-12 cursor-pointer items-center gap-3 py-2">
                  <input
                    type="checkbox"
                    checked={t.boarded}
                    disabled={busy}
                    onChange={(e) => void board(b, e.target.checked, i)}
                    className="h-6 w-6 accent-emerald-600"
                  />
                  <span className="min-w-0 flex-1">
                    <span
                      className={`block truncate font-semibold ${t.boarded ? "text-emerald-800 dark:text-emerald-300" : "text-slate-900 dark:text-slate-100"}`}
                    >
                      {t.name}
                    </span>
                    <span className="block text-xs text-slate-500">
                      #{b.code}
                      {b.outstanding > 0 && (
                        <span className="font-semibold text-flag-700 dark:text-flag-300">
                          {" "}
                          · owes {money(b.outstanding, b.currency)}
                        </span>
                      )}
                    </span>
                  </span>
                </label>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

/**
 * The organiser's desk for one trip — the same idea as a restaurant's
 * order board: spots and money at a glance, payments waiting to be
 * checked first, then each booking with the next thing to do, a roll
 * call for departure day, and the trip's setup.
 */
export function TripDeskBoard({
  tripId,
  focusBooking,
}: {
  tripId: string;
  focusBooking?: string | null;
}) {
  const [desk, setDesk] = useState<TripDesk | null>(null);
  const [error, setError] = useState("");
  const [tab, setTab] = useState<Tab>("bookings");
  const [openId, setOpenId] = useState<string | null>(focusBooking ?? null);
  const [showClosed, setShowClosed] = useState(false);

  const load = useCallback(() => {
    getTripDesk(tripId)
      .then((d) => {
        setDesk(d);
        if (!d.hosting) setTab("setup");
      })
      .catch((e) =>
        setError(
          e instanceof Error ? e.message : "Could not load the trip desk.",
        ),
      );
  }, [tripId]);
  useEffect(load, [load]);
  useEffect(() => {
    if (desk && focusBooking)
      document
        .getElementById(`booking-${focusBooking}`)
        ?.scrollIntoView?.({ block: "center" });
  }, [desk, focusBooking]);

  const groups = useMemo(() => {
    const list = desk?.bookings ?? [];
    const toCheck = list.filter(
      (b) =>
        b.payments.some((p) => p.status === "awaiting_verification") &&
        b.status !== "cancelled" &&
        b.status !== "declined",
    );
    const ids = new Set(toCheck.map((b) => b.id));
    return [
      { key: "check", title: "Payments to check", list: toCheck },
      {
        key: "confirm",
        title: "To confirm",
        list: list.filter((b) => b.status === "pending" && !ids.has(b.id)),
      },
      {
        key: "waitlist",
        title: "Waitlist",
        list: list.filter((b) => b.status === "waitlisted").reverse(),
      },
      {
        key: "going",
        title: "Going",
        list: list.filter((b) => b.status === "confirmed" && !ids.has(b.id)),
      },
      {
        key: "refunds",
        title: "Refunds due",
        list: list.filter((b) => b.paymentStatus === "refund_due"),
      },
    ];
  }, [desk]);

  if (error)
    return <p className="error-state mx-auto my-10 max-w-md">{error}</p>;
  if (!desk)
    return (
      <p className="mx-auto my-10 max-w-md text-sm text-slate-500">Loading…</p>
    );

  const h = desk.hosting;
  const closed = desk.bookings.filter(
    (b) =>
      (b.status === "cancelled" || b.status === "declined") &&
      b.paymentStatus !== "refund_due",
  );
  const leaves = countdown(desk.trip.startDate);
  const tabs: Array<{ key: Tab; label: string }> = h
    ? [
        {
          key: "bookings",
          label: `Bookings · ${desk.bookings.filter((b) => b.status !== "cancelled" && b.status !== "declined").length}`,
        },
        { key: "rollcall", label: "Roll call" },
        { key: "setup", label: "Setup" },
      ]
    : [{ key: "setup", label: "Set up bookings" }];

  return (
    <main className="mx-auto flex max-w-4xl flex-col gap-5 px-4 py-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <Link
            href={`/trips/${tripId}`}
            className="text-sm font-semibold text-brand-700 hover:underline dark:text-brand-300"
          >
            ← Trip plan
          </Link>
          <p className="mt-2 text-xs font-bold uppercase tracking-[0.2em] text-brand-700 dark:text-brand-300">
            Trip desk
          </p>
          <h1 className="font-display text-3xl font-black text-slate-950 [overflow-wrap:anywhere] dark:text-slate-50">
            {desk.trip.title}
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {dateRange(desk.trip.startDate, desk.trip.endDate)}
            {leaves ? ` · ${leaves}` : ""}
            {h && !h.open ? " · Bookings closed" : ""}
          </p>
        </div>
        {h && (
          <Link
            href={`/trips/${tripId}?view=public`}
            className="flex min-h-10 items-center gap-1.5 rounded-full border border-slate-300 px-4 text-sm font-semibold dark:border-slate-600"
          >
            <ArrowTopRightOnSquareIcon aria-hidden className="h-4 w-4" /> See
            the trip page
          </Link>
        )}
      </div>

      {h && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat
            label="Spots booked"
            value={`${h.spots - h.spotsLeft}/${h.spots}`}
            sub={
              <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
                <div
                  className="h-full rounded-full bg-brand-500"
                  style={{ width: `${fillPercent(h)}%` }}
                />
              </div>
            }
          />
          <Stat
            label="Collected"
            value={h.isFree ? "Free" : money(desk.stats.collected, h.currency)}
          />
          <Stat
            label="Still owed"
            value={h.isFree ? "—" : money(desk.stats.outstanding, h.currency)}
          />
          <Stat
            label="To check"
            value={String(desk.stats.paymentsToCheck + groups[1].list.length)}
            sub={
              <span className="text-xs">
                {desk.stats.paymentsToCheck}{" "}
                {desk.stats.paymentsToCheck === 1 ? "payment" : "payments"} ·{" "}
                {groups[1].list.length}{" "}
                {groups[1].list.length === 1 ? "booking" : "bookings"}
              </span>
            }
            tone={
              desk.stats.paymentsToCheck + groups[1].list.length > 0
                ? "alert"
                : "plain"
            }
          />
        </div>
      )}

      <div
        role="tablist"
        aria-label="Trip desk"
        className="flex gap-1 overflow-x-auto rounded-full bg-slate-100 p-1 dark:bg-slate-800"
      >
        {tabs.map((t) => (
          <button
            key={t.key}
            role="tab"
            type="button"
            aria-selected={tab === t.key}
            onClick={() => setTab(t.key)}
            className={`min-h-10 flex-1 whitespace-nowrap rounded-full px-4 text-sm font-bold ${
              tab === t.key
                ? "bg-white text-slate-950 shadow dark:bg-slate-950 dark:text-white"
                : "text-slate-600 dark:text-slate-300"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "bookings" && h && (
        <div className="flex flex-col gap-5">
          {desk.bookings.length === 0 && (
            <div className="rounded-[2rem] border border-dashed border-slate-300 p-6 text-center dark:border-slate-700">
              <p className="font-semibold text-slate-900 dark:text-slate-100">
                No bookings yet
              </p>
              <p className="mt-1 text-sm text-slate-500">
                Share your trip page on WhatsApp, Facebook and Instagram to fill
                your spots.
              </p>
            </div>
          )}
          {groups
            .filter((g) => g.list.length > 0)
            .map((g) => (
              <section key={g.key} className="flex flex-col gap-2">
                <h2 className="text-sm font-bold uppercase tracking-[0.14em] text-slate-500">
                  {g.title} · {g.list.length}
                </h2>
                <ul className="flex flex-col gap-2">
                  {g.list.map((b) => (
                    <BookingCard
                      key={b.id}
                      b={b}
                      open={openId === b.id}
                      onToggle={() =>
                        setOpenId((v) => (v === b.id ? null : b.id))
                      }
                      onChanged={load}
                      spotsLeft={h.spotsLeft}
                    />
                  ))}
                </ul>
              </section>
            ))}
          {closed.length > 0 && (
            <section className="flex flex-col gap-2">
              <button
                type="button"
                onClick={() => setShowClosed((v) => !v)}
                className="w-fit text-sm font-bold uppercase tracking-[0.14em] text-slate-500"
              >
                {showClosed ? "▾" : "▸"} Cancelled and declined ·{" "}
                {closed.length}
              </button>
              {showClosed && (
                <ul className="flex flex-col gap-2">
                  {closed.map((b) => (
                    <BookingCard
                      key={b.id}
                      b={b}
                      open={openId === b.id}
                      onToggle={() =>
                        setOpenId((v) => (v === b.id ? null : b.id))
                      }
                      onChanged={load}
                      spotsLeft={h.spotsLeft}
                    />
                  ))}
                </ul>
              )}
            </section>
          )}
        </div>
      )}

      {tab === "rollcall" && h && <RollCall desk={desk} onChanged={load} />}

      {tab === "setup" && (
        <div className="flex flex-col gap-3">
          {!h && (
            <div className="rounded-[2rem] bg-slate-950 p-5 text-white">
              <p className="font-display text-2xl font-black">
                Host this as a group trip
              </p>
              <p className="mt-1 text-sm text-white/75">
                Free or paid, you set the spots and what&apos;s included.
                Travellers book and pay with cash, MTN MoMo or Orange Money, get
                a ticket, and join the trip&apos;s group chat. You follow every
                booking and payment from here.
              </p>
            </div>
          )}
          <HostingEditor
            tripId={tripId}
            startDate={desk.trip.startDate}
            hosting={h}
            coverImage={desk.trip.coverImage}
            onSaved={(next: TripHosting) => {
              setDesk((d) => (d ? { ...d, hosting: next } : d));
              load();
            }}
          />
        </div>
      )}
    </main>
  );
}
