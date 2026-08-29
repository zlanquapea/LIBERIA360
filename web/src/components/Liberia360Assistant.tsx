"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ArrowPathIcon,
  ArrowUpIcon,
  ChatBubbleLeftRightIcon,
  MinusIcon,
  SparklesIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";
import {
  FormEvent,
  PointerEvent as ReactPointerEvent,
  useEffect,
  useRef,
  useState,
} from "react";
import {
  askAssistant,
  recordAssistantFeedback,
  type AssistantAction,
  type AssistantFeedbackType,
  type AssistantHistoryMessage,
} from "@/lib/assistant-api";
import { HttpError } from "@/lib/http";

const POSITION_STORAGE_KEY = "liberia360:assistant-position";
const CHAT_STORAGE_KEY = "liberia360:assistant-chat";
const LAUNCHER_SIZE = 58;
const SAFE_EDGE = 10;
const MOBILE_BOTTOM_CLEARANCE = 92;

const QUICK_PROMPTS = [
  "What can I do on LIBERIA360?",
  "How do I add my business?",
  "How does advertising work?",
  "How do bookings work?",
  "How do I become a creator?",
];

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  question?: string;
  source?: "ai" | "knowledge";
  feedback?: AssistantFeedbackType;
  actions?: AssistantAction[];
  followUps?: string[];
}

interface LauncherPosition {
  x: number;
  y: number;
}

interface DragState {
  pointerId: number;
  startX: number;
  startY: number;
  originX: number;
  originY: number;
  currentX: number;
  currentY: number;
  moved: boolean;
}

const welcomeMessage = (): ChatMessage => ({
  id: "welcome",
  role: "assistant",
  content:
    "Hello! I’m the LIBERIA360 Assistant. Ask me how to find places, add a business, advertise, book, plan a trip, or use creator features.",
});

function safeStoredMessages(value: string | null): ChatMessage[] {
  if (!value) return [welcomeMessage()];
  try {
    const parsed = JSON.parse(value) as unknown;
    if (!Array.isArray(parsed)) return [welcomeMessage()];
    const messages = parsed
      .flatMap((item): ChatMessage[] => {
        if (
          !item ||
          typeof item !== "object" ||
          !("id" in item) ||
          !("role" in item) ||
          !("content" in item) ||
          typeof item.id !== "string" ||
          (item.role !== "user" && item.role !== "assistant") ||
          typeof item.content !== "string"
        ) {
          return [];
        }
        const candidate = item as Partial<ChatMessage>;
        const actions = Array.isArray(candidate.actions)
          ? candidate.actions
              .filter(
                (action): action is AssistantAction =>
                  Boolean(action) &&
                  typeof action.id === "string" &&
                  typeof action.label === "string" &&
                  typeof action.href === "string" &&
                  /^\/(?!\/)/.test(action.href),
              )
              .slice(0, 3)
          : undefined;
        const followUps = Array.isArray(candidate.followUps)
          ? candidate.followUps
              .filter((question): question is string => typeof question === "string")
              .map((question) => question.trim().slice(0, 100))
              .filter((question) => question.length >= 4)
              .slice(0, 3)
          : undefined;
        const source = candidate.source === "ai" || candidate.source === "knowledge"
          ? candidate.source
          : undefined;
        const feedback = ["helpful", "not_helpful", "incorrect", "unanswered"].includes(
          candidate.feedback as string,
        )
          ? candidate.feedback
          : undefined;
        return [
          {
            id: item.id.slice(0, 100),
            role: item.role,
            content: item.content.slice(0, 1600),
            question: typeof candidate.question === "string" ? candidate.question.slice(0, 600) : undefined,
            source,
            feedback,
            actions,
            followUps,
          },
        ];
      })
      .slice(-20);
    return messages.length > 0 ? messages : [welcomeMessage()];
  } catch {
    return [welcomeMessage()];
  }
}

function clampPosition(position: LauncherPosition): LauncherPosition {
  if (typeof window === "undefined") return position;
  const bottomClearance = window.innerWidth < 1024 ? MOBILE_BOTTOM_CLEARANCE : SAFE_EDGE;
  return {
    x: Math.min(
      Math.max(position.x, SAFE_EDGE),
      Math.max(SAFE_EDGE, window.innerWidth - LAUNCHER_SIZE - SAFE_EDGE),
    ),
    y: Math.min(
      Math.max(position.y, 68),
      Math.max(68, window.innerHeight - LAUNCHER_SIZE - bottomClearance),
    ),
  };
}

