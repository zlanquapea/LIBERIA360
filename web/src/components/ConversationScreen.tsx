"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import {
  ArrowLeftIcon,
  FaceSmileIcon,
  PaperClipIcon,
  PaperAirplaneIcon,
  PhoneIcon,
  VideoCameraIcon,
} from "@heroicons/react/24/outline";
import { useAuth } from "@/hooks/useAuth";
import {
  getConversation,
  getConversationMessages,
  openConversationSocket,
  sendConversationMessage,
  toggleConversationReaction,
  type Conversation,
  type ConversationMessage,
  type ConversationRealtimeClientEvent,
  type ConversationRealtimeEvent,
} from "@/lib/conversations-api";
import { HttpError } from "@/lib/http";

export function ConversationScreen({
  conversationId,
}: {
  conversationId: string;
}) {
  const { token, ready, user } = useAuth();
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<ConversationMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [typingUserId, setTypingUserId] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const socketRef = useRef<WebSocket | null>(null);
  const typingTimerRef = useRef<number | null>(null);
  const pendingBodyRef = useRef<string | null>(null);
  const other = conversation?.otherParticipant ?? null;
  useEffect(() => {
    if (!token) return;
    let alive = true;
    const load = async () => {
      try {
        const [nextConversation, nextMessages] = await Promise.all([
          getConversation(token, conversationId),
          getConversationMessages(token, conversationId),
        ]);
        if (alive) {
          setConversation(nextConversation);
          setMessages(nextMessages);
        }
      } catch {
        if (alive) setError("This conversation could not be loaded.");
      }
    };
    load();
    const timer = window.setInterval(load, 5000);
    return () => {
      alive = false;
      window.clearInterval(timer);
    };
  }, [token, conversationId]);
  useEffect(() => {
    if (!token) return;
    const socket = openConversationSocket(token, conversationId);
    socketRef.current = socket;
    socket.onopen = () => {
      socket.send(
        JSON.stringify({
          type: "conversation.read",
        } satisfies ConversationRealtimeClientEvent),
      );
    };
    socket.onmessage = (event) => {
      try {
        const payload = JSON.parse(
          event.data as string,
        ) as ConversationRealtimeEvent;
        if (payload.type === "conversation.message.created") {
          setMessages((current) =>
            current.some((item) => item.id === payload.message.id)
              ? current
              : [...current, payload.message],
          );
          if (
            payload.message.senderId !== user?.id &&
            socket.readyState === WebSocket.OPEN
          ) {
            socket.send(
              JSON.stringify({
                type: "conversation.read",
              } satisfies ConversationRealtimeClientEvent),
            );
          }
          if (payload.message.senderId === user?.id)
            pendingBodyRef.current = null;
          setSending(false);
        } else if (payload.type === "conversation.receipt") {
          setMessages((current) =>
            current.map((item) =>
              item.id === payload.messageId
                ? {
                    ...item,
                    deliveredAt: payload.deliveredAt ?? item.deliveredAt,
                    readAt: payload.readAt ?? item.readAt,
                  }
                : item,
            ),
          );
        } else if (
          payload.type === "conversation.typing.start" &&
          payload.userId !== user?.id
        ) {
          setTypingUserId(payload.userId);
        } else if (
          payload.type === "conversation.typing.stop" &&
          payload.userId !== user?.id
        ) {
          setTypingUserId(null);
        } else if (payload.type === "conversation.error") {
          if (pendingBodyRef.current) setDraft(pendingBodyRef.current);
          pendingBodyRef.current = null;
          setSending(false);
          setError(payload.message);
        }
      } catch {
        setError("The realtime chat connection sent an invalid event.");
      }
    };
    socket.onerror = () =>
      setError(
        "Realtime updates are unavailable; sending will use the secure fallback.",
      );
    return () => {
      socket.close();
      socketRef.current = null;
      setTypingUserId(null);
      if (typingTimerRef.current) window.clearTimeout(typingTimerRef.current);
    };
  }, [conversationId, token, user?.id]);
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);
  async function send() {
    if (!token || !draft.trim() || sending) return;
    setSending(true);
    setError(null);
    const body = draft.trim();
    setDraft("");
    const socket = socketRef.current;
    if (socket?.readyState === WebSocket.OPEN) {
      pendingBodyRef.current = body;
      socket.send(
        JSON.stringify({
          type: "conversation.typing.stop",
        } satisfies ConversationRealtimeClientEvent),
      );
      socket.send(
        JSON.stringify({
          type: "conversation.message.send",
          body,
        } satisfies ConversationRealtimeClientEvent),
      );
      setSending(false);
      return;
    }
    try {
      const created = await sendConversationMessage(
        token,
        conversationId,
        body,
      );
      setMessages((current) =>
        current.some((item) => item.id === created.id)
          ? current
          : [...current, created],
      );
    } catch (err) {
      setDraft(body);
      setError(
        err instanceof HttpError ? err.message : "Message could not be sent.",
      );
    } finally {
      setSending(false);
    }
  }
  function handleDraftChange(value: string) {
    setDraft(value);
    const socket = socketRef.current;
    if (!socket || socket.readyState !== WebSocket.OPEN) return;
    socket.send(
      JSON.stringify({
        type: value.trim()
          ? "conversation.typing.start"
          : "conversation.typing.stop",
      } satisfies ConversationRealtimeClientEvent),
    );
    if (typingTimerRef.current) window.clearTimeout(typingTimerRef.current);
    if (value.trim()) {
      typingTimerRef.current = window.setTimeout(() => {
        if (socket.readyState === WebSocket.OPEN)
          socket.send(
            JSON.stringify({
              type: "conversation.typing.stop",
            } satisfies ConversationRealtimeClientEvent),
          );
      }, 2200);
    }
  }
  async function react(messageId: string, emoji: string) {
    if (!token) return;
    const updated = await toggleConversationReaction(
      token,
      messageId,
      emoji,
    ).catch(() => null);
    if (updated)
      setMessages((current) =>
        current.map((item) => (item.id === updated.id ? updated : item)),
      );
  }
  if (!ready || !token)
    return (
      <div className="p-8 text-center text-slate-500">
        Log in to open this chat.
      </div>
    );
  return (
    <main className="flex min-h-[calc(100dvh-4rem)] w-full flex-col px-0 pb-0">
      <section className="flex min-h-[calc(100dvh-4rem)] flex-1 flex-col overflow-hidden border-y border-slate-200 bg-[#efeae2] shadow-xl dark:border-slate-800 dark:bg-slate-900">
        <header className="flex items-center gap-3 bg-brand-950 px-4 py-3 text-white">
          <Link
            href="/messages"
            aria-label="Back to messages"
            className="rounded-full p-2 hover:bg-white/10"
          >
            <ArrowLeftIcon className="h-5 w-5" />
          </Link>
          <span className="flex h-11 w-11 items-center justify-center overflow-hidden rounded-full bg-brand-200 font-black text-brand-900">
            {other?.profileImage || conversation?.avatarUrl ? (
              <img
                src={other?.profileImage ?? conversation?.avatarUrl ?? ""}
                alt=""
                className="h-full w-full object-cover"
              />
            ) : (
              (other?.name ?? conversation?.title ?? "C")
                .charAt(0)
                .toUpperCase()
            )}
          </span>
          <span className="min-w-0 flex-1">
            <strong className="block truncate capitalize">
              {other?.name ?? conversation?.title ?? "Conversation"}
            </strong>
            <small className="text-teal-200">
              {typingUserId
                ? "typing…"
                : conversation?.contextType === "direct"
                  ? "Active conversation"
                  : `${conversation?.contextType} chat`}
            </small>
          </span>
          <button
            aria-label="Voice call"
            className="rounded-full p-2 hover:bg-white/10"
          >
            <PhoneIcon className="h-5 w-5" />
          </button>
          <button
            aria-label="Video call"
            className="rounded-full p-2 hover:bg-white/10"
          >
            <VideoCameraIcon className="h-5 w-5" />
          </button>
        </header>
        <div className="flex-1 space-y-2 overflow-y-auto bg-[radial-gradient(#d6ccc2_1px,transparent_1px)] bg-[size:16px_16px] p-4 dark:bg-[radial-gradient(#334155_1px,transparent_1px)] sm:p-6">
          {messages.length === 0 && (
            <div className="mx-auto mt-12 max-w-sm rounded-2xl bg-amber-100/90 p-4 text-center text-xs leading-5 text-amber-900 shadow-sm">
              Messages are private to this conversation. Say hello and make the
              first move.
            </div>
          )}
          {messages.map((message) => {
            const own = message.senderId === user?.id;
            return (
              <div
                key={message.id}
                className={`group flex ${own ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`relative max-w-[82%] rounded-2xl px-3 py-2 text-sm shadow-sm ${own ? "rounded-br-md bg-[#d9fdd3] text-slate-900" : "rounded-bl-md bg-white text-slate-800 dark:bg-slate-800 dark:text-slate-100"}`}
                >
                  <p className="whitespace-pre-wrap">{message.body}</p>
                  <div className="mt-1 flex items-center justify-end gap-1 text-[10px] text-slate-500">
                    <span>
                      {new Date(message.createdAt).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                    {own && (
                      <span className="font-bold text-brand-700">
                        {message.readAt
                          ? "✓✓"
                          : message.deliveredAt
                            ? "✓✓"
                            : "✓"}
                      </span>
                    )}
                  </div>
                  {Object.entries(message.reactions ?? {})
                    .filter(([, users]) => users.length)
                    .map(([emoji, users]) => (
                      <button
                        key={emoji}
                        onClick={() => void react(message.id, emoji)}
                        className="absolute -bottom-3 left-2 rounded-full border border-slate-200 bg-white px-1.5 py-0.5 text-xs shadow"
                      >
                        {emoji} {users.length}
                      </button>
                    ))}
                  <button
                    onClick={() => void react(message.id, "❤️")}
                    aria-label="React with heart"
                    className="absolute -top-3 right-2 hidden rounded-full bg-white px-1.5 py-0.5 text-xs shadow group-hover:block"
                  >
                    ❤️
                  </button>
                </div>
              </div>
            );
          })}
          <div ref={bottomRef} />
        </div>
        {error && (
          <p
            role="alert"
            className="bg-rose-50 px-4 py-2 text-xs text-rose-700"
          >
            {error}
          </p>
        )}
        <div className="border-t border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-950">
          <div className="mb-2 flex gap-2 overflow-x-auto">
            <button
              onClick={() =>
                setDraft("Hi, I’m interested and would love to learn more.")
              }
              className="whitespace-nowrap rounded-full bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-600"
            >
              Ask a question
            </button>
            <button
              onClick={() => setDraft("Are you available this week?")}
              className="whitespace-nowrap rounded-full bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-600"
            >
              Check availability
            </button>
            <button
              onClick={() => setDraft("Thanks for getting back to me!")}
              className="whitespace-nowrap rounded-full bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-600"
            >
              Say thanks
            </button>
          </div>
          <div className="flex items-end gap-2">
            <button
              aria-label="Add attachment"
              className="rounded-full p-2 text-slate-500 hover:bg-slate-100"
            >
              <PaperClipIcon className="h-5 w-5" />
            </button>
            <button
              aria-label="Add emoji"
              onClick={() => setDraft((current) => `${current} 😊`)}
              className="rounded-full p-2 text-slate-500 hover:bg-slate-100"
            >
              <FaceSmileIcon className="h-5 w-5" />
            </button>
            <textarea
              aria-label="Message"
              value={draft}
              onChange={(event) => handleDraftChange(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault();
                  void send();
                }
              }}
              placeholder="Type a message"
              rows={1}
              className="max-h-28 min-h-11 flex-1 resize-none rounded-2xl bg-slate-100 px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-brand-500 dark:bg-slate-800"
            />
            <button
              onClick={() => void send()}
              disabled={!draft.trim() || sending}
              aria-label="Send message"
              className="rounded-full bg-brand-700 p-3 text-white shadow-lg disabled:opacity-40"
            >
              <PaperAirplaneIcon className="h-5 w-5" />
            </button>
          </div>
        </div>
      </section>
    </main>
  );
}
