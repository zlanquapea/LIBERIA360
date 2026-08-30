"use client";

import {
  ArrowLeftIcon,
  CheckCircleIcon,
  PaperAirplaneIcon,
  UserPlusIcon,
} from "@heroicons/react/24/outline";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { SafeImage } from "@/components/SafeImage";
import { useAuth } from "@/hooks/useAuth";
import { getFriendlyErrorMessage } from "@/lib/errors";
import {
  assignSupportTicketToMe,
  getCustomerSupportHistory,
  getSupportMessages,
  getSupportTicket,
  sendSupportMessage,
  updateSupportTicket,
} from "@/lib/support-api";
import type {
  SupportMessage,
  SupportTicket,
  SupportTicketPriority,
  SupportTicketStatus,
} from "@/lib/types";

const label = (value: string) =>
  value
    .replaceAll("_", " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
const statuses: SupportTicketStatus[] = [
  "open",
  "in_progress",
  "waiting_for_customer",
  "resolved",
  "closed",
];
const priorities: SupportTicketPriority[] = ["low", "medium", "high", "urgent"];
const priorityClasses: Record<SupportTicketPriority, string> = {
  low: "bg-slate-100 text-slate-700",
  medium: "bg-sky-100 text-sky-800",
  high: "bg-orange-100 text-orange-800",
  urgent: "bg-red-100 text-red-800",
};

export default function AdminSupportDetail() {
  const { id } = useParams<{ id: string }>();
  const { token, user } = useAuth();
  const [ticket, setTicket] = useState<SupportTicket | null>(null);
  const [messages, setMessages] = useState<SupportMessage[]>([]);
  const [history, setHistory] = useState<SupportTicket[]>([]);
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!token) return;
    Promise.all([
      getSupportTicket(token, id),
      getSupportMessages(token, id),
      getCustomerSupportHistory(token, id),
    ])
      .then(([nextTicket, nextMessages, nextHistory]) => {
        setTicket(nextTicket);
        setMessages(nextMessages);
        setHistory(nextHistory);
      })
      .catch((err) => setError(getFriendlyErrorMessage(err)));
  }, [token, id]);
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  async function patch(input: Parameters<typeof updateSupportTicket>[2]) {
    if (!token) return;
    setBusy(true);
    setError("");
    try {
      setTicket(await updateSupportTicket(token, id, input));
    } catch (err) {
      setError(getFriendlyErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }
  async function assignToMe() {
    if (!token) return;
    setBusy(true);
    setError("");
    try {
      setTicket(await assignSupportTicketToMe(token, id));
    } catch (err) {
      setError(getFriendlyErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }
  async function reply(event: FormEvent) {
    event.preventDefault();
    if (!token || !body.trim()) return;
    setBusy(true);
    setError("");
    try {
      const message = await sendSupportMessage(token, id, body.trim());
      setMessages((current) => [...current, message]);
      setBody("");
    } catch (err) {
      setError(getFriendlyErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  if (!ticket)
    return (
      <div className="text-sm text-slate-500">
        {error || "Loading support request…"}
      </div>
    );
  const mine = ticket.assignedAgentUserId === user?.id;
  const claimedBySomeoneElse = Boolean(ticket.assignedAgentUserId && !mine);

  return (
    <div className="space-y-6">
      <Link
        href="/admin/support"
        className="inline-flex items-center gap-2 text-sm font-semibold text-brand-700 dark:text-brand-300"
      >
        <ArrowLeftIcon className="h-4 w-4" />
        Support queue
      </Link>
      <header className="flex flex-col justify-between gap-4 lg:flex-row lg:items-start">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-xs font-bold uppercase tracking-widest text-brand-700 dark:text-brand-300">
              {ticket.reference}
            </p>
            <span
              className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${priorityClasses[ticket.priority]}`}
            >
              {label(ticket.priority)}
            </span>
          </div>
          <h1 className="mt-1 text-2xl font-bold text-slate-950 dark:text-white">
            {ticket.subject}
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            {ticket.customer.name} · {ticket.customer.email} ·{" "}
            {label(ticket.category)}
          </p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm dark:border-slate-800 dark:bg-slate-900">
          {mine ? (
            <p className="flex items-center gap-2 font-semibold text-emerald-700">
              <CheckCircleIcon className="h-5 w-5" />
              Assigned to you
            </p>
          ) : claimedBySomeoneElse ? (
            <>
              <p className="font-semibold">
                Owned by {ticket.assignedAgent?.name}
              </p>
              <p className="mt-0.5 text-xs text-slate-500">
                Only that agent can keep ownership.
              </p>
            </>
          ) : (
            <button
              disabled={busy}
              onClick={() => void assignToMe()}
              className="inline-flex items-center gap-2 font-bold text-brand-700"
            >
              <UserPlusIcon className="h-5 w-5" />
              Assign to me
            </button>
          )}
        </div>
      </header>

      {error && (
        <p
          role="alert"
          className="rounded-2xl bg-red-50 p-4 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-300"
        >
          {error}
        </p>
      )}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="space-y-5">
          <section className="rounded-3xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-center justify-between">
              <h2 className="font-bold">Customer’s issue</h2>
              <span className="text-xs text-slate-500">
                Submitted {new Date(ticket.createdAt).toLocaleString()}
              </span>
            </div>
            <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-slate-700 dark:text-slate-200">
              {ticket.description}
            </p>
            {ticket.attachments.length > 0 && (
              <AttachmentGrid urls={ticket.attachments} />
            )}
          </section>
          <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
            <div className="border-b px-5 py-4 dark:border-slate-800">
              <h2 className="font-bold">Conversation</h2>
              <p className="text-xs text-slate-500">
                Replies notify the customer immediately.
              </p>
            </div>
            <div className="min-h-72 space-y-5 p-5">
              {messages.length === 0 && (
                <p className="py-12 text-center text-sm text-slate-500">
                  No replies yet. Send a clear first response below.
                </p>
              )}
              {messages.map((message) => {
                const fromCustomer =
                  message.senderUserId === ticket.customerUserId;
                return (
                  <div
                    key={message.id}
                    className={`flex ${fromCustomer ? "justify-start" : "justify-end"}`}
                  >
                    <div className="max-w-[78%]">
                      <p
                        className={`mb-1 text-xs font-semibold ${fromCustomer ? "" : "text-right"}`}
                      >
                        {fromCustomer
                          ? ticket.customer.name
                          : message.sender.name}
                      </p>
                      <div
                        className={`rounded-2xl p-3 text-sm leading-6 ${fromCustomer ? "rounded-bl-md bg-slate-100 dark:bg-slate-800" : "rounded-br-md bg-brand-700 text-white"}`}
                      >
                        <p className="whitespace-pre-wrap">{message.body}</p>
                        {message.attachments.length > 0 && (
                          <AttachmentGrid urls={message.attachments} />
                        )}
                      </div>
                      <p
                        className={`mt-1 text-[11px] text-slate-400 ${fromCustomer ? "" : "text-right"}`}
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
                className="border-t p-4 dark:border-slate-800"
              >
                <textarea
                  required
                  value={body}
                  onChange={(event) => setBody(event.target.value)}
                  rows={4}
                  placeholder="Write a helpful, actionable response…"
                  className="w-full resize-y rounded-xl border border-slate-300 bg-transparent p-3 text-sm outline-none focus:border-brand-600 dark:border-slate-700"
                />
                <div className="mt-2 flex items-center justify-between">
                  <p className="text-xs text-slate-500">
                    Tip: say what you checked and what the customer should do
                    next.
                  </p>
                  <button
                    disabled={busy || !body.trim()}
                    className="inline-flex items-center gap-2 rounded-full bg-brand-700 px-5 py-2.5 text-sm font-bold text-white disabled:opacity-50"
                  >
                    Send reply
                    <PaperAirplaneIcon className="h-4 w-4" />
                  </button>
                </div>
              </form>
            )}
          </section>
        </div>

        <aside className="space-y-5">
          <section className="space-y-4 rounded-3xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
            <div>
              <h2 className="font-bold">Ticket controls</h2>
              <p className="text-xs text-slate-500">
                Changes notify the customer.
              </p>
            </div>
            <label className="block text-xs font-bold uppercase tracking-wide text-slate-500">
              Status
              <select
                disabled={busy}
                value={ticket.status}
                onChange={(event) =>
                  void patch({
                    status: event.target.value as SupportTicketStatus,
                  })
                }
                className="mt-1.5 w-full rounded-xl border border-slate-300 bg-transparent p-2.5 text-sm font-medium dark:border-slate-700"
              >
                {statuses.map((status) => (
                  <option key={status} value={status}>
                    {label(status)}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-xs font-bold uppercase tracking-wide text-slate-500">
              Priority
              <select
                disabled={busy}
                value={ticket.priority}
                onChange={(event) =>
                  void patch({
                    priority: event.target.value as SupportTicketPriority,
                  })
                }
                className="mt-1.5 w-full rounded-xl border border-slate-300 bg-transparent p-2.5 text-sm font-medium dark:border-slate-700"
              >
                {priorities.map((priority) => (
                  <option key={priority} value={priority}>
                    {label(priority)}
                  </option>
                ))}
              </select>
            </label>
          </section>
          <section className="rounded-3xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
            <h2 className="font-bold">Customer context</h2>
            <div className="mt-3 rounded-xl bg-slate-50 p-3 text-sm dark:bg-slate-800">
              <p className="font-semibold">{ticket.customer.name}</p>
              <p className="text-xs text-slate-500">{ticket.customer.email}</p>
            </div>
            <h3 className="mt-5 text-xs font-bold uppercase tracking-wide text-slate-500">
              Previous requests
            </h3>
            {history.length === 0 ? (
              <p className="mt-2 text-sm text-slate-500">
                This is their first request.
              </p>
            ) : (
              <div className="mt-2 space-y-2">
                {history.map((previous) => (
                  <Link
                    key={previous.id}
                    href={`/admin/support/${previous.id}`}
                    className="block rounded-xl border border-slate-200 p-3 text-sm hover:border-brand-400 dark:border-slate-700"
                  >
                    <span className="block truncate font-semibold">
                      {previous.subject}
                    </span>
                    <span className="mt-1 block text-xs text-slate-500">
                      {previous.reference} · {label(previous.status)}
                    </span>
                  </Link>
                ))}
              </div>
            )}
          </section>
          {ticket.rating !== null && (
            <section className="rounded-3xl bg-gold-50 p-5 dark:bg-gold-950/20">
              <p className="text-xs font-bold uppercase tracking-wide text-gold-700">
                Customer feedback
              </p>
              <p className="mt-2 text-lg font-bold">{ticket.rating}/5</p>
              {ticket.ratingComment && (
                <p className="mt-2 text-sm leading-6 text-slate-700 dark:text-slate-200">
                  “{ticket.ratingComment}”
                </p>
              )}
            </section>
          )}
        </aside>
      </div>
    </div>
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
            className="h-20 w-20 rounded-xl border object-cover"
            fallback={<div className="h-20 w-20 rounded-xl bg-slate-100" />}
          />
        </a>
      ))}
    </div>
  );
}
