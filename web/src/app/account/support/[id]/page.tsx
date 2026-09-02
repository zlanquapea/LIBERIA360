"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { useAuth } from "@/hooks/useAuth";
import { getFriendlyErrorMessage } from "@/lib/errors";
import {
  confirmSupportResolved,
  getSupportMessages,
  getSupportTicket,
  markSupportMessagesRead,
  rateSupport,
  sendSupportMessage,
} from "@/lib/support-api";
import { uploadImage } from "@/lib/uploads-api";
import { MessageStatus } from "@/components/MessageStatus";
import type { SupportMessage, SupportTicket } from "@/lib/types";

const label = (value: string) =>
  value
    .replaceAll("_", " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());

function Attachments({ urls }: { urls: string[] }) {
  if (!urls.length) return null;
  return (
    <div className="mt-3 flex flex-wrap gap-2">
      {urls.map((url) => (
        <a key={url} href={url} target="_blank" rel="noreferrer">
          <img
            src={url}
            alt="Support attachment"
            className="h-20 w-20 rounded-xl border object-cover"
          />
        </a>
      ))}
    </div>
  );
}

export default function SupportThreadPage() {
  const { id } = useParams<{ id: string }>();
  const { token, user } = useAuth();
  const [ticket, setTicket] = useState<SupportTicket | null>(null);
  const [messages, setMessages] = useState<SupportMessage[]>([]);
  const [body, setBody] = useState("");
  const [attachments, setAttachments] = useState<string[]>([]);
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!token) return;
    Promise.all([getSupportTicket(token, id), getSupportMessages(token, id)])
      .then(([nextTicket, nextMessages]) => {
        setTicket(nextTicket);
        setMessages(nextMessages);
        const hasUnreadFromAgent = nextMessages.some(
          (m) => m.senderUserId !== user?.id && !m.readAt,
        );
        if (hasUnreadFromAgent) {
          // Fire-and-forget: this is the "viewing the thread" signal, not
          // something the reader needs to wait on or see fail.
          markSupportMessagesRead(token, id).catch(() => undefined);
        }
      })
      .catch((reason) => setError(getFriendlyErrorMessage(reason)));
  }, [token, id, user?.id]);

  async function addFiles(files: FileList | null) {
    if (!token || !files) return;
    setBusy(true);
    try {
      const room = 5 - attachments.length;
      const urls = await Promise.all(
        Array.from(files)
          .slice(0, room)
          .map((file) => uploadImage(token, file)),
      );
      setAttachments((current) => [...current, ...urls]);
    } catch (reason) {
      setError(getFriendlyErrorMessage(reason));
    } finally {
      setBusy(false);
    }
  }

  async function reply(event: FormEvent) {
    event.preventDefault();
    if (!token || !body.trim()) return;
    setBusy(true);
    try {
      const message = await sendSupportMessage(
        token,
        id,
        body.trim(),
        attachments,
      );
      setMessages((current) => [...current, message]);
      setBody("");
      setAttachments([]);
    } catch (reason) {
      setError(getFriendlyErrorMessage(reason));
    } finally {
      setBusy(false);
    }
  }

  async function submitFeedback(confirm: boolean) {
    if (!token || rating === 0 || comment.trim().length < 3) return;
    setBusy(true);
    try {
      setTicket(
        confirm
          ? await confirmSupportResolved(token, id, rating, comment.trim())
          : await rateSupport(token, id, rating, comment.trim()),
      );
      setComment("");
    } catch (reason) {
      setError(getFriendlyErrorMessage(reason));
    } finally {
      setBusy(false);
    }
  }

  if (!ticket)
    return (
      <main className="mx-auto max-w-3xl p-6">
        {error || "Loading support request…"}
      </main>
    );
  const needsFeedback =
    (ticket.status === "resolved" || ticket.status === "closed") &&
    ticket.rating === null;
  return (
    <main className="mx-auto max-w-3xl space-y-5 px-4 py-8">
      <Link
        href="/account/support"
        className="text-sm font-semibold text-brand-700"
      >
        ← All support requests
      </Link>
      {error && (
        <p
          role="alert"
          className="rounded-xl bg-red-50 p-3 text-sm text-red-700"
        >
          {error}
        </p>
      )}
      <header className="rounded-3xl bg-gradient-to-br from-brand-950 to-brand-700 p-6 text-white shadow-lg">
        <div className="flex justify-between gap-3">
          <div>
            <p className="text-xs font-bold tracking-widest text-white/70">
              {ticket.reference}
            </p>
            <h1 className="mt-1 text-2xl font-bold">{ticket.subject}</h1>
          </div>
          <span className="h-fit rounded-full bg-white/15 px-3 py-1 text-xs font-semibold">
            {label(ticket.status)}
          </span>
        </div>
        <p className="mt-4 whitespace-pre-wrap text-sm leading-6 text-white/85">
          {ticket.description}
        </p>
        <Attachments urls={ticket.attachments} />
      </header>
      <section
        aria-label="Conversation"
        className="min-h-64 space-y-3 rounded-3xl border bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900"
      >
        {!messages.length && (
          <p className="py-16 text-center text-sm text-slate-500">
            A support agent will respond here.
          </p>
        )}
        {messages.map((message) => (
          <div
            key={message.id}
            className={`flex ${message.senderUserId === user?.id ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm ${message.senderUserId === user?.id ? "bg-brand-700 text-white" : "bg-slate-100 dark:bg-slate-800"}`}
            >
              <p className="whitespace-pre-wrap">{message.body}</p>
              <Attachments urls={message.attachments} />
              <p className="mt-2 text-[10px] opacity-70">
                {message.senderUserId === user?.id
                  ? "You"
                  : message.sender.name || "Support"}{" "}
                · {new Date(message.createdAt).toLocaleString()}
              </p>
              {message.senderUserId === user?.id && (
                <div className="mt-1 text-[10px] opacity-70">
                  <MessageStatus viewed={Boolean(message.readAt)} />
                </div>
              )}
            </div>
          </div>
        ))}
      </section>
      {ticket.status !== "closed" && (
        <form
          onSubmit={reply}
          className="space-y-2 rounded-2xl border p-3 dark:border-slate-800"
        >
          <textarea
            aria-label="Reply"
            required
            value={body}
            onChange={(event) => setBody(event.target.value)}
            rows={3}
            className="w-full rounded-xl border p-3 dark:bg-slate-950"
            placeholder="Write a reply…"
          />
          <div className="flex flex-wrap items-center justify-between gap-2">
            <label className="cursor-pointer text-sm font-semibold text-brand-700">
              Add images
              <input
                className="sr-only"
                type="file"
                accept="image/*"
                multiple
                onChange={(event) => void addFiles(event.target.files)}
              />
            </label>
            <button
              disabled={busy}
              className="rounded-xl bg-brand-700 px-6 py-2 font-semibold text-white disabled:opacity-50"
            >
              Send reply
            </button>
          </div>
          <Attachments urls={attachments} />
        </form>
      )}
      {needsFeedback && (
        <section className="rounded-3xl border border-amber-200 bg-amber-50 p-5 dark:border-amber-900 dark:bg-amber-950/30">
          <h2 className="text-lg font-bold">
            {ticket.status === "resolved"
              ? "Is your issue resolved?"
              : "Rate your support experience"}
          </h2>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
            A star rating and written feedback are required.
          </p>
          <div className="my-4 flex gap-1" aria-label="Star rating">
            {[1, 2, 3, 4, 5].map((star) => (
              <button
                key={star}
                type="button"
                aria-label={`${star} star${star === 1 ? "" : "s"}`}
                onClick={() => setRating(star)}
                className={`text-3xl ${star <= rating ? "text-amber-500" : "text-slate-300"}`}
              >
                ★
              </button>
            ))}
          </div>
          <textarea
            required
            minLength={3}
            value={comment}
            onChange={(event) => setComment(event.target.value)}
            rows={3}
            placeholder="Tell us what went well or what we can improve…"
            className="w-full rounded-xl border bg-white p-3 dark:bg-slate-900"
          />
          <button
            type="button"
            disabled={busy || rating === 0 || comment.trim().length < 3}
            onClick={() => void submitFeedback(ticket.status === "resolved")}
            className="mt-3 rounded-full bg-emerald-700 px-5 py-2.5 font-semibold text-white disabled:opacity-50"
          >
            {ticket.status === "resolved"
              ? "Confirm resolution & submit feedback"
              : "Submit feedback"}
          </button>
        </section>
      )}
      {ticket.rating !== null && (
        <section className="rounded-2xl border p-4 text-sm dark:border-slate-800">
          <p className="font-bold text-amber-500">
            {"★".repeat(ticket.rating)}
            {"☆".repeat(5 - ticket.rating)}
          </p>
          <p className="mt-1 text-slate-600 dark:text-slate-300">
            {ticket.ratingComment}
          </p>
        </section>
      )}
    </main>
  );
}
