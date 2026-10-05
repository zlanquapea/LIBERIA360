"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  BanknotesIcon,
  MinusIcon,
  PlusIcon,
} from "@heroicons/react/24/outline";
import { MenuSheet } from "@/components/menu/MenuSheet";
import { ChoiceCard, CopyButton } from "@/components/menu/CartSheet";
import { useAuth } from "@/hooks/useAuth";
import {
  bookTrip,
  type TripPaymentMethod,
  type TripPaymentPlan,
} from "@/lib/group-trips-api";
import {
  PAYMENT_METHOD_LABELS,
  dueNow,
  money,
  shortDate,
} from "@/lib/group-trips";
import type { TripHosting } from "@/lib/types";

export const METHOD_ICON: Record<TripPaymentMethod, React.ReactNode> = {
  cash: <BanknotesIcon className="h-5 w-5" />,
  mtn_momo: <span className="block h-4 w-4 rounded-full bg-yellow-400" />,
  orange_money: <span className="block h-4 w-4 rounded-full bg-orange-500" />,
};

/**
 * Book spots on an organised trip: how many, everyone's name, then pay
 * the way people pay in Liberia — cash to the organiser, MTN MoMo or
 * Orange Money — in full or with the organiser's deposit. When the trip
 * is full the same sheet puts you on the waitlist instead, with nothing
 * to pay.
 */
