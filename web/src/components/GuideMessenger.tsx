"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeftIcon,
  CheckCircleIcon,
  PaperAirplaneIcon,
  PhoneIcon,
  SignalIcon,
} from "@heroicons/react/24/solid";
import { useAuth } from "@/hooks/useAuth";
import { HttpError } from "@/lib/http";
import type { GuideSummary } from "@/lib/api";
import {
  getGuideMessages,
  getMyGuideProfile,
  openGuideChat,
  sendGuideMessage,
  type GuideChatEvent,
  type GuideMessage,
} from "@/lib/guides-api";

export function GuideMessenger({
  guide,
  initialVisitorId,
}: {
  guide: GuideSummary;
  initialVisitorId?: string;
}) {
  const { token, ready, user } = useAuth();
  const [messages, setMessages] = useState<GuideMessage[]>([]);
  const [activeVisitorId, setActiveVisitorId] = useState<string>();
  const [isOwner, setIsOwner] = useState(false);
  const [draft, setDraft] = useState("");
  const [status, setStatus] = useState<
    "offline" | "connecting" | "connected" | "reconnecting"
  >("offline");
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const socketRef = useRef<WebSocket | null>(null);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!ready || !token) return;
    let stopped = false;
    let attempts = 0;

    const load = async () => {
      try {
        const [items, mine] = await Promise.all([
          getGuideMessages(token, guide.id),
          getMyGuideProfile(token).catch(() => null),
        ]);
        setMessages(items);
        setActiveVisitorId(initialVisitorId ?? items[0]?.visitorId);
        setIsOwner(mine?.id === guide.id);
      } catch {
        setError("Your conversations could not be loaded.");
      }
    };
    void load();

    const connect = () => {
      if (stopped) return;
      setStatus(attempts ? "reconnecting" : "connecting");
      const socket = openGuideChat(token, guide.id, (event: GuideChatEvent) => {
        if (event.type === "guide.chat.ready") {
          attempts = 0;
          setStatus("connected");
        } else if (event.type === "guide.message.created") {
          setMessages((current) =>
            current.some((item) => item.id === event.message.id)
              ? current
              : [...current, event.message],
          );
          setActiveVisitorId((current) => current ?? event.message.visitorId);
        } else if (event.type === "guide.chat.error") {
          setError(event.message);
        }
      });
      socketRef.current = socket;
      socket.addEventListener("close", () => {
        if (stopped) return;
        attempts += 1;
        setStatus("reconnecting");
        reconnectTimerRef.current = setTimeout(
          connect,
          Math.min(1000 * 2 ** Math.min(attempts, 4), 15000),
        );
      });
      socket.addEventListener("error", () => setStatus("reconnecting"));
    };
    connect();

    return () => {
      stopped = true;
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
      socketRef.current?.close();
      socketRef.current = null;
    };
  }, [guide.id, initialVisitorId, ready, token]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, activeVisitorId]);

  const conversations = useMemo(() => {
    const grouped = new Map<string, GuideMessage>();
    for (const item of messages) {
      if (
        !grouped.has(item.visitorId) ||
        grouped.get(item.visitorId)!.createdAt < item.createdAt
      ) {
        grouped.set(item.visitorId, item);
      }
    }
    return [...grouped.values()].sort((a, b) =>
      b.createdAt.localeCompare(a.createdAt),
    );
  }, [messages]);

  const conversation = messages.filter(
    (item) =>
      !isOwner || !activeVisitorId || item.visitorId === activeVisitorId,
  );
  const participantName = isOwner
    ? (conversations.find((item) => item.visitorId === activeVisitorId)?.sender
        ?.name ?? "Traveler")
    : guide.slug.replaceAll("-", " ");

  async function submit(event: FormEvent) {
    event.preventDefault();
    const body = draft.trim();
    if (!token || !body || sending) return;
    setSending(true);
    setError(null);
    try {
      const socket = socketRef.current;
      if (socket?.readyState === WebSocket.OPEN) {
        socket.send(
          JSON.stringify({
            type: "guide.message.send",
            guideId: guide.id,
            body,
            visitorId: isOwner ? activeVisitorId : undefined,
          }),
        );
      } else {
        const created = await sendGuideMessage(
          token,
          guide.id,
          body,
          isOwner ? activeVisitorId : undefined,
        );
        setMessages((current) => [...current, created]);
        setActiveVisitorId((current) => current ?? created.visitorId);
      }
      setDraft("");
    } catch (err) {
      setError(
        err instanceof HttpError ? err.message : "Message could not be sent.",
      );
    } finally {
      setSending(false);
    }
  }

  if (!ready) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-10 text-sm text-slate-500">
        Loading messenger…
      </div>
    );
  }
  if (!token) {
    return (
      <main className="mx-auto max-w-lg px-4 py-12">
        <Link
          href={`/guides/${guide.slug}`}
          className="inline-flex items-center gap-2 text-sm font-bold text-brand-700"
        >
          <ArrowLeftIcon className="h-4 w-4" /> Back to {guide.slug}
        </Link>
        <div className="mt-6 overflow-hidden rounded-[2rem] bg-brand-950 p-7 text-white shadow-xl">
          <p className="text-xs font-black uppercase tracking-[0.24em] text-amber-300">
            LIBERIA360 messenger
          </p>
          <h1 className="mt-3 font-display text-3xl font-black">
            Connect with {guide.slug.replaceAll("-", " ")}
          </h1>
          <p className="mt-3 text-sm leading-6 text-teal-100">
            Ask questions, plan your visit, and keep the conversation saved in
            your LIBERIA360 inbox.
          </p>
          <Link
            href={`/login?next=${encodeURIComponent(`/guides/${guide.slug}/messages`)}`}
            className="mt-6 inline-flex rounded-full bg-amber-400 px-5 py-3 text-sm font-black text-slate-950"
          >
            Log in to message
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto flex min-h-[calc(100vh-5rem)] max-w-6xl flex-col px-0 pb-6 sm:px-5 sm:py-6">
      <div className="mb-4 flex items-center justify-between px-4 sm:px-0">
        <Link
          href={`/guides/${guide.slug}`}
          className="inline-flex items-center gap-2 text-sm font-bold text-brand-700"
        >
          <ArrowLeftIcon className="h-4 w-4" /> Guide profile
        </Link>
        {guide.whatsappNumber && !isOwner && (
          <a
            href={`https://wa.me/${guide.whatsappNumber.replace(/\D/g, "")}`}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-2 rounded-full border border-emerald-200 px-3 py-2 text-xs font-black text-emerald-700"
          >
            <PhoneIcon className="h-4 w-4" /> WhatsApp
          </a>
        )}
      </div>
      <section className="grid min-h-[680px] flex-1 overflow-hidden rounded-none border-y border-slate-200 bg-white shadow-xl dark:border-slate-800 dark:bg-slate-950 sm:grid-cols-[270px_1fr] sm:rounded-[2rem] sm:border">
        <aside className="hidden border-r border-slate-100 bg-slate-50/80 p-4 dark:border-slate-800 dark:bg-slate-900/70 sm:block">
          <p className="px-2 text-xs font-black uppercase tracking-[0.2em] text-brand-700">
            Messages
          </p>
          <div className="mt-4 rounded-2xl bg-white p-3 shadow-sm dark:bg-slate-950">
            <div className="flex items-center gap-3">
              <Avatar src={guide.profileImageUrl} name={guide.slug} />
              <div className="min-w-0">
                <p className="truncate text-sm font-black capitalize">
                  {guide.slug.replaceAll("-", " ")}
                </p>
                <p className="text-xs text-slate-500">Guide profile</p>
              </div>
            </div>
          </div>
          {isOwner && (
            <div className="mt-4 space-y-2">
              {conversations.map((item) => (
                <button
                  key={item.visitorId}
                  onClick={() => setActiveVisitorId(item.visitorId)}
                  className={`w-full rounded-2xl p-3 text-left transition ${activeVisitorId === item.visitorId ? "bg-brand-100 dark:bg-brand-950" : "hover:bg-white dark:hover:bg-slate-950"}`}
                >
                  <p className="truncate text-sm font-bold">
                    {item.sender?.name ?? "Traveler"}
                  </p>
                  <p className="mt-1 truncate text-xs text-slate-500">
                    {item.body}
                  </p>
                </button>
              ))}
            </div>
          )}
        </aside>
        <div className="flex min-h-[680px] flex-col">
          <header className="flex items-center justify-between border-b border-slate-100 px-4 py-4 dark:border-slate-800 sm:px-6">
            <div className="flex items-center gap-3">
              <Avatar
                src={isOwner ? undefined : guide.profileImageUrl}
                name={participantName}
              />
              <div>
                <h1 className="font-display text-lg font-black capitalize">
                  {participantName}
                </h1>
                <p className="flex items-center gap-1 text-xs text-slate-500">
                  <span
                    className={`h-2 w-2 rounded-full ${status === "connected" ? "bg-emerald-500" : "bg-amber-400"}`}
                  />{" "}
                  {status === "connected"
                    ? "Active now"
                    : status === "reconnecting"
                      ? "Reconnecting"
                      : "Connecting"}
                </p>
              </div>
            </div>
            <SignalIcon className="h-5 w-5 text-brand-700" />
          </header>
          <div className="flex-1 overflow-y-auto bg-[radial-gradient(circle_at_top,#f0fdfa,transparent_42%)] px-4 py-6 dark:bg-slate-950 sm:px-8">
            <div className="mx-auto max-w-2xl text-center">
              <CheckCircleIcon className="mx-auto h-8 w-8 text-brand-600" />
              <p className="mt-2 text-xs font-bold uppercase tracking-[0.18em] text-slate-400">
                Saved conversation
              </p>
              <p className="mt-1 text-sm text-slate-500">
                Your messages stay here so planning is easy to revisit.
              </p>
            </div>
            <div className="mx-auto mt-8 max-w-2xl space-y-3">
              {conversation.length === 0 ? (
                <div className="rounded-3xl border border-dashed border-slate-300 bg-white/70 p-8 text-center dark:border-slate-700 dark:bg-slate-900/60">
                  <p className="font-display text-xl font-black">
                    Start the conversation
                  </p>
                  <p className="mt-2 text-sm text-slate-500">
                    Ask about availability, local tips, or what to expect.
                  </p>
                </div>
              ) : (
                conversation.map((item) => {
                  const mine = item.senderId === user?.id;
                  return (
                    <div
                      key={item.id}
                      className={`flex ${mine ? "justify-end" : "justify-start"}`}
                    >
                      <div
                        className={`max-w-[82%] rounded-3xl px-4 py-3 text-sm leading-6 shadow-sm ${mine ? "rounded-br-md bg-brand-700 text-white" : "rounded-bl-md bg-white text-slate-800 dark:bg-slate-900 dark:text-slate-100"}`}
                      >
                        <p>{item.body}</p>
                        <p
                          className={`mt-1 text-[10px] ${mine ? "text-teal-100" : "text-slate-400"}`}
                        >
                          {new Date(item.createdAt).toLocaleTimeString([], {
                            hour: "numeric",
                            minute: "2-digit",
                          })}
                        </p>
                      </div>
                    </div>
                  );
                })
              )}
              <div ref={bottomRef} />
            </div>
          </div>
          {error && (
            <p
              role="alert"
              className="border-t border-red-100 bg-red-50 px-4 py-2 text-sm text-red-700"
            >
              {error}
            </p>
          )}
          <form
            onSubmit={submit}
            className="border-t border-slate-100 bg-white p-3 dark:border-slate-800 dark:bg-slate-950 sm:p-4"
          >
            <div className="flex items-end gap-2 rounded-3xl bg-slate-100 p-2 dark:bg-slate-900">
              <textarea
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                rows={1}
                maxLength={4000}
                placeholder="Write a message…"
                className="min-h-11 flex-1 resize-none bg-transparent px-3 py-3 text-sm outline-none"
              />
              <button
                type="submit"
                disabled={!draft.trim() || sending}
                aria-label="Send message"
                className="flex h-11 w-11 items-center justify-center rounded-full bg-brand-700 text-white transition hover:scale-105 disabled:opacity-40"
              >
                <PaperAirplaneIcon className="h-5 w-5" />
              </button>
            </div>
            <p className="mt-2 px-3 text-[11px] text-slate-400">
              Be respectful. Never share passwords or payment details in chat.
            </p>
          </form>
        </div>
      </section>
    </main>
  );
}

function Avatar({ src, name }: { src?: string | null; name: string }) {
  return src ? (
    <img
      src={src}
      alt=""
      className="h-10 w-10 rounded-full border-2 border-amber-300 object-cover"
    />
  ) : (
    <span className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-100 font-black text-brand-800">
      {name.charAt(0).toUpperCase()}
    </span>
  );
}
