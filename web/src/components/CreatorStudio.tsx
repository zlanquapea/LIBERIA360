"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  CalendarDaysIcon,
  ChatBubbleLeftRightIcon,
  PlusIcon,
  PencilSquareIcon,
  PhotoIcon,
} from "@heroicons/react/24/outline";
import { getMyCreatorPosts } from "@/lib/creator-feed-api";
import { getCreatorBookings } from "@/lib/booking-api";
import { listInbox } from "@/lib/conversations-api";
import { CreatorOfferingsManager } from "./CreatorOfferingsManager";
import type { Creator, CreatorPost, Booking } from "@/lib/types";

const panel =
  "rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900";
const primary =
  "inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-brand-700 px-5 py-3 text-sm font-semibold text-white hover:bg-brand-800 dark:bg-emerald-300 dark:text-slate-950 dark:hover:bg-emerald-200";
const action =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-brand-800 hover:bg-slate-100 dark:border-slate-700 dark:text-emerald-300 dark:hover:bg-slate-800";
type Tab = "posts" | "services" | "bookings";

export function CreatorStudio({
  creator,
  token,
  onChange,
  onEditProfile,
}: {
  creator: Creator;
  token: string;
  onChange: (creator: Creator) => void;
  onEditProfile: () => void;
}) {
  const [tab, setTab] = useState<Tab>("posts");
  const [posts, setPosts] = useState<CreatorPost[] | null>(null);
  const [bookings, setBookings] = useState<Booking[] | null>(null);
  const [unread, setUnread] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState<string[]>([]);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    setLoading(true);
    setFailed([]);
    Promise.allSettled([
      getMyCreatorPosts(token),
      getCreatorBookings(token, creator.id),
      listInbox(token),
    ]).then(([p, b, inbox]) => {
      if (!active) return;
      setPosts(p.status === "fulfilled" ? p.value : null);
      setBookings(b.status === "fulfilled" ? b.value : null);
      setUnread(
        inbox.status === "fulfilled"
          ? inbox.value.reduce((sum, item) => sum + item.unreadCount, 0)
          : null,
      );
      setFailed([
        ...(p.status === "rejected" ? ["posts"] : []),
        ...(b.status === "rejected" ? ["bookings"] : []),
        ...(inbox.status === "rejected" ? ["messages"] : []),
      ]);
      setLoading(false);
    });
    return () => {
      active = false;
    };
  }, [token, creator.id, attempt]);
  const pending = bookings?.filter((b) => b.status === "pending").length;
  const summary = (value: number | null | undefined) =>
    loading ? "…" : value == null ? "—" : value.toLocaleString();

  return (
    <section
      aria-label="Creator studio"
      className="flex min-w-0 flex-col gap-6 text-slate-950 dark:text-slate-50"
    >
      <header>
        <p className="text-xs font-semibold uppercase tracking-widest text-brand-700 dark:text-emerald-300">
          Creator dashboard
        </p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight">Your studio</h1>
        <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
          Manage your creative business.
        </p>
      </header>
      <div className="flex min-w-0 items-center gap-3">
        {creator.profileImage ? (
          <img
            src={creator.profileImage}
            alt=""
            className="h-14 w-14 shrink-0 rounded-full object-cover"
          />
        ) : (
          <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-brand-50 font-bold text-brand-800 dark:bg-slate-800 dark:text-emerald-300">
            {creator.name
              .split(" ")
              .map((n) => n[0])
              .slice(0, 2)
              .join("")}
          </span>
        )}
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold">{creator.name}</p>
          <p className="truncate text-sm text-slate-500 dark:text-slate-400">
            @{creator.username}
          </p>
        </div>
        <Link
          href={`/creators/${creator.username}`}
          className="shrink-0 py-3 text-sm font-semibold text-brand-700 dark:text-emerald-300"
        >
          View profile <span aria-hidden>→</span>
        </Link>
      </div>
      <Link href="/creators/me/create" className={primary}>
        <PlusIcon aria-hidden className="h-5 w-5" />
        Create post
      </Link>
      <div className="grid grid-cols-2 gap-3">
        <button
          type="button"
          onClick={() => setTab("bookings")}
          className={`${panel} text-left hover:border-brand-500`}
        >
          <CalendarDaysIcon aria-hidden className="mb-3 h-6 w-6" />
          <span className="block text-2xl font-bold">{summary(pending)}</span>
          <span className="mt-1 block text-sm text-slate-500 dark:text-slate-400">
            Pending bookings
          </span>
        </button>
        <Link href="/messages" className={`${panel} hover:border-brand-500`}>
          <ChatBubbleLeftRightIcon aria-hidden className="mb-3 h-6 w-6" />
          <span className="block text-2xl font-bold">{summary(unread)}</span>
          <span className="mt-1 block text-sm text-slate-500 dark:text-slate-400">
            Unread messages
          </span>
        </Link>
      </div>
      {failed.length > 0 && (
        <div
          role="alert"
          className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-amber-50 p-4 text-sm text-amber-900 dark:bg-amber-950/30 dark:text-amber-200"
        >
          <p>Couldn’t load {failed.join(", ")}. Your content is safe.</p>
          <button
            type="button"
            className="min-h-11 font-semibold underline"
            onClick={() => setAttempt((n) => n + 1)}
          >
            Try again
          </button>
        </div>
      )}
      <div
        role="tablist"
        aria-label="Studio sections"
        className="grid grid-cols-3 border-b border-slate-200 dark:border-slate-800"
      >
        {(["posts", "services", "bookings"] as const).map((id, index) => (
          <button
            key={id}
            type="button"
            role="tab"
            id={`studio-tab-${id}`}
            aria-selected={tab === id}
            aria-controls={`studio-panel-${id}`}
            tabIndex={tab === id ? 0 : -1}
            onClick={() => setTab(id)}
            onKeyDown={(event) => {
              const ids: Tab[] = ["posts", "services", "bookings"];
              const next =
                event.key === "ArrowRight"
                  ? (index + 1) % 3
                  : event.key === "ArrowLeft"
                    ? (index + 2) % 3
                    : event.key === "Home"
                      ? 0
                      : event.key === "End"
                        ? 2
                        : null;
              if (next !== null) {
                event.preventDefault();
                setTab(ids[next]);
                document.getElementById(`studio-tab-${ids[next]}`)?.focus();
              }
            }}
            className={`min-h-12 border-b-2 px-2 text-sm font-semibold capitalize ${tab === id ? "border-brand-700 text-brand-700 dark:border-emerald-300 dark:text-emerald-300" : "border-transparent text-slate-500 dark:text-slate-400"}`}
          >
            {id}
          </button>
        ))}
      </div>
      <div
        id={`studio-panel-${tab}`}
        role="tabpanel"
        aria-labelledby={`studio-tab-${tab}`}
        tabIndex={0}
        className="min-w-0"
      >
        {tab === "posts" && (
          <div className="space-y-4">
            <h2 className="text-xl font-bold">Your posts</h2>
            {loading ? (
              <p role="status" className="text-sm text-slate-500">
                Loading your posts…
              </p>
            ) : posts?.length === 0 ? (
              <div className={`${panel} py-8 text-center`}>
                <PhotoIcon
                  aria-hidden
                  className="mx-auto mb-3 h-8 w-8 text-slate-400"
                />
                <h3 className="font-semibold">Share your first post</h3>
                <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
                  Show people your work with a photo, video, or story.
                </p>
                <Link href="/creators/me/create" className={`${action} mt-4`}>
                  Create post
                </Link>
              </div>
            ) : (
              posts && (
                <ul className="grid gap-3 md:grid-cols-2">
                  {[...posts]
                    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
                    .map((post) => (
                      <li
                        key={post.id}
                        className={`${panel} flex min-w-0 gap-3 !p-3`}
                      >
                        <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-slate-100 dark:bg-slate-800">
                          {post.thumbnailUrl || post.mediaType === "image" ? (
                            <img
                              src={post.thumbnailUrl || post.mediaUrl}
                              alt=""
                              loading="lazy"
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            <span className="text-xs font-semibold capitalize text-slate-500 dark:text-slate-400">
                              {post.mediaType}
                            </span>
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="line-clamp-2 break-words text-sm font-semibold">
                            {post.caption || "Untitled post"}
                          </p>
                          <p className="mt-1 text-xs capitalize text-slate-500 dark:text-slate-400">
                            {post.status} ·{" "}
                            {new Date(post.createdAt).toLocaleDateString("en", {
                              month: "short",
                              day: "numeric",
                            })}
                          </p>
                          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                            {post.likeCount} likes · {post.commentCount}{" "}
                            comments
                          </p>
                          <Link
                            href={`/creators/me/create?edit=${encodeURIComponent(post.id)}`}
                            className="inline-flex min-h-11 items-center gap-1 text-xs font-semibold text-brand-700 dark:text-emerald-300"
                          >
                            <PencilSquareIcon aria-hidden className="h-4 w-4" />
                            Edit
                            <span className="sr-only">
                              {" "}
                              {post.caption || "post"}
                            </span>
                          </Link>
                        </div>
                      </li>
                    ))}
                </ul>
              )
            )}
          </div>
        )}
        <div hidden={tab !== "services"} className="space-y-4">
          <h2 className="text-xl font-bold">Services &amp; experiences</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Manage what people can book with you.
          </p>
          <div className={panel}>
            <CreatorOfferingsManager
              token={token}
              offerings={creator.offerings ?? []}
              onChange={(offerings) => onChange({ ...creator, offerings })}
            />
          </div>
        </div>
        {tab === "bookings" && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-xl font-bold">Booking requests</h2>
              <Link href="/account/bookings" className={action}>
                Open booking inbox →
              </Link>
            </div>
            {loading ? (
              <p role="status">Loading bookings…</p>
            ) : bookings?.length === 0 ? (
              <div className={panel}>
                <p className="font-semibold">No booking requests yet</p>
                <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
                  Requests from your creator profile will appear here.
                </p>
              </div>
            ) : (
              bookings && (
                <ul className="space-y-3">
                  {[...bookings]
                    .sort(
                      (a, b) =>
                        Number(b.status === "pending") -
                          Number(a.status === "pending") ||
                        b.createdAt.localeCompare(a.createdAt),
                    )
                    .map((booking) => (
                      <li key={booking.id} className={panel}>
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <p className="font-semibold">
                            {booking.guest?.name || "Traveler"}
                          </p>
                          <span
                            className={`rounded-full px-3 py-1 text-xs font-semibold capitalize ${booking.status === "pending" ? "bg-amber-50 text-amber-800 dark:bg-amber-950/40 dark:text-amber-200" : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300"}`}
                          >
                            {booking.status}
                          </span>
                        </div>
                        <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
                          {booking.requestedDate.slice(0, 10)}
                          {booking.partySize
                            ? ` · ${booking.partySize} guests`
                            : ""}
                        </p>
                        {booking.notes && (
                          <p className="mt-2 line-clamp-2 break-words text-sm">
                            {booking.notes}
                          </p>
                        )}
                      </li>
                    ))}
                </ul>
              )
            )}
          </div>
        )}
      </div>
      <button type="button" onClick={onEditProfile} className={action}>
        <PencilSquareIcon aria-hidden className="h-5 w-5" />
        Edit creator profile
      </button>
    </section>
  );
}