export function BookSpotSheet({
  open,
  onClose,
  tripId,
  tripTitle,
  hosting,
}: {
  open: boolean;
  onClose: () => void;
  tripId: string;
  tripTitle: string;
  hosting: TripHosting;
}) {
  const { user } = useAuth();
  const router = useRouter();
  const waitlist = hosting.spotsLeft <= 0;
  const maxSeats = Math.max(
    1,
    waitlist
      ? hosting.maxPerBooking
      : Math.min(hosting.maxPerBooking, hosting.spotsLeft),
  );
  const [seats, setSeats] = useState(1);
  const [names, setNames] = useState<string[]>([""]);
  const [phone, setPhone] = useState("");
  const [notes, setNotes] = useState("");
  const [plan, setPlan] = useState<TripPaymentPlan>(
    hosting.depositAmount != null ? "deposit" : "full",
  );
  const [method, setMethod] = useState<TripPaymentMethod>(
    hosting.paymentOptions[0]?.method ?? "cash",
  );
  const [reference, setReference] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!user) return;
    setNames((list) => (list[0] ? list : [user.name ?? "", ...list.slice(1)]));
    setPhone((v) => v || (user as { phone?: string | null }).phone || "");
  }, [user]);

  function changeSeats(next: number) {
    const n = Math.min(maxSeats, Math.max(1, next));
    setSeats(n);
    setNames((list) => Array.from({ length: n }, (_, i) => list[i] ?? ""));
  }

  const paid = !hosting.isFree && !waitlist;
  const total = Math.round(hosting.price * seats * 100) / 100;
  const now = paid ? dueNow(hosting, seats, plan) : 0;
  const later = Math.round((total - now) * 100) / 100;
  const option = hosting.paymentOptions.find((o) => o.method === method);
  const mobile = paid && method !== "cash";

  const problem = useMemo(() => {
    if (names.some((n) => !n.trim()))
      return "Add a name for everyone travelling";
    if (phone.replace(/\D/g, "").length < 7)
      return "Add a phone number the organiser can reach you on";
    if (mobile && !reference.trim())
      return "Enter the transaction ID from your SMS";
    return "";
  }, [names, phone, mobile, reference]);

  async function submit() {
    if (problem) {
      setError(problem);
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      const booking = await bookTrip(tripId, {
        seats,
        travellers: names.map((n) => n.trim()),
        contactName: names[0].trim(),
        phone: phone.trim(),
        notes: notes.trim() || undefined,
        ...(paid
          ? {
              paymentPlan: plan,
              paymentMethod: method,
              paymentReference: mobile ? reference.trim() : undefined,
            }
          : {}),
        ...(waitlist ? { joinWaitlist: true } : {}),
      });
      router.push(`/account/trip-bookings/${booking.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not book. Try again.");
      setSubmitting(false);
    }
  }

  const spotsWord = `${seats} ${seats === 1 ? "spot" : "spots"}`;
  const cta = waitlist
    ? `Join the waitlist · ${spotsWord}`
    : hosting.isFree
      ? `Book ${spotsWord} · Free`
      : `Book ${spotsWord} · ${money(now, hosting.currency)}${method === "cash" ? " in cash" : " now"}`;

  const footer = (
    <div className="flex flex-col gap-2 px-5 py-4">
      {error && (
        <p
          role="alert"
          className="text-sm font-medium text-flag-700 dark:text-flag-300"
        >
          {error}
        </p>
      )}
      <button
        type="button"
        onClick={() => void submit()}
        disabled={submitting}
        className="min-h-12 rounded-full bg-brand-700 px-5 text-sm font-bold text-white shadow-lg shadow-brand-700/25 hover:bg-brand-800 disabled:opacity-60"
      >
        {submitting ? "Booking…" : cta}
      </button>
    </div>
  );

  return (
    <MenuSheet
      open={open}
      onClose={onClose}
      label={waitlist ? "Join the waitlist" : "Secure your spot"}
      footer={footer}
    >
      <div className="flex flex-col gap-5 px-5 pb-5 pt-6">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-brand-700 dark:text-brand-300">
            {waitlist ? "Fully booked — join the waitlist" : "Secure your spot"}
          </p>
          <h2 className="mt-1 font-display text-2xl font-bold text-slate-950 dark:text-slate-50">
            {tripTitle}
          </h2>
          {waitlist && (
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
              Nothing to pay now. If a spot opens up, the organiser can give it
              to you and you&apos;ll be told straight away.
            </p>
          )}
        </div>

        <div className="flex items-center justify-between gap-3 rounded-3xl bg-slate-50 p-4 dark:bg-slate-800/60">
          <div>
            <p className="font-semibold text-slate-950 dark:text-slate-50">
              How many spots?
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {hosting.isFree
                ? "Free"
                : `${money(hosting.price, hosting.currency)} per person`}{" "}
              · up to {maxSeats}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              aria-label="One spot fewer"
              disabled={seats <= 1}
              onClick={() => changeSeats(seats - 1)}
              className="flex h-10 w-10 items-center justify-center rounded-full border border-slate-300 bg-white disabled:opacity-40 dark:border-slate-600 dark:bg-slate-900"
            >
              <MinusIcon aria-hidden className="h-5 w-5" />
            </button>
            <span
              aria-live="polite"
              className="w-8 text-center font-display text-2xl font-black tabular-nums"
            >
              {seats}
            </span>
            <button
              type="button"
              aria-label="One spot more"
              disabled={seats >= maxSeats}
              onClick={() => changeSeats(seats + 1)}
              className="flex h-10 w-10 items-center justify-center rounded-full border border-slate-300 bg-white disabled:opacity-40 dark:border-slate-600 dark:bg-slate-900"
            >
              <PlusIcon aria-hidden className="h-5 w-5" />
            </button>
          </div>
        </div>

        <fieldset className="grid gap-3">
          <legend className="mb-2 text-sm font-bold text-slate-900 dark:text-slate-50">
            Who&apos;s travelling
          </legend>
          {names.map((name, i) => (
            <label
              key={i}
              className="text-sm font-medium text-slate-700 dark:text-slate-200"
            >
              {i === 0 ? "Your full name" : `Traveller ${i + 1}`}
              <input
                value={name}
                onChange={(e) =>
                  setNames((list) =>
                    list.map((n, j) => (j === i ? e.target.value : n)),
                  )
                }
                autoComplete={i === 0 ? "name" : "off"}
                maxLength={120}
                placeholder={i === 0 ? "" : "Name as on their ID"}
                className="input mt-1 w-full"
              />
            </label>
          ))}
          <label className="text-sm font-medium text-slate-700 dark:text-slate-200">
            Phone (WhatsApp if you have it)
            <input
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="0886 123 456"
              className="input mt-1 w-full"
            />
          </label>
          <label className="text-sm font-medium text-slate-700 dark:text-slate-200">
            Anything the organiser should know (optional)
            <textarea
              rows={2}
              maxLength={1000}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Food allergy, sharing a room with a friend, joining from Kakata…"
              className="input mt-1 w-full"
            />
          </label>
        </fieldset>

        {paid && hosting.depositAmount != null && (
          <fieldset className="flex flex-col gap-2">
            <legend className="mb-2 text-sm font-bold text-slate-900 dark:text-slate-50">
              Pay now or hold your spot
            </legend>
            <ChoiceCard
              name="trip-plan"
              checked={plan === "deposit"}
              onSelect={() => setPlan("deposit")}
              icon={<span className="text-lg">🎟️</span>}
              title={`Pay the deposit · ${money(dueNow(hosting, seats, "deposit"), hosting.currency)}`}
              detail={`Then ${money(total - dueNow(hosting, seats, "deposit"), hosting.currency)}${hosting.balanceDueDate ? ` by ${shortDate(hosting.balanceDueDate)}` : " before the trip"}`}
            />
            <ChoiceCard
              name="trip-plan"
              checked={plan === "full"}
              onSelect={() => setPlan("full")}
              icon={<span className="text-lg">✅</span>}
              title={`Pay in full · ${money(total, hosting.currency)}`}
              detail="Nothing more to pay later"
            />
          </fieldset>
        )}

        {paid && (
          <fieldset className="flex flex-col gap-2">
            <legend className="mb-2 text-sm font-bold text-slate-900 dark:text-slate-50">
              How you&apos;ll pay
            </legend>
            {hosting.paymentOptions.map((o) => (
              <ChoiceCard
                key={o.method}
                name="trip-payment"
                checked={method === o.method}
                onSelect={() => setMethod(o.method)}
                icon={METHOD_ICON[o.method]}
                title={PAYMENT_METHOD_LABELS[o.method]}
                detail={
                  o.method === "cash"
                    ? "Hand it to the organiser — your spot is held until they confirm"
                    : "Send it now; the organiser checks it and confirms"
                }
              />
            ))}
          </fieldset>
        )}

        {mobile && option?.account && (
          <div className="flex flex-col gap-3 rounded-3xl bg-slate-50 p-4 dark:bg-slate-800/60">
            <p className="text-sm text-slate-700 dark:text-slate-200">
              1. Send <strong>{money(now, hosting.currency)}</strong> by{" "}
              {PAYMENT_METHOD_LABELS[method]} to
              {hosting.accountName ? ` ${hosting.accountName}` : ""}
            </p>
            <div className="flex items-center justify-between gap-3 rounded-2xl bg-white px-4 py-3 dark:bg-slate-900">
              <span className="font-mono text-lg font-bold tabular-nums">
                {option.account}
              </span>
              <CopyButton
                value={option.account.replace(/\s/g, "")}
                label="number"
              />
            </div>
            <label className="flex flex-col gap-1 text-sm text-slate-700 dark:text-slate-200">
              2. Enter the transaction ID from your confirmation SMS
              <input
                value={reference}
                onChange={(e) => setReference(e.target.value)}
                maxLength={80}
                placeholder="e.g. MP240115.1234.A56789"
                className="w-full rounded-2xl border border-slate-300 bg-white p-3 font-mono text-sm outline-none focus:border-brand-600 dark:border-slate-700 dark:bg-slate-900"
              />
            </label>
          </div>
        )}

        {paid && (
          <section
            aria-label="Price"
            className="flex flex-col gap-1.5 rounded-3xl border border-slate-200 p-4 text-sm dark:border-slate-700"
          >
            <p className="flex justify-between gap-3 text-slate-600 dark:text-slate-300">
              <span>
                {money(hosting.price, hosting.currency)} × {spotsWord}
              </span>
              <span>{money(total, hosting.currency)}</span>
            </p>
            <p className="flex justify-between gap-3 border-t border-slate-100 pt-1.5 font-bold text-slate-950 dark:border-slate-800 dark:text-slate-50">
              <span>
                {method === "cash" ? "To give the organiser" : "To pay now"}
              </span>
              <span>{money(now, hosting.currency)}</span>
            </p>
            {later > 0 && (
              <p className="flex justify-between gap-3 text-xs text-slate-500 dark:text-slate-400">
                <span>
                  Balance
                  {hosting.balanceDueDate
                    ? ` by ${shortDate(hosting.balanceDueDate)}`
                    : " before the trip"}
                </span>
                <span>{money(later, hosting.currency)}</span>
              </p>
            )}
          </section>
        )}

        <p className="text-xs text-slate-500 dark:text-slate-400">
          {waitlist
            ? "You won't be charged anything to join the waitlist."
            : hosting.isFree
              ? hosting.requireApproval
                ? "The organiser looks at each booking and confirms it."
                : "You're confirmed straight away and added to the trip's group chat."
              : mobile
                ? "Your spots are held while the organiser checks the payment. Once it’s found you get your ticket."
                : "Your spots are held until the organiser receives your cash and confirms."}
        </p>
      </div>
    </MenuSheet>
  );
}
