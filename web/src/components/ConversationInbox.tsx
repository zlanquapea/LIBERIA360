"use client";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  ChatBubbleLeftRightIcon,
  MagnifyingGlassIcon,
  PlusIcon,
} from "@heroicons/react/24/outline";
import { useAuth } from "@/hooks/useAuth";
import { listConversations, type Conversation } from "@/lib/conversations-api";

const CONVERSATION_CATEGORIES = [
  { key: "all", label: "All conversations" },
  { key: "creator", label: "Creators" },
  { key: "guide", label: "Guides" },
  { key: "booking", label: "Bookings" },
  { key: "trip", label: "Trip groups" },
  { key: "food-order", label: "Food orders" },
  { key: "support", label: "Support" },
] as const;

type ConversationCategory = (typeof CONVERSATION_CATEGORIES)[number]["key"];

function matchesCategory(item: Conversation, category: ConversationCategory) {
  if (category === "all") return true;
  const contextType = item.contextType.toLowerCase();
  return category === "food-order"
    ? contextType.includes("food") || contextType.includes("order")
    : contextType.includes(category);
}

export function ConversationInbox() {
  const { token, ready, user } = useAuth();
  const [items, setItems] = useState<Conversation[]>([]);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<ConversationCategory>("all");
  useEffect(() => {
    if (!token) return;
    let alive = true;
    const load = () =>
      listConversations(token)
        .then((data) => alive && setItems(data))
        .catch(() => undefined);
    load();
    const timer = window.setInterval(load, 6000);
    return () => {
      alive = false;
      window.clearInterval(timer);
    };
  }, [token]);
  const filtered = useMemo(
    () =>
      items.filter(
        (item) =>
          matchesCategory(item, category) &&
          `${item.title ?? ""} ${item.lastMessage?.body ?? ""}`
            .toLowerCase()
            .includes(query.toLowerCase()),
      ),
    [items, query, category],
  );
  const unreadByCategory = useMemo(
    () =>
      Object.fromEntries(
        CONVERSATION_CATEGORIES.map((option) => [
          option.key,
          items
            .filter(
              (item) =>
                item.unreadCount > 0 && matchesCategory(item, option.key),
            )
            .reduce((total, item) => total + item.unreadCount, 0),
        ]),
      ) as Record<ConversationCategory, number>,
    [items],
  );
  if (!ready)
    return (
      <div className="p-8 text-center text-slate-500">Loading messages…</div>
    );
  if (!token)
    return (
      <main className="mx-auto max-w-lg px-4 py-16 text-center">
        <ChatBubbleLeftRightIcon className="mx-auto h-12 w-12 text-brand-500" />
        <h1 className="mt-4 text-3xl font-black">Your messages</h1>
        <p className="mt-2 text-slate-500">
          Log in to chat with guides, creators, hosts, and businesses.
        </p>
        <Link
          href="/login?next=/messages"
          className="mt-6 inline-flex rounded-full bg-brand-700 px-6 py-3 font-bold text-white"
        >
          Log in
        </Link>
      </main>
    );
  return (
    <main className="min-h-[calc(100dvh-4rem)] w-full px-0 pb-0">
      <div className="mb-4 flex items-center justify-between px-4 sm:px-0">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.22em] text-brand-700">
            Private chats
          </p>
          <h1 className="mt-1 font-display text-3xl font-black">Messages</h1>
          <p className="mt-1 text-sm text-slate-500">
            {user?.name
              ? `Hey ${user.name.split(" ")[0]}, stay connected.`
              : "Stay connected."}
          </p>
        </div>
        <button
          className="rounded-full bg-brand-700 p-3 text-white"
          aria-label="New message"
        >
          <PlusIcon className="h-5 w-5" />
        </button>
      </div>
      <section className="min-h-[calc(100dvh-9rem)] overflow-hidden border-y border-slate-200 bg-white shadow-xl dark:border-slate-800 dark:bg-slate-950 sm:min-h-[calc(100dvh-8rem)]">
        <div className="border-b border-slate-100 dark:border-slate-800">
          <nav
            aria-label="Conversation categories"
            className="flex gap-2 overflow-x-auto px-4 pb-3 pt-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          >
            {CONVERSATION_CATEGORIES.map((option) => {
              const selected = option.key === category;
              return (
                <button
                  key={option.key}
                  type="button"
                  aria-current={selected ? "page" : undefined}
                  onClick={() => setCategory(option.key)}
                  className={`min-h-9 shrink-0 rounded-full px-4 text-xs font-extrabold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 ${selected ? "bg-brand-800 text-white shadow-sm" : "bg-slate-100 text-slate-600 hover:bg-brand-50 hover:text-brand-800 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-brand-200"}`}
                >
                  {option.label}
                  {unreadByCategory[option.key] > 0 && (
                    <span
                      aria-label={`${unreadByCategory[option.key]} unread`}
                      className={`ml-2 inline-flex min-w-5 items-center justify-center rounded-full px-1.5 py-0.5 text-[10px] leading-none ${selected ? "bg-gold-400 text-brand-950" : "bg-brand-700 text-white"}`}
                    >
                      {unreadByCategory[option.key] > 99
                        ? "99+"
                        : unreadByCategory[option.key]}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
          <div className="mx-4 mb-4 flex items-center gap-2 rounded-2xl bg-slate-50 px-3 py-3 dark:bg-slate-900">
            <MagnifyingGlassIcon className="h-4 w-4 text-slate-400" />
            <input
              aria-label="Search conversations"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search conversations"
              className="min-w-0 flex-1 bg-transparent text-sm outline-none"
            />
          </div>
        </div>
        <div className="divide-y divide-slate-100 dark:divide-slate-800">
          {filtered.length === 0 ? (
            <div className="px-6 py-16 text-center text-sm text-slate-500">
              No conversations yet. Start a chat from a guide or creator
              profile.
            </div>
          ) : (
            filtered.map((item) => {
              const other = item.otherParticipant;
              return (
                <Link
                  key={item.id}
                  href={`/messages/${item.id}`}
                  className="flex gap-3 p-4 transition hover:bg-brand-50 dark:hover:bg-slate-900"
                >
                  <span className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-full bg-brand-100 text-lg font-black text-brand-800">
                    {other?.profileImage || item.avatarUrl ? (
                      <img
                        src={other?.profileImage ?? item.avatarUrl ?? ""}
                        alt=""
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      (other?.name ?? item.title ?? "C").charAt(0).toUpperCase()
                    )}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center justify-between gap-3">
                      <strong className="truncate capitalize">
                        {other?.name ?? item.title ?? "Conversation"}
                      </strong>
                      {item.unreadCount > 0 && (
                        <span className="rounded-full bg-brand-700 px-2 py-0.5 text-[10px] font-black text-white">
                          {item.unreadCount}
                        </span>
                      )}
                    </span>
                    <span className="mt-1 block truncate text-sm text-slate-500">
                      {item.lastMessage?.body ?? "Start the conversation"}
                    </span>
                    <span className="mt-1 block text-[10px] uppercase tracking-wider text-slate-400">
                      {item.contextType}
                    </span>
                  </span>
                </Link>
              );
            })
          )}
        </div>
      </section>
    </main>
  );
}
