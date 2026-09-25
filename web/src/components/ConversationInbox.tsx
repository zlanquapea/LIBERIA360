"use client";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ChatBubbleLeftRightIcon, MagnifyingGlassIcon, PlusIcon } from "@heroicons/react/24/outline";
import { useAuth } from "@/hooks/useAuth";
import { listInbox, type InboxItem } from "@/lib/conversations-api";

const CATEGORIES = [
  { key: "all", label: "All conversations" },
  { key: "creator", label: "Creators" },
  { key: "guide", label: "Guides" },
  { key: "booking", label: "Bookings" },
  { key: "trip", label: "Trip groups" },
  { key: "food-order", label: "Food orders" },
  { key: "support", label: "Support" },
] as const;
type Category = (typeof CATEGORIES)[number]["key"];

function matches(item: InboxItem, category: Category) {
  if (category === "all") return true;
  const type = item.contextType.toLowerCase();
  return category === "food-order" ? type.includes("food") || type.includes("order") : type.includes(category);
}

export function ConversationInbox() {
  const { token, ready, user } = useAuth();
  const [items, setItems] = useState<InboxItem[]>([]);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<Category>("all");
  useEffect(() => {
    if (!token) return;
    let active = true;
    const load = () => listInbox(token).then((data) => active && setItems(data)).catch(() => undefined);
    load();
    const timer = window.setInterval(load, 6000);
    return () => { active = false; window.clearInterval(timer); };
  }, [token]);
  const filtered = useMemo(() => items.filter((item) => matches(item, category) && (item.title + " " + item.preview).toLowerCase().includes(query.toLowerCase())), [items, category, query]);
  const unread = useMemo(() => Object.fromEntries(CATEGORIES.map((option) => [option.key, items.filter((item) => item.unreadCount > 0 && matches(item, option.key)).reduce((sum, item) => sum + item.unreadCount, 0)])) as Record<Category, number>, [items]);
  if (!ready) return <div className="p-8 text-center text-slate-500">Loading messages...</div>;
  if (!token) return <main className="mx-auto max-w-lg px-4 py-16 text-center"><ChatBubbleLeftRightIcon className="mx-auto h-12 w-12 text-brand-500" /><h1 className="mt-4 text-3xl font-black">Your messages</h1><p className="mt-2 text-slate-500">Log in to chat with guides, creators, hosts, and businesses.</p><Link href="/login?next=/messages" className="mt-6 inline-flex rounded-full bg-brand-700 px-6 py-3 font-bold text-white">Log in</Link></main>;
  return (
    <main className="min-h-[calc(100dvh-4rem)] w-full px-0 pb-0">
      <div className="mb-4 flex items-center justify-between px-4 sm:px-0">
        <div><p className="text-xs font-black uppercase tracking-[0.22em] text-brand-700">Private chats</p><h1 className="mt-1 font-display text-3xl font-black">Messages</h1><p className="mt-1 text-sm text-slate-500">{user?.name ? "Hey " + user.name.split(" ")[0] + ", stay connected." : "Stay connected."}</p></div>
        <button className="rounded-full bg-brand-700 p-3 text-white" aria-label="New message"><PlusIcon className="h-5 w-5" /></button>
      </div>
      <section className="min-h-[calc(100dvh-9rem)] overflow-hidden border-y border-slate-200 bg-white shadow-xl dark:border-slate-800 dark:bg-slate-950">
        <div className="border-b border-slate-100 dark:border-slate-800">
          <nav aria-label="Conversation categories" className="flex gap-2 overflow-x-auto px-4 pb-3 pt-4">
            {CATEGORIES.map((option) => { const selected = option.key === category; const count = unread[option.key]; return <button key={option.key} type="button" aria-current={selected ? "page" : undefined} onClick={() => setCategory(option.key)} className={selected ? "min-h-9 shrink-0 rounded-full bg-brand-800 px-4 text-xs font-extrabold text-white" : "min-h-9 shrink-0 rounded-full bg-slate-100 px-4 text-xs font-extrabold text-slate-600"}>{option.label}{count > 0 && <span aria-label={count + " unread"} className="ml-2 inline-flex min-w-5 items-center justify-center rounded-full bg-brand-700 px-1.5 py-0.5 text-[10px] leading-none text-white">{count > 99 ? "99+" : count}</span>}</button>; })}
          </nav>
          <div className="mx-4 mb-4 flex items-center gap-2 rounded-2xl bg-slate-50 px-3 py-3"><MagnifyingGlassIcon className="h-4 w-4 text-slate-400" /><input aria-label="Search conversations" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search conversations" className="min-w-0 flex-1 bg-transparent text-sm outline-none" /></div>
        </div>
        <div className="divide-y divide-slate-100">
          {filtered.length === 0 ? <div className="px-6 py-16 text-center text-sm text-slate-500">No conversations yet. Start a chat from a guide or creator profile.</div> : filtered.map((item) => <Link key={item.id} href={item.href} className="flex gap-3 p-4 transition hover:bg-brand-50"><span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-brand-100 text-lg font-black text-brand-800">{item.title.charAt(0).toUpperCase()}</span><span className="min-w-0 flex-1"><span className="flex items-center justify-between gap-3"><strong className="truncate capitalize">{item.title}</strong>{item.unreadCount > 0 && <span className="rounded-full bg-brand-700 px-2 py-0.5 text-[10px] font-black text-white">{item.unreadCount}</span>}</span><span className="mt-1 block truncate text-sm text-slate-500">{item.preview}</span><span className="mt-1 block text-[10px] uppercase tracking-wider text-slate-400">{item.contextType.replaceAll("-", " ")}</span></span></Link>)}
        </div>
      </section>
    </main>
  );
}
