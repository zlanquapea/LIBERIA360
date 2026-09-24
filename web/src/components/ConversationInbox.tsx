"use client";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  Bars3Icon,
  ChatBubbleLeftRightIcon,
  MagnifyingGlassIcon,
  PlusIcon,
  XMarkIcon,
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
  const [menuOpen, setMenuOpen] = useState(false);
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
        <div className="relative border-b border-slate-100 p-4 dark:border-slate-800">
          <div className="flex items-center gap-2 rounded-2xl bg-slate-50 px-3 py-3 dark:bg-slate-900">
            <button
              type="button"
              aria-label="Filter conversations by category"
              aria-expanded={menuOpen}
              aria-controls="conversation-category-menu"
              onClick={() => setMenuOpen((open) => !open)}
              className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 ${menuOpen ? "bg-brand-700 text-white" : "text-brand-800 hover:bg-brand-100 dark:text-brand-200 dark:hover:bg-slate-800"}`}
            >
              {menuOpen ? (
                <XMarkIcon aria-hidden className="h-4 w-4" />
              ) : (
                <Bars3Icon aria-hidden className="h-4 w-4" />
              )}
            </button>
            <MagnifyingGlassIcon className="h-4 w-4 text-slate-400" />
            <input
              aria-label="Search conversations"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search conversations"
              className="min-w-0 flex-1 bg-transparent text-sm outline-none"
            />
          </div>
          {menuOpen && (
            <div
              id="conversation-category-menu"
              role="menu"
              aria-label="Conversation categories"
              className="absolute inset-x-4 top-[4.75rem] z-10 rounded-2xl border border-slate-200 bg-white p-2 shadow-xl dark:border-slate-700 dark:bg-slate-900"
            >
              <p className="px-3 pb-1 pt-2 text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">
                Conversation categories
              </p>
              {CONVERSATION_CATEGORIES.map((option) => {
                const selected = option.key === category;
                return (
                  <button
                    key={option.key}
                    type="button"
                    role="menuitemradio"
                    aria-checked={selected}
                    onClick={() => {
                      setCategory(option.key);
                      setMenuOpen(false);
                    }}
                    className={`flex min-h-10 w-full items-center rounded-xl px-3 text-left text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 ${selected ? "bg-brand-50 text-brand-800 dark:bg-brand-950/60 dark:text-brand-200" : "text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-800"}`}
                  >
                    <span
                      aria-hidden
                      className={`mr-2 h-2 w-2 rounded-full ${selected ? "bg-gold-400" : "bg-transparent"}`}
                    />
                    {option.label}
                    {selected && (
                      <span className="ml-auto text-xs font-bold text-brand-600 dark:text-brand-300">
                        Selected
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          )}
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
