'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { BellIcon, CheckCircleIcon } from '@heroicons/react/24/outline';
import { useAuth } from '@/hooks/useAuth';
import { BrandLoader } from '@/components/BrandLoader';
import {
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from '@/lib/notifications-api';
import { formatRelativeTime } from '@/lib/format';
import type { Notification, PaginatedNotifications } from '@/lib/types';

// Full notification history (Section 8's "notification center") — the
// bell in Header is the quick glance at the newest few; this page is
// where the full paginated list lives, same split as the audit log's
// "recent" vs "everything" doesn't need since it's a single admin-only
// feed, but a personal notification history can run long over months of
// bookings/reviews/moderation decisions, so it's paginated the same way
// admin/audit-log is.
export default function NotificationsPage() {
  const { user, token, ready } = useAuth();
  const [page, setPage] = useState(1);
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [result, setResult] = useState<PaginatedNotifications | null>(null);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(() => {
    if (!token) return;
    setLoading(true);
    listNotifications(token, { page, limit: 20, unreadOnly })
      .then(setResult)
      .finally(() => setLoading(false));
  }, [token, page, unreadOnly]);

  useEffect(() => {
    if (!ready || !token) {
      if (ready) setLoading(false);
      return;
    }
    reload();
  }, [ready, token, reload]);

  async function handleMarkRead(notification: Notification) {
    if (!token || notification.read) return;
    setResult((prev) =>
      prev
        ? { ...prev, data: prev.data.map((n) => (n.id === notification.id ? { ...n, read: true } : n)) }
        : prev,
    );
    try {
      await markNotificationRead(token, notification.id);
    } catch {
      reload();
    }
  }

  async function handleMarkAllRead() {
    if (!token) return;
    setResult((prev) => (prev ? { ...prev, data: prev.data.map((n) => ({ ...n, read: true })) } : prev));
    try {
      await markAllNotificationsRead(token);
    } catch {
      reload();
    }
  }

  if (!ready || (loading && !result)) {
    return (
      <main className="flex min-h-[70vh] flex-col items-center justify-center gap-5 px-4">
        <BrandLoader />
        <p className="text-sm font-medium tracking-wide text-slate-500 dark:text-slate-400">Loading…</p>
      </main>
    );
  }

  if (!user || !token) {
    return (
      <main className="mx-auto flex max-w-sm flex-col gap-4 px-4 py-10 text-center">
        <h1 className="text-xl font-bold text-slate-900 dark:text-slate-50">Notifications</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">Log in to see your notifications.</p>
        <Link
          href="/login"
          className="mx-auto rounded-full bg-brand-700 px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-800"
        >
          Log in
        </Link>
      </main>
    );
  }

  const hasUnread = (result?.data ?? []).some((n) => !n.read);

  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-4 px-4 py-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-bold text-slate-900 dark:text-slate-50">Notifications</h1>
        {hasUnread && (
          <button
            type="button"
            onClick={handleMarkAllRead}
            className="flex items-center gap-1.5 rounded-full border border-slate-300 dark:border-slate-700 px-3 py-1.5 text-sm font-medium text-slate-700 dark:text-slate-200 hover:border-brand-500 hover:text-brand-700 dark:hover:text-brand-300"
          >
            <CheckCircleIcon aria-hidden className="h-4 w-4" />
            Mark all read
          </button>
        )}
      </div>

      <label className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
        <input
          type="checkbox"
          checked={unreadOnly}
          onChange={(e) => {
            setUnreadOnly(e.target.checked);
            setPage(1);
          }}
          className="h-4 w-4 rounded border-slate-300 text-brand-700 focus:ring-brand-500 dark:border-slate-600"
        />
        Show unread only
      </label>

      {!result || result.data.length === 0 ? (
        <p className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-slate-300 dark:border-slate-700 px-4 py-10 text-center text-sm text-slate-500 dark:text-slate-400">
          <BellIcon aria-hidden className="h-6 w-6 text-slate-400 dark:text-slate-500" />
          {unreadOnly ? "You're all caught up." : "Nothing here yet."}
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {result.data.map((notification) => (
            <NotificationListItem
              key={notification.id}
              notification={notification}
              onMarkRead={() => handleMarkRead(notification)}
            />
          ))}
        </ul>
      )}

      {result && result.meta.totalPages > 1 && (
        <div className="flex items-center justify-between text-sm">
          <button
            type="button"
            disabled={page <= 1}
            onClick={() => setPage((p) => p - 1)}
            className="rounded-full border border-slate-300 dark:border-slate-700 px-3 py-1.5 font-medium text-slate-700 dark:text-slate-200 hover:border-brand-500 disabled:opacity-40"
          >
            ← Previous
          </button>
          <span className="text-slate-500 dark:text-slate-400">
            Page {result.meta.page} of {result.meta.totalPages}
          </span>
          <button
            type="button"
            disabled={page >= result.meta.totalPages}
            onClick={() => setPage((p) => p + 1)}
            className="rounded-full border border-slate-300 dark:border-slate-700 px-3 py-1.5 font-medium text-slate-700 dark:text-slate-200 hover:border-brand-500 disabled:opacity-40"
          >
            Next →
          </button>
        </div>
      )}
    </main>
  );
}

function NotificationListItem({
  notification,
  onMarkRead,
}: {
  notification: Notification;
  onMarkRead: () => void;
}) {
  const content = (
    <>
      <div className="flex items-start justify-between gap-3">
        <p
          className={`font-medium ${
            notification.read ? 'text-slate-600 dark:text-slate-300' : 'text-slate-900 dark:text-slate-50'
          }`}
        >
          {notification.title}
        </p>
        {!notification.read && (
          <span aria-hidden className="mt-1.5 h-2 w-2 flex-shrink-0 rounded-full bg-flag-500" />
        )}
      </div>
      <p className="text-sm text-slate-500 dark:text-slate-400">{notification.body}</p>
      <p className="text-xs text-slate-400 dark:text-slate-500">{formatRelativeTime(notification.createdAt)}</p>
    </>
  );
  const className = `flex flex-col gap-1 rounded-xl border border-slate-200 dark:border-slate-800 p-3 text-sm transition-colors ${
    notification.read ? '' : 'bg-brand-50/50 dark:bg-brand-900/10'
  }`;

  if (notification.link) {
    return (
      <li>
        <Link href={notification.link} onClick={onMarkRead} className={`block ${className} hover:border-brand-400`}>
          {content}
        </Link>
      </li>
    );
  }
  return (
    <li>
      <button type="button" onClick={onMarkRead} className={`w-full text-left ${className} hover:border-brand-400`}>
        {content}
      </button>
    </li>
  );
}
