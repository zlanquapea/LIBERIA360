"use client";

import { FormEvent, useEffect, useState } from "react";
import { apiRequest } from "@/lib/http";
import { useAuth } from "@/hooks/useAuth";
import { requestGuideBooking } from "@/lib/guides-api";

export function GuideBookingForm({
  experienceId,
  maxGroupSize,
}: {
  experienceId: string;
  maxGroupSize: number;
}) {
  const { token } = useAuth();
  const [availability, setAvailability] = useState<{
    enabled: boolean;
    weekdays: number[];
    blockedDates: string[];
    bookedDates: string[];
  } | null>(null);
  const [availabilityError, setAvailabilityError] = useState(false);
  useEffect(() => {
    let alive = true;
    apiRequest<{
      enabled: boolean;
      weekdays: number[];
      blockedDates: string[];
      bookedDates: string[];
    }>(`/experiences/${experienceId}/availability`, { cache: "no-store" })
      .then((value) => {
        if (alive) {
          setAvailability(value);
          setAvailabilityError(false);
        }
      })
      .catch(() => {
        if (alive) setAvailabilityError(true);
      });
    return () => {
      alive = false;
    };
  }, [experienceId]);
  const [requestedDate, setRequestedDate] = useState("");
  const [groupSize, setGroupSize] = useState(1);
  const [note, setNote] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "success" | "error">(
    "idle",
  );
  const [reviewing, setReviewing] = useState(false);
  const today = new Date();
  const minDate = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
  const [message, setMessage] = useState("");
  const unavailable =
    !!availability &&
    !!requestedDate &&
    (availability.bookedDates.includes(requestedDate) ||
      (availability.enabled &&
        (!availability.weekdays.includes(
          new Date(requestedDate + "T00:00:00Z").getUTCDay(),
        ) ||
          availability.blockedDates.includes(requestedDate))));
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (state === "sending" || state === "success") return;
    if (!token) {
      setState("error");
      setMessage("Please sign in before requesting to book.");
      return;
    }
    if (
      !requestedDate ||
      requestedDate < minDate ||
      !Number.isInteger(groupSize) ||
      groupSize < 1 ||
      groupSize > maxGroupSize
    ) {
      setState("error");
      setMessage(`Choose a date and group size from 1 to ${maxGroupSize}.`);
      return;
    }
    if (unavailable) {
      setState("error");
      setMessage("The guide is unavailable on this date. Please choose another date.");
      return;
    }
    if (!reviewing) {
      setReviewing(true);
      setState("idle");
      setMessage("");
      return;
    }
    setState("sending");
    setMessage("");
    try {
      await requestGuideBooking(token, experienceId, {
        requestedDate,
        groupSize,
        note: note || undefined,
      });
      setState("success");
      setMessage("Request sent. The guide will respond from their dashboard.");
    } catch (error) {
      setState("error");
      setMessage(
        error instanceof Error
          ? error.message
          : "We could not send your request.",
      );
    }
  }
  return (
    <form
      onSubmit={submit}
      className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900 sm:p-6"
    >
      <h2 className="font-display text-xl font-bold">Request a booking</h2>
      <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
        No payment is required yet. Your request is sent to the guide for
        confirmation.
      </p>
      <div
        className="mt-4 rounded-xl bg-slate-50 p-3 text-sm dark:bg-slate-800"
        role="status"
      >
        {availabilityError
          ? "Live availability could not load. Your date will be checked when you send the request."
          : !availability
            ? "Checking guide availability…"
            : availability.enabled
              ? `Working days: ${
                  availability.weekdays.length
                    ? availability.weekdays
                        .map(
                          (day) =>
                            ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][
                              day
                            ],
                        )
                        .join(", ")
                    : "No dates currently available"
                }. Blocked and already-booked dates are unavailable.`
              : "The guide accepts date requests. Already-booked dates are unavailable."}
        {requestedDate && availability && (
          <p className="mt-2 font-semibold">
            {unavailable
              ? "Unavailable — choose another date."
              : "Available to request. Final confirmation is still required."}
          </p>
        )}
      </div>
      <ol
        aria-label="Booking progress"
        className="my-5 grid grid-cols-3 gap-2 text-center text-xs font-semibold"
      >
        {["Details", "Review", "Send"].map((step, index) => (
          <li
            key={step}
            aria-current={
              (state === "success" ? 2 : reviewing ? 1 : 0) === index
                ? "step"
                : undefined
            }
            className={`border-t-2 pt-2 ${(state === "success" ? 2 : reviewing ? 1 : 0) === index ? "border-brand-500 text-brand-700 dark:text-brand-300" : "border-slate-200 text-slate-500 dark:border-slate-700"}`}
          >
            {step}
          </li>
        ))}
      </ol>
      {reviewing ? (
        <section
          aria-label="Review your request"
          className="rounded-xl bg-slate-50 p-4 dark:bg-slate-800"
        >
          <h3 className="font-bold">
            {state === "success" ? "Your request" : "Review your request"}
          </h3>
          <dl className="mt-3 space-y-2 text-sm">
            <div>
              <dt className="text-slate-500 dark:text-slate-400">Date</dt>
              <dd>{requestedDate}</dd>
            </div>
            <div>
              <dt className="text-slate-500 dark:text-slate-400">Guests</dt>
              <dd>{groupSize}</dd>
            </div>
            {note.trim() && (
              <div>
                <dt className="text-slate-500 dark:text-slate-400">
                  Your plans
                </dt>
                <dd className="break-words whitespace-pre-wrap">{note}</dd>
              </div>
            )}
          </dl>
          {state !== "success" && (
            <button
              type="button"
              disabled={state === "sending"}
              onClick={() => setReviewing(false)}
              className="mt-3 min-h-11 text-sm font-semibold text-brand-700 dark:text-brand-300"
            >
              Edit details
            </button>
          )}
        </section>
      ) : (
        <>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <label className="text-sm font-semibold">
              Date
              <input
                required
                type="date"
                min={minDate}
                value={requestedDate}
                onChange={(event) => setRequestedDate(event.target.value)}
                className="mt-1 min-h-11 w-full min-w-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 rounded-2xl border border-slate-300 bg-white px-3 dark:border-slate-700 dark:bg-slate-900"
              />
            </label>
            <label className="text-sm font-semibold">
              Group size
              <input
                required
                type="number"
                min={1}
                max={maxGroupSize}
                value={groupSize}
                onChange={(event) => setGroupSize(Number(event.target.value))}
                className="mt-1 min-h-11 w-full min-w-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 rounded-2xl border border-slate-300 bg-white px-3 dark:border-slate-700 dark:bg-slate-900"
              />
            </label>
          </div>
          <label className="mt-3 block text-sm font-semibold">
            Note (optional)
            <textarea
              value={note}
              onChange={(event) => setNote(event.target.value)}
              rows={3}
              placeholder="Tell your guide about your trip…"
              maxLength={2000}
              className="mt-1 w-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 rounded-2xl border border-slate-300 bg-white p-3 dark:border-slate-700 dark:bg-slate-900"
            />
          </label>
        </>
      )}
      <button
        disabled={state === "sending" || state === "success"}
        className="button-primary mt-4 min-h-11 w-full disabled:opacity-60"
      >
        {state === "sending"
          ? "Sending…"
          : state === "success"
            ? "Request sent"
            : reviewing
              ? "Send request"
              : "Review request"}
      </button>
      {message && (
        <p
          role={state === "error" ? "alert" : "status"}
          className={`mt-3 text-sm ${state === "error" ? "text-red-700 dark:text-red-300" : "text-emerald-700 dark:text-emerald-300"}`}
        >
          {message}
        </p>
      )}
    </form>
  );
}
