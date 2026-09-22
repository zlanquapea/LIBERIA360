"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  ChatBubbleLeftRightIcon,
  MagnifyingGlassIcon,
} from "@heroicons/react/24/outline";
import { useAuth } from "@/hooks/useAuth";
import { getGuide } from "@/lib/api";
import {
  getMyGuideConversations,
  type GuideConversationSummary,
} from "@/lib/guides-api";
import { GuideMessenger } from "./GuideMessenger";

export function GuideMessagesInbox({
  guideId,
  visitorId,
}: {
  guideId?: string;
  visitorId?: string;
}) {
  const { token, ready, user } = useAuth();
  const [items, setItems] = useState<GuideConversationSummary[]>([]);
  const [query, setQuery] = useState("");
  const [selectedGuide, setSelectedGuide] = useState<Awaited<
    ReturnType<typeof getGuide>
  > | null>(null);
  const selected = useMemo(
    () =>
      items.find(
        (item) =>
          item.guide.id === guideId &&
          (!visitorId || item.visitor?.id === visitorId),
      ),
    [guideId, items, visitorId],
  );

  useEffect(() => {
    if (!ready || !token) return;
    getMyGuideConversations(token)
      .then(setItems)
      .catch(() => setItems([]));
  }, [ready, token]);

  useEffect(() => {
    if (!selected) {
      setSelectedGuide(null);
      return;
    }
    getGuide(selected.guide.slug)
      .then(setSelectedGuide)
      .catch(() => setSelectedGuide(null));
  }, [selected]);

  const filtered = items.filter((item) => {
    const name =
      `${item.guide.slug} ${item.visitor?.name ?? ""} ${item.lastMessage.body}`.toLowerCase();
    return name.includes(query.toLowerCase());
  });

  if (!ready || !token) {
    return (
      <main className="mx-auto max-w-2xl px-4 py-12 text-center text-sm text-slate-500">
        Log in to see your conversations.
      </main>
    );
  }

  return (
    <main className="mx-auto min-h-[calc(100vh-5rem)] max-w-6xl px-0 pb-8 sm:px-5 sm:py-6">
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
      <section className="grid min-h-[680px] overflow-hidden rounded-none border-y border-slate-200 bg-white shadow-xl dark:border-slate-800 dark:bg-slate-950 sm:grid-cols-[330px_1fr] sm:rounded-[2rem] sm:border">
        <aside className="flex min-h-[680px] flex-col border-r border-slate-100 bg-slate-50/80 dark:border-slate-800 dark:bg-slate-900/70">
          <div className="border-b border-slate-100 p-4 dark:border-slate-800">
            <div className="flex items-center gap-2 rounded-2xl bg-white px-3 py-2.5 shadow-sm dark:bg-slate-950">
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
            {filtered.length === 0 ? (
              <div className="px-5 py-12 text-center">
                <ChatBubbleLeftRightIcon className="mx-auto h-10 w-10 text-brand-300" />
                <p className="mt-3 font-bold">No chats yet</p>
                <p className="mt-1 text-xs leading-5 text-slate-500">
                  Start a conversation from any guide profile.
                </p>
              </div>
            ) : (
              filtered.map((item) => {
                const active =
                  item.guide.id === guideId &&
                  (!visitorId || item.visitor?.id === visitorId);
                const name =
                  item.visitor?.id === user?.id || !item.visitor
                    ? item.guide.slug.replaceAll("-", " ")
                    : item.visitor.name;
                return (
                  <Link
                    key={`${item.guide.id}:${item.visitor?.id}`}
                    href={`/messages?guideId=${encodeURIComponent(item.guide.id)}&visitorId=${encodeURIComponent(item.visitor?.id ?? "")}`}
                    className={`flex gap-3 rounded-2xl p-3 transition ${active ? "bg-brand-100 dark:bg-brand-950" : "hover:bg-white dark:hover:bg-slate-950"}`}
                  >
                    <span className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-full bg-brand-100 font-black text-brand-800">
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
                      <span className="mt-1 block truncate text-xs text-slate-500">
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
        </aside>
        <div className="hidden min-h-[680px] sm:block">
          {selectedGuide ? (
            <GuideMessenger
              guide={selectedGuide}
              initialVisitorId={visitorId}
            />
          ) : (
            <div className="flex h-full flex-col items-center justify-center px-8 text-center">
              <ChatBubbleLeftRightIcon className="h-14 w-14 text-brand-200" />
              <h2 className="mt-4 font-display text-2xl font-black">
                Choose a conversation
              </h2>
              <p className="mt-2 max-w-sm text-sm leading-6 text-slate-500">
                Select a saved chat from your inbox to continue planning with a
                local guide.
              </p>
            </div>
          )}
        </div>
      </section>
      {selectedGuide && (
        <div className="mt-4 sm:hidden">
          <GuideMessenger guide={selectedGuide} initialVisitorId={visitorId} />
        </div>
      )}
    </main>
  );
}
