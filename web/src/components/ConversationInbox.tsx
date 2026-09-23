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

export function ConversationInbox() {
  const { token, ready, user } = useAuth();
  const [items, setItems] = useState<Conversation[]>([]);
  const [query, setQuery] = useState("");
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
      items.filter((item) =>
        `${item.title ?? ""} ${item.lastMessage?.body ?? ""}`
          .toLowerCase()
          .includes(query.toLowerCase()),
      ),
    [items, query],
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
    <main className="mx-auto min-h-[calc(100vh-5rem)] max-w-3xl px-0 pb-8 sm:px-5 sm:py-6">
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
      <section className="overflow-hidden rounded-none border-y border-slate-200 bg-white shadow-xl dark:border-slate-800 dark:bg-slate-950 sm:rounded-[2rem] sm:border">
        <div className="border-b border-slate-100 p-4 dark:border-slate-800">
          <div className="flex items-center gap-2 rounded-2xl bg-slate-50 px-3 py-3 dark:bg-slate-900">
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
              const other = item.participants.find(
                (participant) => participant.id !== user?.id,
              );
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
