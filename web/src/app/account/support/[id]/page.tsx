"use client";

import {
  ArrowLeftIcon,
  CheckBadgeIcon,
  PaperAirplaneIcon,
  PaperClipIcon,
  StarIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";
import { StarIcon as StarSolidIcon } from "@heroicons/react/24/solid";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { SafeImage } from "@/components/SafeImage";
import { useAuth } from "@/hooks/useAuth";
import { getFriendlyErrorMessage } from "@/lib/errors";
import {
  confirmSupportResolved,
  getSupportMessages,
  getSupportTicket,
  rateSupport,
  sendSupportMessage,
} from "@/lib/support-api";
import { uploadImage } from "@/lib/uploads-api";
import type { SupportMessage, SupportTicket } from "@/lib/types";

const statusHelp: Record<
  SupportTicket["status"],
  { label: string; message: string; classes: string }
> = {
  open: {
    label: "Received",
    message:
      "Your request is in our queue. We’ll notify you when an agent responds.",
    classes: "bg-sky-50 text-sky-800 dark:bg-sky-950/40 dark:text-sky-200",
  },
  in_progress: {
    label: "We’re on it",
    message: "A support agent is actively working on your request.",
    classes:
      "bg-indigo-50 text-indigo-800 dark:bg-indigo-950/40 dark:text-indigo-200",
  },
  waiting_for_customer: {
    label: "Your reply needed",
    message: "Support needs a little more information from you to continue.",
    classes:
      "bg-amber-50 text-amber-900 dark:bg-amber-950/40 dark:text-amber-200",
  },
  resolved: {
    label: "Solution provided",
    message:
      "Please review the solution and tell us whether everything is fixed.",
    classes:
      "bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200",
  },
  closed: {
    label: "Closed",
    message:
      "This request is complete. Your conversation remains available here.",
    classes:
      "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200",
  },
};

export default function SupportThreadPage() {
  const { id } = useParams<{ id: string }>();
  const { token, user } = useAuth();
  const [ticket, setTicket] = useState<SupportTicket | null>(null);
  const [messages, setMessages] = useState<SupportMessage[]>([]);
  const [body, setBody] = useState("");
  const [attachments, setAttachments] = useState<string[]>([]);
  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [ratingComment, setRatingComment] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!token) return;
    Promise.all([getSupportTicket(token, id), getSupportMessages(token, id)])
      .then(([nextTicket, nextMessages]) => {
        setTicket(nextTicket);
        setMessages(nextMessages);
      })
      .catch((err) => setError(getFriendlyErrorMessage(err)));
  }, [token, id]);
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  async function addFiles(files: FileList | null) {
    if (!token || !files) return;
    setBusy(true);
    try {
      const uploaded = await Promise.all(
        Array.from(files)
          .slice(0, 5 - attachments.length)
          .map((file) => uploadImage(token, file)),
      );
      setAttachments((current) => [...current, ...uploaded]);
    } catch (err) {
      setError(getFriendlyErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }
  async function reply(event: FormEvent) {
    event.preventDefault();
    if (!token || (!body.trim() && attachments.length === 0)) return;
    setBusy(true);
    setError("");
    try {
      const message = await sendSupportMessage(
        token,
        id,
        body.trim() || "Attached an image",
        attachments,
      );
      setMessages((current) => [...current, message]);
      setBody("");
      setAttachments([]);
      if (ticket?.status === "waiting_for_customer")
        setTicket({ ...ticket, status: "open" });
    } catch (err) {
      setError(getFriendlyErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }
  async function submitRating(event: FormEvent) {
    event.preventDefault();
    if (!token || rating === 0 || ratingComment.trim().length < 3) return;
    setBusy(true);
    try {
      setTicket(await rateSupport(token, id, rating, ratingComment.trim()));
    } catch (err) {
      setError(getFriendlyErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  if (!ticket)
    return (
      <main className="mx-auto max-w-4xl p-8 text-sm text-slate-500">
        {error || "Loading support request…"}
      </main>
    );
  const status = statusHelp[ticket.status];

  return (
    <main className="mx-auto max-w-4xl space-y-5 px-4 py-8">
      <Link
        href="/account/support"
        className="inline-flex items-center gap-2 text-sm font-semibold text-brand-700 dark:text-brand-300"
      >
        <ArrowLeftIcon className="h-4 w-4" />
        All support requests
      </Link>
      <header className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-7">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-brand-700 dark:text-brand-300">
              {ticket.reference}
            </p>
            <h1 className="mt-1 text-2xl font-bold">{ticket.subject}</h1>
            <p className="mt-1 text-xs text-slate-500">
              Created {new Date(ticket.createdAt).toLocaleString()} ·{" "}
              {ticket.category.replaceAll("_", " ")}
            </p>
          </div>
          <span
            className={`w-fit rounded-full px-3 py-1.5 text-xs font-bold ${status.classes}`}
          >
            {status.label}
          </span>
        </div>
        <div className={`mt-5 rounded-2xl p-4 text-sm ${status.classes}`}>
          <p className="font-semibold">What happens next</p>
          <p className="mt-1 opacity-80">{status.message}</p>
        </div>
        <details className="mt-4">
          <summary className="cursor-pointer text-sm font-semibold text-brand-700">
            View your original request
          </summary>
          <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-slate-600 dark:text-slate-300">
            {ticket.description}
          </p>
          {ticket.attachments.length > 0 && (
            <AttachmentGrid urls={ticket.attachments} />
          )}
        </details>
      </header>

      {error && (
        <p
          role="alert"
          className="rounded-2xl bg-red-50 p-4 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-300"
        >
          {error}
        </p>
      )}

      <section
        aria-label="Conversation"
        className="rounded-3xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900"
      >
        <div className="border-b border-slate-200 px-5 py-4 dark:border-slate-800">
          <h2 className="font-bold">Conversation</h2>
          <p className="text-xs text-slate-500">
            Your messages are private between you and LIBERIA360 Support.
          </p>
        </div>
        <div className="min-h-64 space-y-5 p-4 sm:p-6">
          {messages.length === 0 && (
            <div className="py-12 text-center">
              <CheckBadgeIcon className="mx-auto h-10 w-10 text-brand-600" />
              <p className="mt-3 font-semibold">
                Your request is safely in our queue
              </p>
              <p className="mt-1 text-sm text-slate-500">
                An agent’s reply will appear here.
              </p>
            </div>
          )}
          {messages.map((message) => {
            const mine = message.senderUserId === user?.id;
            return (
              <div
                key={message.id}
                className={`flex ${mine ? "justify-end" : "justify-start"}`}
              >
                <div className="max-w-[88%] sm:max-w-[72%]">
                  <p
                    className={`mb-1 text-xs font-semibold ${mine ? "text-right" : ""}`}
                  >
                    {mine ? "You" : "LIBERIA360 Support"}
                  </p>
                  <div
                    className={`rounded-2xl px-4 py-3 text-sm leading-6 ${mine ? "rounded-br-md bg-brand-700 text-white" : "rounded-bl-md bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-100"}`}
                  >
                    <p className="whitespace-pre-wrap">{message.body}</p>
                    {message.attachments.length > 0 && (
                      <AttachmentGrid urls={message.attachments} />
                    )}
                  </div>
                  <p
                    className={`mt-1 text-[11px] text-slate-400 ${mine ? "text-right" : ""}`}
                  >
                    {new Date(message.createdAt).toLocaleString()}
                  </p>
                </div>
              </div>
            );
          })}
          <div ref={endRef} />
        </div>
        {ticket.status !== "closed" && (
          <form
            onSubmit={reply}
            className="border-t border-slate-200 p-4 dark:border-slate-800"
          >
            <div className="rounded-2xl border border-slate-300 bg-white p-2 focus-within:border-brand-500 focus-within:ring-2 focus-within:ring-brand-100 dark:border-slate-700 dark:bg-slate-950">
              <textarea
                aria-label="Reply"
                value={body}
                onChange={(e) => setBody(e.target.value)}
                rows={3}
                className="w-full resize-none bg-transparent p-2 text-sm outline-none"
                placeholder={
                  ticket.status === "waiting_for_customer"
                    ? "Reply with the information support requested…"
                    : "Write a message…"
                }
              />
              {attachments.length > 0 && (
                <div className="flex flex-wrap gap-2 p-2">
                  {attachments.map((url, index) => (
                    <div className="relative" key={url}>
                      <SafeImage
                        src={url}
                        alt={`Attachment ${index + 1}`}
                        className="h-16 w-16 rounded-lg object-cover"
                        fallback={<div className="h-16 w-16 bg-slate-100" />}
                      />
                      <button
                        type="button"
                        onClick={() =>
                          setAttachments((items) =>
                            items.filter((item) => item !== url),
                          )
                        }
                        className="absolute -right-1 -top-1 rounded-full bg-slate-900 p-0.5 text-white"
                      >
                        <XMarkIcon className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
              <div className="flex items-center justify-between">
                <label
                  className="cursor-pointer rounded-full p-2 text-slate-500 hover:bg-slate-100 hover:text-brand-700 dark:hover:bg-slate-800"
                  aria-label="Attach screenshots"
                >
                  <PaperClipIcon className="h-5 w-5" />
                  <input
                    className="sr-only"
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={(e) => void addFiles(e.target.files)}
                  />
                </label>
                <button
                  disabled={busy || (!body.trim() && attachments.length === 0)}
                  className="inline-flex items-center gap-2 rounded-full bg-brand-700 px-5 py-2 text-sm font-bold text-white disabled:opacity-50"
                >
                  Send
                  <PaperAirplaneIcon className="h-4 w-4" />
                </button>
              </div>
            </div>
          </form>
        )}
      </section>

      {ticket.status === "resolved" && (
        <section className="rounded-3xl border border-emerald-200 bg-emerald-50 p-6 dark:border-emerald-900 dark:bg-emerald-950/30">
          <CheckBadgeIcon className="h-8 w-8 text-emerald-700 dark:text-emerald-300" />
          <h2 className="mt-3 text-lg font-bold">Is everything working now?</h2>
          <p className="mt-1 text-sm text-emerald-900/70 dark:text-emerald-200/70">
            Confirming closes this request. If not, reply above and we’ll keep
            helping.
          </p>
          <button
            onClick={async () => {
              if (token) setTicket(await confirmSupportResolved(token, id));
            }}
            className="mt-4 rounded-full bg-emerald-700 px-5 py-2.5 text-sm font-bold text-white"
          >
            Yes, my issue is resolved
          </button>
        </section>
      )}

      {(ticket.status === "resolved" || ticket.status === "closed") &&
        ticket.rating === null && (
          <form
            onSubmit={submitRating}
            className="rounded-3xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900"
          >
            <p className="text-xs font-bold uppercase tracking-widest text-gold-600">
              Your feedback matters
            </p>
            <h2 className="mt-1 text-xl font-bold">
              How was your support experience?
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              Your rating and comment help us serve the next traveler even
              better.
            </p>
            <div
              className="mt-4 flex gap-1"
              onMouseLeave={() => setHoverRating(0)}
            >
              {[1, 2, 3, 4, 5].map((value) => (
                <button
                  key={value}
                  type="button"
                  onMouseEnter={() => setHoverRating(value)}
                  onClick={() => setRating(value)}
                  className="rounded-lg p-1 text-gold-500 transition hover:scale-110"
                  aria-label={`${value} star${value > 1 ? "s" : ""}`}
                >
                  {value <= (hoverRating || rating) ? (
                    <StarSolidIcon className="h-9 w-9" />
                  ) : (
                    <StarIcon className="h-9 w-9" />
                  )}
                </button>
              ))}
            </div>
            <p className="mt-1 text-sm font-semibold">
              {rating === 0
                ? "Select a rating"
                : [
                    "",
                    "Very poor",
                    "Could be better",
                    "Good",
                    "Great",
                    "Exceptional",
                  ][rating]}
            </p>
            <label className="mt-4 block text-sm font-semibold">
              Tell us what went well—or what we could improve
              <textarea
                required
                minLength={3}
                maxLength={2000}
                value={ratingComment}
                onChange={(e) => setRatingComment(e.target.value)}
                rows={4}
                className="mt-2 w-full rounded-xl border border-slate-300 bg-transparent p-3 outline-none focus:border-brand-600 dark:border-slate-700"
                placeholder="Share a few words about your experience…"
              />
            </label>
            <button
              disabled={busy || rating === 0 || ratingComment.trim().length < 3}
              className="mt-4 rounded-full bg-brand-700 px-6 py-2.5 text-sm font-bold text-white disabled:opacity-50"
            >
              Submit feedback
            </button>
          </form>
        )}

      {ticket.rating !== null && (
        <section className="rounded-2xl bg-gold-50 p-5 dark:bg-gold-950/20">
          <div className="flex text-gold-500">
            {Array.from({ length: 5 }, (_, index) =>
              index < ticket.rating! ? (
                <StarSolidIcon key={index} className="h-5 w-5" />
              ) : (
                <StarIcon key={index} className="h-5 w-5" />
              ),
            )}
          </div>
          <p className="mt-2 text-sm font-semibold">
            Thank you for helping us improve.
          </p>
          {ticket.ratingComment && (
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
              “{ticket.ratingComment}”
            </p>
          )}
        </section>
      )}
    </main>
  );
}

function AttachmentGrid({ urls }: { urls: string[] }) {
  return (
    <div className="mt-3 flex flex-wrap gap-2">
      {urls.map((url, index) => (
        <a key={url} href={url} target="_blank" rel="noreferrer">
          <SafeImage
            src={url}
            alt={`Attachment ${index + 1}`}
            className="h-20 w-20 rounded-xl border border-white/20 object-cover"
            fallback={<div className="h-20 w-20 rounded-xl bg-slate-200" />}
          />
        </a>
      ))}
    </div>
  );
}
