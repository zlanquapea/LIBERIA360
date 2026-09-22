"use client";

import { FormEvent, useState } from "react";
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
  const [requestedDate, setRequestedDate] = useState("");
  const [groupSize, setGroupSize] = useState(1);
  const [note, setNote] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "success" | "error">(
    "idle",
  );
  const [message, setMessage] = useState("");
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!token) {
      setState("error");
      setMessage("Please sign in before requesting to book.");
      return;
    }
    if (!requestedDate || groupSize < 1 || groupSize > maxGroupSize) {
      setState("error");
      setMessage(`Choose a date and group size from 1 to ${maxGroupSize}.`);
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
      className="rounded-3xl border border-brand-200 bg-brand-50/60 p-5 shadow-sm dark:border-brand-900 dark:bg-brand-950/20"
    >
      <h2 className="font-display text-xl font-bold">Request to Book</h2>
      <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
        No payment is required yet. Your request is sent to the guide for
        confirmation.
      </p>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <label className="text-sm font-semibold">
          Date
          <input
            required
            type="date"
            value={requestedDate}
            onChange={(event) => setRequestedDate(event.target.value)}
            className="mt-1 min-h-11 w-full rounded-2xl border border-slate-300 bg-white px-3 dark:border-slate-700 dark:bg-slate-900"
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
            className="mt-1 min-h-11 w-full rounded-2xl border border-slate-300 bg-white px-3 dark:border-slate-700 dark:bg-slate-900"
          />
        </label>
      </div>
      <label className="mt-3 block text-sm font-semibold">
        Note (optional)
        <textarea
          value={note}
          onChange={(event) => setNote(event.target.value)}
          rows={3}
          maxLength={2000}
          className="mt-1 w-full rounded-2xl border border-slate-300 bg-white p-3 dark:border-slate-700 dark:bg-slate-900"
        />
      </label>
      <button
        disabled={state === "sending" || state === "success"}
        className="button-primary mt-4 min-h-11 w-full disabled:opacity-60"
      >
        {state === "sending"
          ? "Sending…"
          : state === "success"
            ? "Request sent"
            : "Request to Book"}
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
