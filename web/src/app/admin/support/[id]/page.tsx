"use client";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { useAuth } from "@/hooks/useAuth";
import { SafeImage } from "@/components/SafeImage";
import { ErrorState } from "@/components/admin-ui";
import { getFriendlyErrorMessage } from "@/lib/errors";
import { uploadImage } from "@/lib/uploads-api";
import {
  getCustomerSupportHistory,
  getSupportAgents,
  getSupportMessages,
  getSupportTicket,
  sendSupportMessage,
  updateSupportTicket,
} from "@/lib/support-api";
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
  const [error, setError] = useState("");
  const load = useCallback(async () => {
    if (!token) return;
    try {
      const [nextTicket, nextMessages, nextHistory, nextAgents] =
        await Promise.all([
          getSupportTicket(token, id),
          getSupportMessages(token, id),
          getCustomerSupportHistory(token, id),
          getSupportAgents(token),
        ]);
      setTicket(nextTicket);
      setMessages(nextMessages);
      setHistory(nextHistory);
      setAgents(nextAgents);
      setError("");
    } catch (reason) {
      setError(getFriendlyErrorMessage(reason));
    }
  }, [token, id]);
  useEffect(() => {
    void load();
    const timer = setInterval(() => void load(), 15_000);
    return () => clearInterval(timer);
  }, [load]);
  async function patch(input: Parameters<typeof updateSupportTicket>[2]) {
    if (!token || busy) return;
    setBusy(true);
    setError("");
    try {
      setTicket(await updateSupportTicket(token, id, input));
    } catch (reason) {
      setError(getFriendlyErrorMessage(reason));
    } finally {
      setBusy(false);
    }
  }
  async function addFiles(files: FileList | null) {
    if (!token || !files) return;
    setBusy(true);
    try {
      const urls = await Promise.all(
        Array.from(files)
          .slice(0, 5 - attachments.length)
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
    if (!token || !body.trim() || busy) return;
    setBusy(true);
    setError("");
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
  if (!ticket) return <div>Loading ticket…</div>;
  return (
    <div className="space-y-5">
      {error && <ErrorState message={error} />}
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
                      fallback={null}
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
                  <p className="whitespace-pre-wrap">{m.body}</p>
                  {m.attachments.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-2">
                      {m.attachments.map((url) => (
                        <a
                          href={url}
                          target="_blank"
                          rel="noreferrer"
                          key={url}
                        >
                          <SafeImage
                            src={url}
                            alt="Message attachment"
                            className="h-16 w-16 rounded-lg object-cover"
                            fallback={null}
                          />
                        </a>
                      ))}
                    </div>
                  )}
                  <p className="mt-1 text-[10px] opacity-70">
                    {m.sender.name} · {new Date(m.createdAt).toLocaleString()}
                  </p>
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
                required
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder="Reply to customer…"
                className="w-full rounded-xl border p-3 dark:bg-slate-900"
              />
              <div className="flex items-center justify-between gap-2">
                <label className="cursor-pointer text-sm font-semibold text-brand-700">
                  Add images
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    className="sr-only"
                    onChange={(event) => void addFiles(event.target.files)}
                  />
                </label>
                <button
                  disabled={busy}
                  className="rounded-xl bg-brand-700 px-5 py-2 font-semibold text-white disabled:opacity-50"
                >
                  {busy ? "Sending…" : "Reply"}
                </button>
              </div>
              {attachments.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {attachments.map((url) => (
                    <SafeImage
                      key={url}
                      src={url}
                      alt="Reply attachment"
                      className="h-16 w-16 rounded-lg object-cover"
                      fallback={null}
                    />
                  ))}
                </div>
              )}
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
              disabled={ticket.assignedAgentUserId === user?.id}
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
