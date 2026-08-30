"use client";

import {
  ArrowRightIcon,
  ChatBubbleLeftRightIcon,
  CheckCircleIcon,
  LifebuoyIcon,
  PaperClipIcon,
  PlusIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";
import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";
import { SafeImage } from "@/components/SafeImage";
import { useAuth } from "@/hooks/useAuth";
import { getFriendlyErrorMessage } from "@/lib/errors";
import { createSupportTicket, getMySupportTickets } from "@/lib/support-api";
import { uploadImage } from "@/lib/uploads-api";
import type { SupportTicket, SupportTicketCategory } from "@/lib/types";

const categories: Array<{
  value: SupportTicketCategory;
  label: string;
  hint: string;
}> = [
  { value: "account", label: "Account", hint: "Login, profile, or security" },
  { value: "booking", label: "Booking", hint: "Reservations or messages" },
  { value: "payment", label: "Payment", hint: "Charges, refunds, or tickets" },
  { value: "listing", label: "Listing", hint: "Places, events, or businesses" },
  {
    value: "technical",
    label: "Technical issue",
    hint: "Something is not working",
  },
  {
    value: "safety",
    label: "Safety concern",
    hint: "Urgent trust or safety issue",
  },
  { value: "feedback", label: "Feedback", hint: "Ideas to improve LIBERIA360" },
  {
    value: "other",
    label: "Something else",
    hint: "Anything not listed above",
  },
];
const statusCopy: Record<
  SupportTicket["status"],
  { label: string; classes: string }
> = {
  open: {
    label: "Received",
    classes: "bg-sky-50 text-sky-700 dark:bg-sky-950/50 dark:text-sky-300",
  },
  in_progress: {
    label: "We’re on it",
    classes:
      "bg-indigo-50 text-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-300",
  },
  waiting_for_customer: {
    label: "Needs your reply",
    classes:
      "bg-amber-50 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300",
  },
  resolved: {
    label: "Ready to confirm",
    classes:
      "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300",
  },
  closed: {
    label: "Closed",
    classes:
      "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300",
  },
};

export default function CustomerSupportPage() {
  const { token, ready } = useAuth();
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [category, setCategory] = useState<SupportTicketCategory>("technical");
  const [subject, setSubject] = useState("");
  const [description, setDescription] = useState("");
  const [attachments, setAttachments] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!token) return;
    getMySupportTickets(token)
      .then(setTickets)
      .catch((err) => setError(getFriendlyErrorMessage(err)))
      .finally(() => setLoading(false));
  }, [token]);

  async function addFiles(files: FileList | null) {
    if (!token || !files) return;
    setBusy(true);
    setError("");
    try {
      const selected = Array.from(files).slice(0, 5 - attachments.length);
      const urls = await Promise.all(
        selected.map((file) => uploadImage(token, file)),
      );
      setAttachments((current) => [...current, ...urls]);
    } catch (err) {
      setError(getFriendlyErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!token) return;
    setBusy(true);
    setError("");
    try {
      const ticket = await createSupportTicket(token, {
        category,
        subject: subject.trim(),
        description: description.trim(),
        attachments,
      });
      setTickets((current) => [ticket, ...current]);
      setShowForm(false);
      setSubject("");
      setDescription("");
      setAttachments([]);
    } catch (err) {
      setError(getFriendlyErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  if (!ready)
    return (
      <main className="mx-auto max-w-4xl p-8 text-sm text-slate-500">
        Loading support…
      </main>
    );
  if (!token)
    return (
      <main className="mx-auto max-w-md px-4 py-16 text-center">
        <LifebuoyIcon className="mx-auto h-12 w-12 text-brand-700" />
        <h1 className="mt-4 text-2xl font-bold">How can we help?</h1>
        <p className="mt-2 text-slate-500">
          Log in so we can keep your support conversations private.
        </p>
        <Link
          className="mt-6 inline-flex rounded-full bg-brand-700 px-6 py-3 font-semibold text-white"
          href="/login"
        >
          Log in to continue
        </Link>
      </main>
    );

  return (
    <main className="mx-auto max-w-4xl space-y-8 px-4 py-8 sm:py-12">
      <header className="overflow-hidden rounded-3xl bg-gradient-to-br from-brand-950 via-brand-900 to-brand-700 p-6 text-white shadow-lg sm:p-8">
        <div className="flex flex-col justify-between gap-6 sm:flex-row sm:items-center">
          <div>
            <p className="text-sm font-semibold text-gold-300">
              LIBERIA360 Support
            </p>
            <h1 className="mt-1 text-3xl font-bold">How can we help?</h1>
            <p className="mt-2 max-w-xl text-sm leading-6 text-white/75">
              Tell us what happened. Your request, replies, and progress stay
              together here—no email searching needed.
            </p>
          </div>
          <button
            onClick={() => {
              setShowForm((value) => !value);
              setError("");
            }}
            className="inline-flex shrink-0 items-center justify-center gap-2 rounded-full bg-white px-5 py-3 text-sm font-bold text-brand-900 shadow-sm hover:bg-gold-50"
          >
            <PlusIcon className="h-5 w-5" />
            {showForm ? "Close form" : "Get help"}
          </button>
        </div>
      </header>

      {error && (
        <p
          role="alert"
          className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300"
        >
          {error}
        </p>
      )}

      {showForm && (
        <form
          onSubmit={submit}
          className="space-y-6 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-7"
        >
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-brand-700 dark:text-brand-300">
              New request
            </p>
            <h2 className="mt-1 text-xl font-bold">
              What do you need help with?
            </h2>
          </div>
          <fieldset>
            <legend className="text-sm font-semibold">
              Choose the closest topic
            </legend>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              {categories.map((item) => (
                <label
                  key={item.value}
                  className={`cursor-pointer rounded-2xl border p-3 transition ${category === item.value ? "border-brand-600 bg-brand-50 ring-1 ring-brand-600 dark:bg-brand-950/30" : "border-slate-200 hover:border-brand-300 dark:border-slate-700"}`}
                >
                  <input
                    className="sr-only"
                    type="radio"
                    name="category"
                    value={item.value}
                    checked={category === item.value}
                    onChange={() => setCategory(item.value)}
                  />
                  <span className="block text-sm font-semibold">
                    {item.label}
                  </span>
                  <span className="text-xs text-slate-500 dark:text-slate-400">
                    {item.hint}
                  </span>
                </label>
              ))}
            </div>
          </fieldset>
          <label className="block text-sm font-semibold">
            Give your request a short title
            <input
              required
              minLength={3}
              maxLength={180}
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Example: I cannot access my booking"
              className="mt-2 w-full rounded-xl border border-slate-300 bg-transparent p-3 outline-none focus:border-brand-600 focus:ring-2 focus:ring-brand-100 dark:border-slate-700"
            />
          </label>
          <label className="block text-sm font-semibold">
            Tell us what happened
            <span className="mt-1 block text-xs font-normal text-slate-500">
              Include what you expected, what happened instead, and any steps
              you already tried.
            </span>
            <textarea
              required
              minLength={10}
              rows={6}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="The more detail you share, the faster we can help…"
              className="mt-2 w-full resize-y rounded-xl border border-slate-300 bg-transparent p-3 outline-none focus:border-brand-600 focus:ring-2 focus:ring-brand-100 dark:border-slate-700"
            />
          </label>
          <div>
            <p className="text-sm font-semibold">
              Add screenshots{" "}
              <span className="font-normal text-slate-500">
                (optional, up to 5)
              </span>
            </p>
            <div className="mt-2 flex flex-wrap gap-3">
              {attachments.map((url, index) => (
                <div key={url} className="relative">
                  <SafeImage
                    src={url}
                    alt={`Screenshot ${index + 1}`}
                    className="h-20 w-20 rounded-xl border object-cover"
                    fallback={
                      <div className="h-20 w-20 rounded-xl bg-slate-100" />
                    }
                  />
                  <button
                    type="button"
                    onClick={() =>
                      setAttachments((items) =>
                        items.filter((item) => item !== url),
                      )
                    }
                    className="absolute -right-2 -top-2 rounded-full bg-slate-900 p-1 text-white"
                    aria-label={`Remove screenshot ${index + 1}`}
                  >
                    <XMarkIcon className="h-4 w-4" />
                  </button>
                </div>
              ))}
              {attachments.length < 5 && (
                <label className="flex h-20 w-20 cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 text-xs text-slate-500 hover:border-brand-500 hover:text-brand-700 dark:border-slate-700">
                  <PaperClipIcon className="mb-1 h-5 w-5" />
                  Add
                  <input
                    className="sr-only"
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={(e) => void addFiles(e.target.files)}
                  />
                </label>
              )}
            </div>
          </div>
          <div className="flex flex-col-reverse gap-3 border-t pt-5 sm:flex-row sm:items-center sm:justify-between dark:border-slate-800">
            <p className="text-xs text-slate-500">
              You’ll receive a reference number and notifications for every
              update.
            </p>
            <button
              disabled={
                busy ||
                subject.trim().length < 3 ||
                description.trim().length < 10
              }
              className="rounded-full bg-brand-700 px-6 py-3 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-50"
            >
              {busy ? "Sending…" : "Send request"}
            </button>
          </div>
        </form>
      )}

      <section>
        <div className="mb-4 flex items-end justify-between">
          <div>
            <h2 className="text-xl font-bold">Your support requests</h2>
            <p className="text-sm text-slate-500">
              Open a request to read or send replies.
            </p>
          </div>
          <span className="text-sm text-slate-500">{tickets.length} total</span>
        </div>
        {loading ? (
          <div className="rounded-2xl border p-8 text-center text-sm text-slate-500 dark:border-slate-800">
            Loading your requests…
          </div>
        ) : tickets.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-slate-300 p-10 text-center dark:border-slate-700">
            <ChatBubbleLeftRightIcon className="mx-auto h-10 w-10 text-slate-400" />
            <h3 className="mt-3 font-bold">No support requests yet</h3>
            <p className="mt-1 text-sm text-slate-500">
              When you need us, select “Get help” above.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {tickets.map((ticket) => {
              const status = statusCopy[ticket.status];
              return (
                <Link
                  key={ticket.id}
                  href={`/account/support/${ticket.id}`}
                  className="group flex items-center gap-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:border-brand-300 hover:shadow-md dark:border-slate-800 dark:bg-slate-900"
                >
                  <span
                    className={`hidden h-11 w-11 shrink-0 items-center justify-center rounded-full sm:flex ${ticket.status === "closed" ? "bg-emerald-50 text-emerald-700" : "bg-brand-50 text-brand-700 dark:bg-brand-950"}`}
                  >
                    {ticket.status === "closed" ? (
                      <CheckCircleIcon className="h-6 w-6" />
                    ) : (
                      <ChatBubbleLeftRightIcon className="h-6 w-6" />
                    )}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-semibold">
                      {ticket.subject}
                    </span>
                    <span className="mt-1 block text-xs text-slate-500">
                      {ticket.reference} · Updated{" "}
                      {new Date(ticket.updatedAt).toLocaleDateString()}
                    </span>
                  </span>
                  <span
                    className={`hidden rounded-full px-3 py-1 text-xs font-bold sm:block ${status.classes}`}
                  >
                    {status.label}
                  </span>
                  <ArrowRightIcon className="h-5 w-5 shrink-0 text-slate-400 transition group-hover:translate-x-1 group-hover:text-brand-600" />
                </Link>
              );
            })}
          </div>
        )}
      </section>
    </main>
  );
}