export function Liberia360Assistant() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([welcomeMessage()]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [position, setPosition] = useState<LauncherPosition | null>(null);
  const dragRef = useRef<DragState | null>(null);
  const draggedRef = useRef(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const messageEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMessages(safeStoredMessages(sessionStorage.getItem(CHAT_STORAGE_KEY)));
    try {
      const stored = localStorage.getItem(POSITION_STORAGE_KEY);
      if (stored) setPosition(clampPosition(JSON.parse(stored)));
    } catch {
      localStorage.removeItem(POSITION_STORAGE_KEY);
    }
  }, []);

  useEffect(() => {
    sessionStorage.setItem(CHAT_STORAGE_KEY, JSON.stringify(messages.slice(-20)));
  }, [messages]);

  useEffect(() => {
    function handleResize() {
      setPosition((current) => (current ? clampPosition(current) : current));
    }
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  useEffect(() => {
    if (!open) return;
    inputRef.current?.focus();
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open]);

  useEffect(() => {
    messageEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, loading]);

  function handlePointerDown(event: ReactPointerEvent<HTMLButtonElement>) {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    const rect = event.currentTarget.getBoundingClientRect();
    dragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      originX: rect.left,
      originY: rect.top,
      currentX: rect.left,
      currentY: rect.top,
      moved: false,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function handlePointerMove(event: ReactPointerEvent<HTMLButtonElement>) {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    const deltaX = event.clientX - drag.startX;
    const deltaY = event.clientY - drag.startY;
    if (Math.hypot(deltaX, deltaY) > 5) drag.moved = true;
    if (!drag.moved) return;
    event.preventDefault();
    const nextPosition = clampPosition({
      x: drag.originX + deltaX,
      y: drag.originY + deltaY,
    });
    drag.currentX = nextPosition.x;
    drag.currentY = nextPosition.y;
    setPosition(nextPosition);
  }

  function finishDrag(event: ReactPointerEvent<HTMLButtonElement>) {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    dragRef.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    if (!drag.moved) return;
    draggedRef.current = true;
    const finalPosition = { x: drag.currentX, y: drag.currentY };
    setPosition(finalPosition);
    localStorage.setItem(POSITION_STORAGE_KEY, JSON.stringify(finalPosition));
    window.setTimeout(() => {
      draggedRef.current = false;
    }, 0);
  }

  function handleLauncherClick() {
    if (draggedRef.current) return;
    setOpen((current) => !current);
  }

  function resetConversation() {
    setMessages([welcomeMessage()]);
    setInput("");
    sessionStorage.removeItem(CHAT_STORAGE_KEY);
    window.setTimeout(() => inputRef.current?.focus(), 0);
  }

  async function sendMessage(rawMessage: string) {
    const text = rawMessage.trim();
    if (text.length < 2 || loading) return;

    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      role: "user",
      content: text,
    };
    const history: AssistantHistoryMessage[] = messages
      .filter((message) => message.id !== "welcome")
      .slice(-8)
      .map((message) => ({ role: message.role, content: message.content }));

    setMessages((current) => [...current, userMessage]);
    setInput("");
    setLoading(true);

    try {
      const reply = await askAssistant({
        message: text,
        history,
        currentPath: pathname,
      });
      setMessages((current) => [
        ...current,
        {
          id: `assistant-${Date.now()}`,
          role: "assistant",
          content: reply.answer,
          question: text,
          source: reply.source,
          actions: reply.actions,
          followUps: reply.followUps,
        },
      ]);
    } catch (error) {
      const content =
        error instanceof HttpError && error.status === 429
          ? "You’ve asked several questions quickly. Please wait a moment and try again."
          : "I’m having trouble answering right now. You can still use Search or Account to find the feature you need.";
      setMessages((current) => [
        ...current,
        {
          id: `assistant-error-${Date.now()}`,
          role: "assistant",
          content,
          question: text,
          source: "knowledge",
          actions: [
            { id: "search", label: "Search Liberia", href: "/search" },
            { id: "account", label: "Open account", href: "/account" },
          ],
        },
      ]);
    } finally {
      setLoading(false);
      window.setTimeout(() => inputRef.current?.focus(), 0);
    }
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    void sendMessage(input);
  }

  async function submitFeedback(message: ChatMessage, type: AssistantFeedbackType) {
    if (!message.question || !message.source || message.feedback) return;
    setMessages((current) =>
      current.map((item) =>
        item.id === message.id ? { ...item, feedback: type } : item,
      ),
    );
    try {
      await recordAssistantFeedback({
        type,
        question: message.question,
        answer: message.content,
        source: message.source,
        currentPath: pathname,
      });
    } catch {
      setMessages((current) =>
        current.map((item) =>
          item.id === message.id ? { ...item, feedback: undefined } : item,
        ),
      );
    }
  }

  if (pathname.startsWith("/admin")) return null;

  const launcherStyle = position
    ? { left: position.x, top: position.y }
    : {
        right: "1rem",
        bottom: "calc(5.6rem + env(safe-area-inset-bottom))",
      };

  return (
    <>
      {open && (
        <section
          id="liberia360-assistant-panel"
          role="dialog"
          aria-label="LIBERIA360 Assistant"
          aria-modal="false"
          className="fixed inset-x-3 bottom-[calc(5.35rem+env(safe-area-inset-bottom))] z-[70] flex max-h-[min(70vh,38rem)] min-h-[27rem] flex-col overflow-hidden rounded-3xl border border-brand-100 bg-white shadow-2xl sm:inset-x-auto sm:right-5 sm:w-[24rem] lg:bottom-6 dark:border-slate-700 dark:bg-slate-900"
        >
          <header className="flex items-center gap-3 bg-gradient-to-r from-brand-950 via-brand-900 to-brand-800 px-4 py-3 text-white">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-2 border-gold-300 bg-brand-950 shadow-inner">
              <SparklesIcon aria-hidden className="h-5 w-5 text-gold-300" />
            </span>
            <div className="min-w-0 flex-1">
              <h2 className="truncate font-display text-sm font-bold">
                LIBERIA360 Assistant
              </h2>
              <p className="text-[11px] text-white/75">Your guide to the platform</p>
            </div>
            <button
              type="button"
              onClick={resetConversation}
              aria-label="Start a new conversation"
              className="flex h-11 w-11 items-center justify-center rounded-full text-white/80 transition-colors hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-300"
            >
              <ArrowPathIcon aria-hidden className="h-5 w-5" />
            </button>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Minimize assistant"
              className="flex h-11 w-11 items-center justify-center rounded-full text-white/80 transition-colors hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-300"
            >
              <MinusIcon aria-hidden className="h-5 w-5" />
            </button>
          </header>

          <div className="border-b border-slate-100 px-3 py-2 dark:border-slate-800">
            <div className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {QUICK_PROMPTS.map((prompt) => (
                <button
                  key={prompt}
                  type="button"
                  onClick={() => void sendMessage(prompt)}
                  disabled={loading}
                  className="min-h-10 shrink-0 rounded-full border border-brand-200 bg-brand-50 px-3 text-xs font-semibold text-brand-900 transition-colors hover:border-brand-400 hover:bg-brand-100 disabled:cursor-wait disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 dark:border-brand-700 dark:bg-brand-950 dark:text-brand-100"
                >
                  {prompt}
                </button>
              ))}
            </div>
          </div>

          <div
            aria-live="polite"
            aria-busy={loading}
            className="flex-1 space-y-3 overflow-y-auto bg-slate-50 px-3 py-4 dark:bg-slate-950"
          >
            {messages.map((message) => (
              <article
                key={message.id}
                className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[88%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed shadow-sm ${
                    message.role === "user"
                      ? "rounded-br-md bg-brand-900 text-white"
                      : "rounded-bl-md border border-slate-200 bg-white text-slate-800 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                  }`}
                >
                  <p className="whitespace-pre-wrap">{message.content}</p>
                  {message.role === "assistant" && message.id !== "welcome" && (
                    <div className="mt-2.5 border-t border-slate-100 pt-2 dark:border-slate-700">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[10px] font-medium text-slate-400">
                          {message.source === "knowledge" ? "LIBERIA360 Guide" : "LIBERIA360 Assistant"}
                        </span>
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => void submitFeedback(message, "helpful")}
                            disabled={Boolean(message.feedback)}
                            className={`min-h-8 rounded-lg px-2 text-[11px] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 ${message.feedback === "helpful" ? "bg-green-100 text-green-800" : "text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"}`}
                            aria-label="Mark this answer helpful"
                          >
                            {message.feedback === "helpful" ? "Helpful ✓" : "Helpful"}
                          </button>
                          <button
                            type="button"
                            onClick={() => void submitFeedback(message, "not_helpful")}
                            disabled={Boolean(message.feedback)}
                            className={`min-h-8 rounded-lg px-2 text-[11px] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 ${message.feedback === "not_helpful" ? "bg-amber-100 text-amber-800" : "text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"}`}
                            aria-label="Mark this answer not helpful"
                          >
                            {message.feedback === "not_helpful" ? "Not helpful ✓" : "Not helpful"}
                          </button>
                          <button
                            type="button"
                            onClick={() => void submitFeedback(message, "incorrect")}
                            disabled={Boolean(message.feedback)}
                            className="min-h-8 rounded-lg px-2 text-[11px] font-semibold text-slate-500 transition-colors hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 dark:hover:bg-slate-800"
                            aria-label="Report incorrect answer"
                          >
                            {message.feedback === "incorrect" ? "Reported ✓" : "Report incorrect"}
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                  {message.actions && message.actions.length > 0 && (
                    <div className="mt-2.5 flex flex-wrap gap-2">
                      {message.actions.map((action) => (
                        <Link
                          key={`${message.id}-${action.id}`}
                          href={action.href}
                          onClick={() => setOpen(false)}
                          className="inline-flex min-h-10 items-center rounded-full border border-brand-200 bg-brand-50 px-3 text-xs font-bold text-brand-900 transition-colors hover:bg-brand-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 dark:border-brand-700 dark:bg-brand-950 dark:text-brand-100"
                        >
                          {action.label}
                        </Link>
                      ))}
                    </div>
                  )}
                  {message.followUps && message.followUps.length > 0 && (
                    <div className="mt-2.5 border-t border-slate-100 pt-2 dark:border-slate-700">
                      <p className="mb-1 text-[10px] font-bold uppercase tracking-wide text-slate-400">
                        You can also ask
                      </p>
                      {message.followUps.map((question) => (
                        <button
                          key={`${message.id}-${question}`}
                          type="button"
                          onClick={() => void sendMessage(question)}
                          disabled={loading}
                          className="block min-h-9 w-full rounded-lg px-1.5 py-1 text-left text-xs font-semibold text-brand-700 hover:bg-brand-50 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 dark:text-brand-300 dark:hover:bg-brand-950"
                        >
                          {question}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </article>
            ))}

            {loading && (
              <div className="flex justify-start" role="status">
                <div className="flex items-center gap-1 rounded-2xl rounded-bl-md border border-slate-200 bg-white px-4 py-3 shadow-sm dark:border-slate-700 dark:bg-slate-900">
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-brand-500" />
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-brand-500 [animation-delay:120ms]" />
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-brand-500 [animation-delay:240ms]" />
                  <span className="sr-only">LIBERIA360 Assistant is thinking</span>
                </div>
              </div>
            )}
            <div ref={messageEndRef} />
          </div>

          <form
            onSubmit={handleSubmit}
            className="border-t border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-900"
          >
            <div className="flex items-end gap-2 rounded-2xl border border-slate-300 bg-slate-50 p-1.5 pl-3 focus-within:border-brand-500 focus-within:ring-2 focus-within:ring-brand-100 dark:border-slate-700 dark:bg-slate-950 dark:focus-within:ring-brand-900">
              <input
                ref={inputRef}
                value={input}
                onChange={(event) => setInput(event.target.value.slice(0, 600))}
                placeholder="Ask about LIBERIA360…"
                aria-label="Message LIBERIA360 Assistant"
                disabled={loading}
                className="min-h-10 min-w-0 flex-1 bg-transparent py-2 text-sm text-slate-900 outline-none placeholder:text-slate-400 disabled:opacity-60 dark:text-white"
              />
              <button
                type="submit"
                disabled={loading || input.trim().length < 2}
                aria-label="Send message"
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-green-600 text-white shadow-sm transition-colors hover:bg-green-700 disabled:cursor-not-allowed disabled:bg-slate-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-500 focus-visible:ring-offset-2 dark:disabled:bg-slate-700"
              >
                <ArrowUpIcon aria-hidden className="h-5 w-5 stroke-2" />
              </button>
            </div>
            <p className="mt-1.5 text-center text-[10px] text-slate-400">
              Automated guide • Do not share passwords or payment details
            </p>
          </form>
        </section>
      )}

      <button
        type="button"
        data-testid="assistant-launcher"
        onClick={handleLauncherClick}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={finishDrag}
        onPointerCancel={finishDrag}
        aria-label={open ? "Close LIBERIA360 Assistant" : "Open LIBERIA360 Assistant"}
        aria-expanded={open}
        aria-controls="liberia360-assistant-panel"
        title="LIBERIA360 Assistant — drag to move"
        tabIndex={open ? -1 : 0}
        className={`fixed z-[80] flex h-[58px] w-[58px] touch-none select-none items-center justify-center rounded-full border-2 border-gold-300 bg-gradient-to-br from-brand-800 via-brand-900 to-brand-950 text-white shadow-[0_10px_30px_rgba(8,26,80,0.35)] transition-[box-shadow,opacity,transform] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-gold-300/60 motion-reduce:transform-none ${
          open
            ? "pointer-events-none scale-90 opacity-0"
            : "opacity-100 hover:scale-105 hover:shadow-[0_14px_34px_rgba(8,26,80,0.45)] active:scale-95"
        }`}
        style={launcherStyle}
      >
        {open ? (
          <XMarkIcon aria-hidden className="h-7 w-7" />
        ) : (
          <span className="relative flex items-center justify-center">
            <ChatBubbleLeftRightIcon aria-hidden className="h-7 w-7" />
            <SparklesIcon
              aria-hidden
              className="absolute -right-2 -top-2 h-4 w-4 fill-gold-300 text-gold-300"
            />
          </span>
        )}
        <span className="sr-only">Drag this button to move it around the screen.</span>
      </button>
    </>
  );
}
