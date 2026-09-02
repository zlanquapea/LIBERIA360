"use client";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { SafeImage } from "@/components/SafeImage";
import { useAuth } from "@/hooks/useAuth";
import { uploadImage } from "@/lib/uploads-api";
import {
  getCustomerSupportHistory,
  getSupportAgents,
  getSupportMessages,
  getSupportTicket,
  markSupportMessagesRead,
  sendSupportMessage,
  updateSupportTicket,
} from "@/lib/support-api";
import { MessageStatus } from "@/components/MessageStatus";
import type {
  AuthUser,
  SupportMessage,
  SupportTicket,
  SupportTicketPriority,
  SupportTicketStatus,
} from "@/lib/types";
const label = (v: string) =>
  v.replaceAll("_", " ").replace(/\b\w/g, (c) => c.toUpperCase());
const statuses: SupportTicketStatus[] = [
  "open",
  "in_progress",
  "waiting_for_customer",
  "resolved",
  "closed",
];
const priorities: SupportTicketPriority[] = ["low", "medium", "high", "urgent"];
export default function AdminSupportDetail() {
  const { id } = useParams<{ id: string }>();
  const { token, user } = useAuth();
  const [ticket, setTicket] = useState<SupportTicket | null>(null);
  const [messages, setMessages] = useState<SupportMessage[]>([]);
  const [history, setHistory] = useState<SupportTicket[]>([]);
  const [agents, setAgents] = useState<AuthUser[]>([]);
  const [body, setBody] = useState("");
  const [attachments, setAttachments] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const load = (silent = false) => {
    if (token)
      (!silent && setLoading(true),
        Promise.all([
          getSupportTicket(token, id),
          getSupportMessages(token, id),
          getCustomerSupportHistory(token, id),
          getSupportAgents(token),
        ])
          .then(([t, m, h, a]) => {
            setTicket(t);
            setMessages(m);
            setHistory(h);
            setAgents(a);
            setError("");
            const hasUnreadFromCustomer = m.some(
              (message) => message.senderUserId !== user?.id && !message.readAt,
            );
            if (hasUnreadFromCustomer) {
              // Fire-and-forget: this is the "viewing the thread" signal,
              // not something the reader needs to wait on or see fail.
              markSupportMessagesRead(token, id).catch(() => undefined);
            }
          })
          .catch((cause) =>
            setError(
              cause instanceof Error
                ? cause.message
                : "Unable to load this ticket.",
            ),
          )
          .finally(() => setLoading(false)));
  };
  useEffect(load, [token, id, user?.id]);
  useEffect(() => {
    if (!token) return;
    const timer = window.setInterval(() => load(true), 15000);
    return () => window.clearInterval(timer);
  }, [token, id]);
  async function addFiles(files: FileList | null) {
    if (!token || !files || uploading) return;
    setUploading(true);
    setError("");
    try {
      const room = 5 - attachments.length;
      const urls = await Promise.all(
        Array.from(files)
          .slice(0, room)
          .map((file) => uploadImage(token, file)),
      );
      setAttachments((current) => [...current, ...urls]);
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Unable to upload the attachment. Please try again.",
      );
    } finally {
      setUploading(false);
    }
  }
  async function patch(input: Parameters<typeof updateSupportTicket>[2]) {
    if (!token || busy) return;
    setBusy(true);
    setError("");
    try {
      setTicket(await updateSupportTicket(token, id, input));
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Unable to update ticket.",
      );
    } finally {
      setBusy(false);
    }
  }
  async function reply(e: FormEvent) {
    e.preventDefault();
    if (token && body.trim()) {
      setBusy(true);
      setError("");
      try {
        const m = await sendSupportMessage(token, id, body.trim(), attachments);
        setMessages((x) => [...x, m]);
        setBody("");
        setAttachments([]);
      } catch (cause) {
        setError(
          cause instanceof Error ? cause.message : "Unable to send reply.",
        );
      } finally {
        setBusy(false);
      }
    }
  }
  if (loading && !ticket) return <div role="status">Loading ticket…</div>;
  if (!ticket)
    return (
      <div role="alert" className="rounded-xl bg-red-50 p-4 text-red-700">
        <p>{error || "Ticket not found."}</p>
        <button onClick={() => load()} className="mt-2 font-semibold underline">
          Retry
        </button>
      </div>
    );
  return (
    <div className="space-y-5">
      <Link href="/admin/support" className="text-sm text-brand-700">
        ← Support queue
      </Link>
      <header>
        <p className="text-xs font-bold uppercase text-brand-700">
          {ticket.reference}
        </p>
        <h1 className="text-2xl font-bold">{ticket.subject}</h1>
        <p className="text-sm text-slate-500">
          From {ticket.customer.name} · {ticket.customer.email} ·{" "}
          {label(ticket.category)}
        </p>
      </header>
      {error && (
        <div
          role="alert"
          className="rounded-xl bg-red-50 p-3 text-sm text-red-700"
        >
          {error}
        </div>
      )}
      <div className="grid gap-5 lg:grid-cols-[1fr_18rem]">
        <div className="space-y-4">
          <section className="rounded-2xl border p-4 dark:border-slate-800">
            <h2 className="font-bold">Customer&apos;s issue</h2>
            <p className="mt-2 whitespace-pre-wrap text-sm">
              {ticket.description}
            </p>
            {ticket.attachments.length > 0 && (
              <div className="mt-3 flex gap-2">
                {ticket.attachments.map((x) => (
                  <a href={x} target="_blank" key={x}>
                    <SafeImage
                      src={x}
                      alt="Attachment"
                      className="h-20 w-20 rounded-lg object-cover"
                      fallback={
                        <span className="text-xs">Image unavailable</span>
                      }
                    />
                  </a>
                ))}
              </div>
            )}
          </section>
          <section className="min-h-64 space-y-3 rounded-2xl border p-4 dark:border-slate-800">
            {messages.map((m) => (
              <div
                key={m.id}
                className={`flex ${m.senderUserId === user?.id ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[80%] rounded-2xl p-3 text-sm ${m.senderUserId === ticket.customerUserId ? "bg-slate-100 dark:bg-slate-800" : "bg-brand-700 text-white"}`}
                >
                  <p>{m.body}</p>
                  {m.attachments?.map((attachment) => (
                    <a
                      key={attachment}
                      href={attachment}
                      target="_blank"
                      className="mt-2 block"
                    >
                      <SafeImage
                        src={attachment}
                        alt="Reply attachment"
                        className="h-20 w-20 rounded-lg object-cover"
                        fallback={
                          <span className="text-xs">Image unavailable</span>
                        }
                      />
                    </a>
                  ))}
                  <p className="mt-1 text-[10px] opacity-70">
                    {m.sender.name} · {new Date(m.createdAt).toLocaleString()}
                  </p>
                  {m.senderUserId === user?.id && (
                    <div className="mt-1 text-[10px] opacity-70">
                      <MessageStatus viewed={Boolean(m.readAt)} />
                    </div>
                  )}
                </div>
              </div>
            ))}
          </section>
          <button
            type="button"
            disabled={loading}
            onClick={() => load()}
            className="text-sm font-semibold text-brand-700 disabled:opacity-50"
          >
            {loading ? "Refreshing…" : "Refresh conversation"}
          </button>
          {ticket.status !== "closed" && (
            <form onSubmit={reply} className="space-y-2">
              {attachments.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {attachments.map((attachment) => (
                    <div key={attachment} className="relative">
                      <SafeImage
                        src={attachment}
                        alt="Attachment preview"
                        className="h-20 w-20 rounded-lg object-cover"
                        fallback={
                          <span className="text-xs">Image unavailable</span>
                        }
                      />
                      <button
                        type="button"
                        aria-label="Remove attachment"
                        onClick={() =>
                          setAttachments((items) =>
                            items.filter((item) => item !== attachment),
                          )
                        }
                        className="absolute -right-2 -top-2 rounded-full bg-slate-900 px-2 text-white"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              )}
              <div className="flex gap-2">
                <textarea
                  required
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  placeholder="Reply to customer…"
                  className="min-w-0 flex-1 rounded-xl border p-3 dark:bg-slate-900"
                />
                <button
                  disabled={busy || uploading}
                  className="rounded-xl bg-brand-700 px-5 font-semibold text-white disabled:opacity-50"
                >
                  {busy ? "Sending…" : "Reply"}
                </button>
              </div>
              <label className="inline-flex cursor-pointer items-center rounded-lg border px-3 py-2 text-sm font-semibold">
                {uploading
                  ? "Uploading images…"
                  : `Attach images (${attachments.length}/5)`}
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  multiple
                  disabled={uploading || attachments.length >= 5}
                  onChange={(event) => {
                    void addFiles(event.target.files);
                    event.target.value = "";
                  }}
                  className="sr-only"
                />
              </label>
              <p className="text-xs text-slate-500">
                Up to five JPEG, PNG, WebP, or GIF images; 8MB each.
              </p>
            </form>
          )}
        </div>
        <aside className="space-y-4">
          <div className="space-y-3 rounded-2xl border p-4 dark:border-slate-800">
            <label className="block text-xs font-bold uppercase">
              Status
              <select
                disabled={busy}
                value={ticket.status}
                onChange={(e) =>
                  void patch({ status: e.target.value as SupportTicketStatus })
                }
                className="mt-1 w-full rounded-lg border p-2 dark:bg-slate-900"
              >
                {statuses.map((x) => (
                  <option key={x} value={x}>
                    {label(x)}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-xs font-bold uppercase">
              Priority
              <select
                disabled={busy}
                value={ticket.priority}
                onChange={(e) =>
                  void patch({
                    priority: e.target.value as SupportTicketPriority,
                  })
                }
                className="mt-1 w-full rounded-lg border p-2 dark:bg-slate-900"
              >
                {priorities.map((x) => (
                  <option key={x} value={x}>
                    {label(x)}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-xs font-bold uppercase">
              Assigned administrator
              <select
                disabled={busy}
                value={ticket.assignedAgentUserId ?? ""}
                onChange={(e) =>
                  void patch({ assignedAgentUserId: e.target.value || null })
                }
                className="mt-1 w-full rounded-lg border p-2 dark:bg-slate-900"
              >
                <option value="">Unassigned</option>
                {agents.map((agent) => (
                  <option key={agent.id} value={agent.id}>
                    {agent.name}
                    {agent.id === user?.id ? " (you)" : ""}
                  </option>
                ))}
              </select>
            </label>
            <button
              disabled={busy || ticket.assignedAgentUserId === user?.id}
              onClick={() =>
                user && void patch({ assignedAgentUserId: user.id })
              }
              className="w-full rounded-full border border-brand-600 px-3 py-2 text-sm font-semibold text-brand-700 disabled:opacity-50"
            >
              {ticket.assignedAgentUserId === user?.id
                ? "Assigned to you"
                : "Assign to me"}
            </button>
            {ticket.assignedAgent && (
              <p className="text-xs text-slate-500">
                Owner: {ticket.assignedAgent.name}
              </p>
            )}
          </div>
          {ticket.rating !== null && (
            <div className="rounded-2xl border p-4 dark:border-slate-800">
              <h2 className="font-bold">Customer satisfaction</h2>
              <p className="mt-2 font-bold text-amber-500" aria-label={`${ticket.rating} out of 5 stars`}>
                {"★".repeat(ticket.rating)}
                {"☆".repeat(5 - ticket.rating)}
              </p>
              {ticket.ratingComment && (
                <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                  &ldquo;{ticket.ratingComment}&rdquo;
                </p>
              )}
            </div>
          )}
          <div className="rounded-2xl border p-4 dark:border-slate-800">
            <h2 className="font-bold">Previous requests</h2>
            {history.length === 0 ? (
              <p className="mt-2 text-xs text-slate-500">
                No previous requests.
              </p>
            ) : (
              history.map((t) => (
                <Link
                  key={t.id}
                  href={`/admin/support/${t.id}`}
                  className="mt-2 block text-sm text-brand-700"
                >
                  {t.reference} · {t.subject}
                </Link>
              ))
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}
