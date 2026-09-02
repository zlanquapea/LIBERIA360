'use client';

import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import { BellIcon } from '@heroicons/react/24/outline';
import { useAuth } from '@/hooks/useAuth';
import { BrandLoader } from './BrandLoader';
import {
  getUnreadNotificationCount,
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from '@/lib/notifications-api';
import { listMyInvitations } from '@/lib/invitations-api';
import { formatRelativeTime } from '@/lib/format';
import type { Notification } from '@/lib/types';

const POLL_INTERVAL_MS = 30000;
const DROPDOWN_LIMIT = 8;
const PANEL_WIDTH = 320; // matches the old w-80
const VIEWPORT_MARGIN = 8;

// Header's general notification center — the one place both a regular
// traveler and an admin check for "what needs my attention" (Header
// renders globally, including on /admin/* — see AdminLayout, which wraps
// {children} inside the root layout rather than replacing Header/BottomNav).
// This is what replaces AccountLink's old invitation-only dot: a pending
// trip invitation is folded in here as a virtual entry (see
// pendingInvitationCount below) rather than kept as a second, narrower
// indicator next to this one — one bell for everything worth surfacing,
// not two competing ones.
export function NotificationBell() {
  const { user, token, ready } = useAuth();
  const [open, setOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [pendingInvitationCount, setPendingInvitationCount] = useState(0);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loadingFeed, setLoadingFeed] = useState(false);
  const [panelStyle, setPanelStyle] = useState<{ top: number; left: number; width: number } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const refreshCounts = useCallback(() => {
    if (!token) return;
    getUnreadNotificationCount(token)
      .then(setUnreadCount)
      .catch(() => undefined);
    listMyInvitations(token)
      .then((invitations) => setPendingInvitationCount(invitations.length))
      .catch(() => setPendingInvitationCount(0));
  }, [token]);

  useEffect(() => {
    if (!token) {
      setUnreadCount(0);
      setPendingInvitationCount(0);
      return;
    }
    refreshCounts();
    const interval = setInterval(refreshCounts, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [token, refreshCounts]);

  useEffect(() => {
    if (!open) return;
    function onClickAway(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', onClickAway);
    return () => document.removeEventListener('mousedown', onClickAway);
  }, [open]);

  function toggleOpen() {
    const next = !open;
    setOpen(next);
    if (next) {
      // Anchors the dropdown's right edge to the bell button like before,
      // but clamps it within the viewport — the bell isn't always the
      // header's rightmost element (AccountLink sits after it), so
      // right-aligning purely against the button could start the panel
      // off-screen to the left on a narrow phone, clipping its first
      // couple of characters. Computed fresh on each open rather than via
      // CSS alone since the safe position depends on the button's actual
      // location, which varies with what else the header renders (search
      // link, theme toggle, signed-in state).
      const rect = containerRef.current?.getBoundingClientRect();
      if (rect) {
        const width = Math.min(PANEL_WIDTH, window.innerWidth - VIEWPORT_MARGIN * 2);
        const maxLeft = Math.max(window.innerWidth - width - VIEWPORT_MARGIN, VIEWPORT_MARGIN);
        const left = Math.min(Math.max(rect.right - width, VIEWPORT_MARGIN), maxLeft);
        setPanelStyle({ top: rect.bottom + 8, left, width });
      }
    }
    if (next && token) {
      setLoadingFeed(true);
      listNotifications(token, { limit: DROPDOWN_LIMIT })
        .then((page) => setNotifications(page.data))
        .catch(() => setNotifications([]))
        .finally(() => setLoadingFeed(false));
    }
  }

  async function handleOpenNotification(notification: Notification) {
    setOpen(false);
    if (notification.read || !token) return;
    setNotifications((prev) =>
      prev.map((n) => (n.id === notification.id ? { ...n, read: true } : n)),
    );
    setUnreadCount((count) => Math.max(0, count - 1));
    try {
      await markNotificationRead(token, notification.id);
    } catch {
      // Best-effort — the next poll reconciles if this silently failed.
    }
  }

  async function handleMarkAllRead() {
    if (!token) return;
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    setUnreadCount(0);
    try {
      await markAllNotificationsRead(token);
    } catch {
      refreshCounts();
    }
  }

  // Signed-out visitors get nothing here — AccountLink's own "Log in"
  // affordance already covers that state.
  if (!ready || !user) return null;

  const badgeCount = unreadCount + (pendingInvitationCount > 0 ? 1 : 0);
  const isEmpty = !loadingFeed && notifications.length === 0 && pendingInvitationCount === 0;

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={toggleOpen}
        aria-label={badgeCount > 0 ? `Notifications — ${badgeCount} unread` : 'Notifications'}
        aria-expanded={open}
        className="relative flex h-9 w-9 items-center justify-center rounded-full border border-white/30 bg-white/5 text-white/90 transition-colors hover:border-white hover:bg-white hover:text-brand-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-400"
      >
        <BellIcon aria-hidden className="h-5 w-5" />
        {badgeCount > 0 && (
          <span
            aria-hidden
            className="absolute -right-1 -top-1 flex h-4 min-w-[1rem] items-center justify-center rounded-full border-2 border-white bg-flag-500 px-1 text-[10px] font-semibold leading-none text-white dark:border-slate-950"
          >
            {badgeCount > 9 ? '9+' : badgeCount}
          </span>
        )}
      </button>

      {open && panelStyle && (
        <div
          style={{ position: 'fixed', top: panelStyle.top, left: panelStyle.left, width: panelStyle.width }}
          className="z-20 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg dark:border-slate-800 dark:bg-slate-900"
        >
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-2.5 dark:border-slate-800">
            <span className="text-sm font-semibold text-slate-900 dark:text-white">Notifications</span>
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={handleMarkAllRead}
                className="text-xs font-medium text-brand-700 hover:underline dark:text-brand-300"
              >
                Mark all read
              </button>
            )}
          </div>

          <div className="max-h-96 overflow-y-auto">
            {pendingInvitationCount > 0 && (
              <Link
                href="/invitations"
                onClick={() => setOpen(false)}
                className="block border-b border-slate-100 bg-brand-50/60 px-4 py-3 text-sm hover:bg-brand-50 dark:border-slate-800 dark:bg-brand-900/10 dark:hover:bg-brand-900/20"
              >
                <p className="font-medium text-slate-900 dark:text-white">
                  {pendingInvitationCount === 1
                    ? 'You have a trip invitation'
                    : `You have ${pendingInvitationCount} trip invitations`}
                </p>
                <p className="mt-0.5 text-slate-500 dark:text-slate-400">Tap to view and respond.</p>
              </Link>
            )}

            {loadingFeed && (
              <div className="flex items-center justify-center gap-2 px-4 py-6 text-sm text-slate-500 dark:text-slate-400">
                <BrandLoader size="sm" />
                Loading…
              </div>
            )}

            {isEmpty && (
              <p className="px-4 py-6 text-center text-sm text-slate-500 dark:text-slate-400">
                Nothing yet — you&apos;re all caught up.
              </p>
            )}

            {!loadingFeed &&
              notifications.map((notification) => (
                <NotificationRow
                  key={notification.id}
                  notification={notification}
                  onOpen={() => handleOpenNotification(notification)}
                />
              ))}
          </div>

          <Link
            href="/notifications"
            onClick={() => setOpen(false)}
            className="block border-t border-slate-100 px-4 py-2.5 text-center text-sm font-medium text-brand-700 hover:bg-slate-50 dark:border-slate-800 dark:text-brand-300 dark:hover:bg-slate-800/60"
          >
            View all
          </Link>
        </div>
      )}
    </div>
  );
}

function NotificationRow({
  notification,
  onOpen,
}: {
  notification: Notification;
  onOpen: () => void;
}) {
  const className = `block w-full border-b border-slate-100 px-4 py-3 text-left text-sm last:border-b-0 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/60 ${
    notification.read ? '' : 'bg-brand-50/50 dark:bg-brand-900/10'
  }`;
  const body = (
    <>
      <p
        className={`font-medium ${
          notification.read ? 'text-slate-600 dark:text-slate-300' : 'text-slate-900 dark:text-white'
        }`}
      >
        {notification.title}
      </p>
      <p className="mt-0.5 line-clamp-2 text-slate-500 dark:text-slate-400">{notification.body}</p>
      <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">
        {formatRelativeTime(notification.createdAt)}
      </p>
    </>
  );

  if (notification.link) {
    return (
      <Link href={notification.link} onClick={onOpen} className={className}>
        {body}
      </Link>
    );
  }
  return (
    <button type="button" onClick={onOpen} className={className}>
      {body}
    </button>
  );
}
