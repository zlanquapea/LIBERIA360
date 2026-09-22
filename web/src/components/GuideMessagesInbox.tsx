"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  ChatBubbleLeftRightIcon,
  MagnifyingGlassIcon,
} from "@heroicons/react/24/outline";
import { useAuth } from "@/hooks/useAuth";
import {
  getMyGuideConversations,
  type GuideConversationSummary,
} from "@/lib/guides-api";

export function GuideMessagesInbox() {
  const { token, ready, user } = useAuth();
  const [items, setItems] = useState<GuideConversationSummary[]>([]);
  const [query, setQuery] = useState("");
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    if (!ready || !token) return;
    getMyGuideConversations(token)
      .then(setItems)
      .catch(() => {
        setItems([]);
        setLoadError(true);
      });
  }, [ready, token]);

  const filtered = useMemo(
    () =>
      items.filter((item) => {
        const name =
          `${item.guide.slug} ${item.visitor?.name ?? ""} ${item.lastMessage.body}`.toLowerCase();
        return name.includes(query.toLowerCase());
      }),
    [items, query],
  );

  if (!ready || !token) {
    return (
      <main className="mx-auto max-w-2xl px-4 py-12 text-center text-sm text-slate-500">
        Log in to see your conversations.
      </main>
    );
  }

  return (
    <main className="mx-auto min-h-[calc(100vh-5rem)] max-w-3xl px-0 pb-8 sm:px-5 sm:py-6">
      <div className="mb-5 flex items-center justify-between px-4 sm:px-0">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.22em] text-brand-700">
            Your inbox
          </p>
          <h1 className="mt-1 font-display text-3xl font-black">Messages</h1>
        </div>
        <Link href="/guides" className="text-sm font-bold text-brand-700">
          Find a guide
        </Link>
      </div>
      <section className="flex min-h-[680px] flex-col overflow-hidden rounded-none border-y border-slate-200 bg-white shadow-xl dark:border-slate-800 dark:bg-slate-950 sm:rounded-[2rem] sm:border">
        <div className="border-b border-slate-100 p-4 dark:border-slate-800">
          <div className="flex items-center gap-2 rounded-2xl bg-slate-50 px-3 py-2.5 dark:bg-slate-900">
            <MagnifyingGlassIcon className="h-4 w-4 text-slate-400" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search chats"
              className="min-w-0 flex-1 bg-transparent text-sm outline-none"
            />
          </div>
          <p className="mt-3 px-1 text-xs font-bold text-slate-500">
            {filtered.length} saved{" "}
            {filtered.length === 1 ? "conversation" : "conversations"}
          </p>
        </div>
        <div className="flex-1 space-y-1 overflow-y-auto p-2">
          {loadError ? (
            <div className="px-5 py-16 text-center">
              <ChatBubbleLeftRightIcon className="mx-auto h-10 w-10 text-rose-300" />
              <p className="mt-3 font-bold">Messages could not be loaded</p>
              <p className="mt-1 text-xs leading-5 text-slate-500">
                Refresh the page and try again. Your saved conversations have
                not been deleted.
              </p>
            </div>
          ) : filtered.length === 0 ? (
            <div className="px-5 py-16 text-center">
              <ChatBubbleLeftRightIcon className="mx-auto h-10 w-10 text-brand-300" />
              <p className="mt-3 font-bold">No chats yet</p>
              <p className="mt-1 text-xs leading-5 text-slate-500">
                Start a conversation from any guide profile.
              </p>
            </div>
          ) : (
            filtered.map((item) => {
              const name =
                item.visitor?.id === user?.id || !item.visitor
                  ? item.guide.slug.replaceAll("-", " ")
                  : item.visitor.name;
              return (
                <Link
                  key={`${item.guide.id}:${item.visitor?.id}`}
                  href={`/messages/${encodeURIComponent(item.guide.id)}?visitorId=${encodeURIComponent(item.visitor?.id ?? "")}`}
                  className="flex gap-3 rounded-2xl p-4 transition hover:bg-slate-50 dark:hover:bg-slate-900"
                >
                  <span className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-full bg-brand-100 font-black text-brand-800">
                    {item.guide.profileImageUrl &&
                    item.visitor?.id === user?.id ? (
                      <img
                        src={item.guide.profileImageUrl}
                        alt=""
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      name.charAt(0).toUpperCase()
                    )}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center justify-between gap-2">
                      <strong className="truncate text-sm capitalize">
                        {name}
                      </strong>
                      {item.unread && (
                        <span className="h-2 w-2 rounded-full bg-brand-600" />
                      )}
                    </span>
                    <span className="mt-1 block truncate text-sm text-slate-500">
                      {item.lastMessage.body}
                    </span>
                    <span className="mt-1 block text-[10px] text-slate-400">
                      {new Date(
                        item.lastMessage.createdAt,
                      ).toLocaleDateString()}
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
