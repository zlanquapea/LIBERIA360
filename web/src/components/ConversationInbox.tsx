"use client";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  ChatBubbleLeftRightIcon,
  MagnifyingGlassIcon,
  PencilSquareIcon,
} from "@heroicons/react/24/outline";
import { useAuth } from "@/hooks/useAuth";
import { listInbox, type InboxItem } from "@/lib/conversations-api";

const categories = [
  "All",
  "Unread",
  "Bookings",
  "Creators",
  "Guides",
  "Trip groups",
  "Food orders",
  "Support",
];
const types: Record<string, string> = {
  Bookings: "booking",
  Creators: "creator",
  Guides: "guide",
  "Trip groups": "trip",
  "Food orders": "food",
  Support: "support",
};
export function inboxTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toDateString() === new Date().toDateString()
    ? date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })
    : date.toLocaleDateString([], { month: "short", day: "numeric" });
}
export function ConversationInbox() {
  const { token, ready } = useAuth();
  const [items, setItems] = useState<InboxItem[]>([]);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("All");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [compose, setCompose] = useState(false);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    setItems([]);
    setLoading(true);
    if (!token) return;
    let alive = true;
    const load = () =>
      listInbox(token)
        .then((data) => {
          if (alive) {
            setItems(data);
            setError(false);
          }
        })
        .catch(() => {
          if (alive) setError(true);
        })
        .finally(() => {
          if (alive) setLoading(false);
        });
    void load();
    const timer = window.setInterval(load, 6000);
    return () => {
      alive = false;
      window.clearInterval(timer);
    };
  }, [token, retry]);
  const unread = items.reduce((count, item) => count + item.unreadCount, 0);
  const filtered = useMemo(
    () =>
      items.filter(
        (item) =>
          (category === "All" ||
            (category === "Unread"
              ? item.unreadCount > 0
              : item.contextType.toLowerCase().includes(types[category]))) &&
          `${item.title} ${item.preview} ${item.contextType} ${item.sourceId}`
            .toLowerCase()
            .includes(query.trim().toLowerCase()),
      ),
    [items, category, query],
  );
  if (!ready)
    return (
      <p className="p-8 text-center text-slate-500" role="status">
        Loading messages…
      </p>
    );
  if (!token)
    return (
      <main className="mx-auto max-w-lg px-4 py-16 text-center">
        <ChatBubbleLeftRightIcon className="mx-auto h-10 w-10 text-brand-600" />
        <h1 className="mt-4 text-2xl font-bold">Your messages</h1>
        <p className="mt-2 text-slate-500">
          Connect with guides, creators, hosts, and businesses.
        </p>
        <Link
          href="/login?next=/messages"
          className="mt-6 inline-flex rounded-xl bg-brand-800 px-6 py-3 font-semibold text-white"
        >
          Log in
        </Link>
      </main>
    );
  return (
    <main className="messaging-inbox mx-auto w-full max-w-3xl bg-white pb-24 dark:bg-slate-950 sm:my-6 sm:rounded-2xl sm:border sm:border-slate-200 dark:sm:border-slate-800">
      <header className="flex items-center justify-between px-5 pb-3 pt-5">
        <h1 className="text-2xl font-bold tracking-tight text-slate-950 dark:text-white">
          Messages
        </h1>
        <button
          type="button"
          aria-label="New message"
          aria-expanded={compose}
          aria-controls="new-message-options"
          onClick={() => setCompose(!compose)}
          className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-800 text-white focus-visible:ring-2 focus-visible:ring-gold-400"
        >
          <PencilSquareIcon className="h-5 w-5" />
        </button>
      </header>
      {compose && (
        <div
          id="new-message-options"
          className="mx-5 mb-4 rounded-xl border border-slate-200 p-4 text-sm dark:border-slate-700"
        >
          <p className="mb-3 text-slate-500">
            Choose a profile to start a conversation.
          </p>
          <div className="flex flex-wrap gap-3">
            <Link
              className="font-semibold text-brand-700 dark:text-brand-200"
              href="/creators"
            >
              Find a creator →
            </Link>
            <Link
              className="font-semibold text-brand-700 dark:text-brand-200"
              href="/guides"
            >
              Find a guide →
            </Link>
            <Link
              className="font-semibold text-brand-700 dark:text-brand-200"
              href="/account/bookings"
            >
              My bookings →
            </Link>
          </div>
        </div>
      )}
      <label className="mx-5 flex min-h-11 items-center gap-2 rounded-xl bg-slate-100 px-3 focus-within:ring-2 focus-within:ring-brand-500 dark:bg-slate-900">
        <MagnifyingGlassIcon className="h-4 w-4 shrink-0 text-slate-400" />
        <input
          aria-label="Search messages"
          placeholder="Search messages"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          className="min-w-0 flex-1 bg-transparent py-3 text-base outline-none sm:text-sm"
        />
      </label>
      <nav
        aria-label="Conversation filters"
        className="flex items-center gap-2 px-5 py-3"
      >
        {categories.slice(0, 3).map((label) => (
          <button
            key={label}
            type="button"
            aria-pressed={category === label}
            onClick={() => setCategory(label)}
            className={`min-h-11 rounded-full px-3 text-xs font-semibold sm:px-4 ${category === label ? "bg-brand-800 text-white" : "bg-slate-100 text-slate-600 dark:bg-slate-900 dark:text-slate-300"}`}
          >
            {label}
            {label === "Unread" && unread > 0 && (
              <span className="ml-1">{unread > 99 ? "99+" : unread}</span>
            )}
          </button>
        ))}
        <select
          aria-label="More conversation filters"
          value={categories.slice(3).includes(category) ? category : ""}
          onChange={(event) => setCategory(event.target.value || "All")}
          className="min-h-11 min-w-0 flex-1 rounded-full bg-slate-100 px-2 text-xs font-semibold text-slate-600 dark:bg-slate-900 dark:text-slate-300"
        >
          <option value="">More</option>
          {categories.slice(3).map((label) => (
            <option key={label}>{label}</option>
          ))}
        </select>
      </nav>
      {error && (
        <div
          role="alert"
          className="mx-5 mb-3 rounded-xl bg-rose-50 p-3 text-sm text-rose-700"
        >
          Messages couldn’t refresh.{" "}
          <button
            className="font-semibold underline"
            onClick={() => setRetry((value) => value + 1)}
          >
            Try again
          </button>
        </div>
      )}
      {loading ? (
        <p role="status" className="p-10 text-center text-sm text-slate-500">
          Loading conversations…
        </p>
      ) : filtered.length === 0 ? (
        <div className="px-6 py-16 text-center">
          <ChatBubbleLeftRightIcon className="mx-auto mb-3 h-9 w-9 text-slate-400" />
          <p className="font-semibold">
            {query || category !== "All"
              ? "No matching conversations"
              : "Your conversations start here"}
          </p>
          <p className="mt-2 text-sm text-slate-500">
            {query || category !== "All"
              ? "Try another search or filter."
              : "Use the compose button to find someone to message."}
          </p>
        </div>
      ) : (
        <ul className="divide-y divide-slate-100 dark:divide-slate-800">
          {filtered.map((item) => (
            <li key={item.id}>
              <Link
                href={item.href}
                className={`flex gap-3 px-5 py-4 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-500 ${item.unreadCount > 0 ? "bg-brand-50/70 dark:bg-brand-950/40" : "hover:bg-slate-50 dark:hover:bg-slate-900"}`}
              >
                <span
                  aria-hidden
                  className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-brand-100 text-lg font-semibold text-brand-800"
                >
                  {item.title.charAt(0).toUpperCase()}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-baseline justify-between gap-2">
                    <strong className="truncate text-sm capitalize">
                      {item.title}
                    </strong>
                    <time
                      dateTime={item.updatedAt}
                      className="shrink-0 text-[11px] text-slate-500"
                    >
                      {inboxTime(item.updatedAt)}
                    </time>
                  </span>
                  <span className="mt-1 flex items-center gap-2">
                    <span className="min-w-0 flex-1 truncate text-sm text-slate-500 dark:text-slate-400">
                      {item.preview}
                    </span>
                    {item.unreadCount > 0 && (
                      <span
                        aria-label={`${item.unreadCount} unread messages`}
                        className="flex h-5 min-w-5 items-center justify-center rounded-full bg-brand-800 px-1 text-[10px] font-bold text-white"
                      >
                        {item.unreadCount > 99 ? "99+" : item.unreadCount}
                      </span>
                    )}
                  </span>
                  <span className="mt-1.5 inline-block max-w-full truncate rounded-md bg-brand-50 px-2 py-0.5 text-[10px] capitalize text-brand-700 dark:bg-brand-950 dark:text-brand-200">
                    {item.contextType.replaceAll("-", " ")} ·{" "}
                    {item.sourceId.slice(0, 8)}
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
