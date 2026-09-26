"use client";
import Link from "next/link";
import { Fragment, useEffect, useRef, useState } from "react";
import {
  ArrowLeftIcon,
  FaceSmileIcon,
  MicrophoneIcon,
  PaperClipIcon,
  PaperAirplaneIcon,
  PhoneIcon,
  StopIcon,
} from "@heroicons/react/24/outline";
import { useAuth } from "@/hooks/useAuth";
import {
  getConversation,
  getConversationMessages,
  openConversationSocket,
  sendConversationMessage,
  toggleConversationReaction,
  uploadMessageMedia,
  type ConversationAttachment,
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
  const [attachments, setAttachments] = useState<ConversationAttachment[]>([]);
  const [uploading, setUploading] = useState(false);
  const [toolsOpen, setToolsOpen] = useState(false);
  const [recording, setRecording] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const recordingStreamRef = useRef<MediaStream | null>(null);
  const recordingChunksRef = useRef<Blob[]>([]);
  const socketRef = useRef<WebSocket | null>(null);
  const typingTimerRef = useRef<number | null>(null);
  const pendingBodyRef = useRef<string | null>(null);
  const pendingAttachmentsRef = useRef<ConversationAttachment[]>([]);
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
          if (payload.message.senderId === user?.id) {
            pendingBodyRef.current = null;
            pendingAttachmentsRef.current = [];
          }
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
          if (pendingAttachmentsRef.current.length)
            setAttachments(pendingAttachmentsRef.current);
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
    if (
      !token ||
      (!draft.trim() && attachments.length === 0) ||
      sending ||
      uploading
    )
      return;
    setSending(true);
    setError(null);
    const body = draft.trim();
    const outgoingAttachments = attachments;
    const messageType =
      outgoingAttachments.length === 1
        ? outgoingAttachments[0].kind === "audio"
          ? "voice"
          : outgoingAttachments[0].kind
        : "file";
    setDraft("");
    setAttachments([]);
    const socket = socketRef.current;
    if (socket?.readyState === WebSocket.OPEN) {
      pendingBodyRef.current = body;
      pendingAttachmentsRef.current = outgoingAttachments;
      socket.send(
        JSON.stringify({
          type: "conversation.typing.stop",
        } satisfies ConversationRealtimeClientEvent),
      );
      socket.send(
        JSON.stringify({
          type: "conversation.message.send",
          body,
          messageType,
          attachments: outgoingAttachments,
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
        messageType,
        outgoingAttachments,
      );
      setMessages((current) =>
        current.some((item) => item.id === created.id)
          ? current
          : [...current, created],
      );
    } catch (err) {
      setDraft(body);
      setAttachments(outgoingAttachments);
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
  async function uploadFiles(files: FileList | null) {
    if (!token || !files?.length) return;
    setUploading(true);
    setError(null);
    try {
      const uploaded: ConversationAttachment[] = [];
      for (const file of Array.from(files).slice(0, 10 - attachments.length)) {
        uploaded.push(await uploadMessageMedia(token, file));
      }
      setAttachments((current) => [...current, ...uploaded].slice(0, 10));
    } catch (err) {
      setError(err instanceof HttpError ? err.message : "Media upload failed.");
    } finally {
      setUploading(false);
    }
  }
  async function toggleRecording() {
    if (!token) return;
    if (recording) {
      recorderRef.current?.stop();
      recordingStreamRef.current?.getTracks().forEach((track) => track.stop());
      setRecording(false);
      return;
    }
    if (
      !navigator.mediaDevices?.getUserMedia ||
      typeof MediaRecorder === "undefined"
    ) {
      setError("Voice notes are not supported in this browser.");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = [
        "audio/webm;codecs=opus",
        "audio/ogg;codecs=opus",
        "audio/webm",
      ].find((type) => MediaRecorder.isTypeSupported(type));
      const recorder = new MediaRecorder(
        stream,
        mimeType ? { mimeType } : undefined,
      );
      recordingStreamRef.current = stream;
      recorderRef.current = recorder;
      recordingChunksRef.current = [];
      recorder.ondataavailable = (event) => {
        if (event.data.size) recordingChunksRef.current.push(event.data);
      };
      recorder.onstop = async () => {
        const blob = new Blob(recordingChunksRef.current, {
          type: recorder.mimeType || "audio/webm",
        });
        const file = new File([blob], `voice-note-${Date.now()}.webm`, {
          type: blob.type,
        });
        setUploading(true);
        try {
          const uploaded = await uploadMessageMedia(token, file);
          setAttachments((current) => [...current, uploaded].slice(0, 10));
        } catch (err) {
          setError(
            err instanceof HttpError
              ? err.message
              : "Voice note upload failed.",
          );
        } finally {
          setUploading(false);
          recordingStreamRef.current = null;
          recorderRef.current = null;
        }
      };
      recorder.start();
      setRecording(true);
    } catch {
      setError("Microphone access was not granted.");
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
    <main className="messaging-chat fixed inset-0 z-40 mx-auto flex h-[100dvh] w-full max-w-4xl flex-col bg-white dark:bg-slate-950">
      <section className="flex min-h-0 flex-1 flex-col overflow-hidden border-x border-slate-100 dark:border-slate-800">
        <header className="flex shrink-0 items-center gap-3 border-b border-slate-100 bg-white px-4 py-3 text-slate-950 dark:border-slate-800 dark:bg-slate-950 dark:text-white">
          <Link
            href="/messages"
            aria-label="Back to messages"
            className="rounded-full p-3 hover:bg-slate-100 dark:hover:bg-slate-800"
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
            <small className="text-slate-500 dark:text-slate-400">
              {typingUserId
                ? "typing…"
                : conversation?.contextType === "direct"
                  ? "Active conversation"
                  : `${conversation?.contextType ?? "Private"} chat`}
            </small>
          </span>
          <a
            aria-label={
              other?.phone ? `Call ${other.name}` : "Phone number unavailable"
            }
            href={other?.phone ? `tel:${other.phone}` : undefined}
            aria-disabled={!other?.phone}
            title={
              other?.phone ? `Call ${other.name}` : "No phone number available"
            }
            className={`rounded-full p-3 ${other?.phone ? "hover:bg-slate-100 dark:hover:bg-slate-800" : "cursor-not-allowed opacity-40"}`}
            onClick={(event) => {
              if (!other?.phone) event.preventDefault();
            }}
          >
            <PhoneIcon className="h-5 w-5" />
          </a>
        </header>
        {conversation?.contextId && (
          <div className="flex shrink-0 items-center justify-between gap-3 border-b border-slate-100 bg-slate-50 px-5 py-3 text-xs dark:border-slate-800 dark:bg-slate-900">
            <div className="min-w-0">
              <p className="truncate font-semibold capitalize">
                {conversation.title ??
                  `${conversation.contextType} conversation`}
              </p>
              <p className="mt-1 text-slate-500">
                Reference · {conversation.contextId.slice(0, 8)}
              </p>
            </div>
            {conversation.contextType === "booking" && (
              <Link
                href="/account/bookings"
                className="shrink-0 font-semibold text-brand-700 dark:text-brand-200"
              >
                My bookings →
              </Link>
            )}
          </div>
        )}
        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain bg-white p-4 dark:bg-slate-950 sm:p-6">
          {messages.length === 0 && (
            <div className="mx-auto mt-12 max-w-sm rounded-2xl bg-slate-100 dark:bg-slate-800 p-4 text-center text-xs leading-5 text-slate-600 dark:text-slate-300 shadow-sm">
              Messages are private to this conversation. Say hello and make the
              first move.
            </div>
          )}
          {messages.map((message, index) => {
            const own = message.senderId === user?.id;
            return (
              <Fragment key={message.id}>
                {(index === 0 ||
                  new Date(message.createdAt).toDateString() !==
                    new Date(messages[index - 1].createdAt).toDateString()) && (
                  <p className="py-3 text-center text-[11px] text-slate-500">
                    {new Date(message.createdAt).toLocaleDateString([], {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })}
                  </p>
                )}
                <div
                  className={`group flex ${own ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`relative max-w-[85%] break-words [overflow-wrap:anywhere] rounded-2xl px-3 py-2 text-sm shadow-sm ${own ? "rounded-br-md bg-brand-800 text-white" : "rounded-bl-md bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-100"}`}
                  >
                    {message.attachments?.map((attachment) => (
                      <div
                        key={attachment.url}
                        className="mb-2 overflow-hidden rounded-xl"
                      >
                        {attachment.kind === "image" ? (
                          <a
                            href={attachment.url}
                            target="_blank"
                            rel="noreferrer"
                          >
                            <img
                              src={attachment.url}
                              alt={attachment.name ?? "Shared image"}
                              className="max-h-72 max-w-full object-cover"
                            />
                          </a>
                        ) : attachment.kind === "video" ? (
                          <video
                            controls
                            preload="metadata"
                            poster={attachment.thumbnailUrl ?? undefined}
                            src={attachment.url}
                            className="max-h-72 max-w-full"
                          />
                        ) : attachment.kind === "audio" ? (
                          <audio
                            controls
                            preload="metadata"
                            src={attachment.url}
                            className="max-w-full"
                          />
                        ) : (
                          <a
                            href={attachment.url}
                            target="_blank"
                            rel="noreferrer"
                            className="block px-3 py-2 text-xs font-semibold underline"
                          >
                            {attachment.name ?? "Download attachment"}
                          </a>
                        )}
                      </div>
                    ))}
                    {message.body && (
                      <p className="whitespace-pre-wrap">{message.body}</p>
                    )}
                    <div
                      className={`mt-1 flex items-center justify-end gap-1 text-[10px] ${own ? "text-brand-100" : "text-slate-500 dark:text-slate-400"}`}
                    >
                      <span>
                        {new Date(message.createdAt).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                      {own && (
                        <span
                          aria-label={
                            message.readAt
                              ? "Read"
                              : message.deliveredAt
                                ? "Delivered"
                                : "Sent"
                          }
                          className="font-bold"
                        >
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
              </Fragment>
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
        <div className="shrink-0 border-t border-slate-200 bg-white p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] dark:border-slate-800 dark:bg-slate-950">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*,video/*,audio/*"
            multiple
            className="hidden"
            onChange={(event) => {
              void uploadFiles(event.target.files);
              event.currentTarget.value = "";
            }}
          />
          {attachments.length > 0 && (
            <div className="mb-3 flex gap-2 overflow-x-auto">
              {attachments.map((attachment, index) => (
                <div
                  key={`${attachment.url}-${index}`}
                  className="relative shrink-0 rounded-xl bg-slate-100 p-2 text-xs dark:bg-slate-800"
                >
                  {attachment.kind === "image" ? (
                    <img
                      src={attachment.thumbnailUrl ?? attachment.url}
                      alt={attachment.name ?? "Attachment preview"}
                      className="h-16 w-16 rounded-lg object-cover"
                    />
                  ) : attachment.kind === "audio" ? (
                    <span className="flex h-16 w-24 items-center justify-center font-bold text-brand-700">
                      Voice note
                    </span>
                  ) : (
                    <span className="flex h-16 w-24 items-center justify-center font-bold capitalize text-slate-600">
                      {attachment.kind}
                    </span>
                  )}
                  <button
                    type="button"
                    aria-label={`Remove ${attachment.name ?? "attachment"}`}
                    onClick={() =>
                      setAttachments((current) =>
                        current.filter((_, itemIndex) => itemIndex !== index),
                      )
                    }
                    className="absolute -right-1 -top-1 rounded-full bg-slate-900 px-1.5 text-xs text-white"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}
          {uploading && (
            <p className="mb-2 text-xs font-semibold text-brand-700">
              Uploading media…
            </p>
          )}
          {messages.length === 0 && (
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
          )}
          <div className="relative flex items-end gap-2">
            <button
              type="button"
              aria-label="Message tools"
              aria-expanded={toolsOpen}
              onClick={() => setToolsOpen(!toolsOpen)}
              className="h-11 w-11 shrink-0 rounded-full bg-slate-100 text-xl text-slate-600 dark:bg-slate-800 dark:text-slate-200"
            >
              {toolsOpen ? "×" : "+"}
            </button>
            <div
              className={`${toolsOpen ? "flex" : "hidden"} absolute bottom-full left-3 gap-2 rounded-2xl border border-slate-200 bg-white p-2 shadow-lg dark:border-slate-700 dark:bg-slate-900`}
            >
              <button
                aria-label="Add attachment"
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="rounded-full p-3 text-slate-500 hover:bg-slate-100"
              >
                <PaperClipIcon className="h-5 w-5" />
              </button>
              <button
                aria-label="Add emoji"
                type="button"
                onClick={() => setDraft((current) => `${current} 😊`)}
                className="rounded-full p-3 text-slate-500 hover:bg-slate-100"
              >
                <FaceSmileIcon className="h-5 w-5" />
              </button>
              <button
                aria-label={
                  recording ? "Stop voice note recording" : "Record voice note"
                }
                type="button"
                onClick={() => void toggleRecording()}
                className={`rounded-full p-3 ${recording ? "bg-rose-100 text-rose-700" : "text-slate-500 hover:bg-slate-100"}`}
              >
                {recording ? (
                  <StopIcon className="h-5 w-5" />
                ) : (
                  <MicrophoneIcon className="h-5 w-5" />
                )}
              </button>
            </div>
            <textarea
              aria-label="Message"
              value={draft}
              onChange={(event) => handleDraftChange(event.target.value)}
              onKeyDown={(event) => {
                if (
                  event.key === "Enter" &&
                  !event.shiftKey &&
                  !event.nativeEvent.isComposing
                ) {
                  event.preventDefault();
                  void send();
                }
              }}
              placeholder="Write a message…"
              rows={1}
              className="max-h-28 min-h-11 min-w-0 flex-1 resize-none rounded-2xl bg-slate-100 px-4 py-3 text-base outline-none sm:text-sm focus:ring-2 focus:ring-brand-500 dark:bg-slate-800"
            />
            <button
              onClick={() => void send()}
              disabled={
                (!draft.trim() && attachments.length === 0) ||
                sending ||
                uploading ||
                recording
              }
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
