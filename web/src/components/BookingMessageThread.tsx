'use client';

import { useEffect, useRef, useState } from 'react';
import { ChatBubbleLeftRightIcon, PaperAirplaneIcon, PencilSquareIcon, TrashIcon } from '@heroicons/react/24/outline';
import { useAuth } from '@/hooks/useAuth';
import { BrandLoader } from './BrandLoader';
import {
  deleteBookingMessage,
  getBookingMessages,
  markBookingMessagesRead,
  sendBookingMessage,
  updateBookingMessage,
} from '@/lib/booking-messages-api';
import { HttpError } from '@/lib/http';
import { ConfirmDialog } from './ConfirmDialog';
import { MessageStatus } from './MessageStatus';
import type { BookingMessage } from '@/lib/types';

// How often to re-poll the thread while it's open, so a read receipt
// (or the other side's reply) shows up without the viewer having to
// close and reopen the booking. No websocket/push infra in this app yet
// (see PWA's web-push module, which is for browser notifications, not
// in-app realtime) — a light poll is the pragmatic stand-in.
const POLL_INTERVAL_MS = 5000;

// A message still in flight — appended to the thread immediately on send
// (product feedback, Aug 2026: "they should be able to see the status,
// sent, deliver and view") so composing feels instant, then replaced by
// the real, persisted BookingMessage once the API confirms it.
interface PendingMessage {
  localId: string;
  body: string;
}

// In-platform note thread on a single booking, between the guest and the
// business owner — the same conversation a `wa.me` link would carry off
// to WhatsApp, but kept here: visible to both sides, and not lost the
// moment someone clears their WhatsApp history.
//
// Lives inside BookingDetailModal now, not inline in a booking list row
// (product feedback, Aug 2026: "don't put the messaging and the booking on
// that one page to make things long ... when you click on a book you can
// see the messaging there") — since opening this thread is already a
// deliberate click into one booking's detail view, it loads and shows
// itself immediately rather than sitting behind its own second toggle.
export default function BookingMessageThread({ bookingId }: { bookingId: string }) {
  const { user, token } = useAuth();
  const [messages, setMessages] = useState<BookingMessage[]>([]);
  const [pending, setPending] = useState<PendingMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const hasUnreadFromOther = useRef(false);

  // Editing one of your own messages — WhatsApp/Messenger convention: only
  // the sender can change it, and doing so is flagged (see
  // updateBookingMessage) rather than silently rewriting what was said, so
  // it's tracked per-message rather than reusing the compose `draft` above.
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  // Deleting one of your own messages — same confirm-before-destructive
  // pattern as everywhere else in the app (CancelBookingButton, trip
  // deletion, ...) rather than an instant, unconfirmed removal.
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;

    async function load(initial: boolean) {
      if (initial) setLoading(true);
      try {
        const data = await getBookingMessages(token as string, bookingId);
        if (cancelled) return;
        setMessages(data);
        hasUnreadFromOther.current = data.some((m) => m.senderUserId !== user?.id && !m.readAt);
        if (hasUnreadFromOther.current) {
          // Fire-and-forget: this is the "viewing the thread" signal, not
          // something the reader needs to wait on or see fail.
          markBookingMessagesRead(token as string, bookingId).catch(() => undefined);
        }
      } catch (err) {
        if (!cancelled && initial) {
          setError(err instanceof HttpError ? err.message : 'Could not load messages.');
        }
      } finally {
        if (!cancelled && initial) setLoading(false);
      }
    }

    load(true);
    const interval = setInterval(() => load(false), POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [token, bookingId, user?.id]);

  async function send() {
    const body = draft.trim();
    if (!body || !token) return;
    const localId = `pending-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    setPending((prev) => [...prev, { localId, body }]);
    setDraft('');
    setSending(true);
    setError(null);
    try {
      const message = await sendBookingMessage(token, bookingId, body);
      setMessages((prev) => [...prev, message]);
      setPending((prev) => prev.filter((p) => p.localId !== localId));
    } catch (err) {
      setPending((prev) => prev.filter((p) => p.localId !== localId));
      setDraft(body); // don't make them retype it
      setError(err instanceof HttpError ? err.message : 'Message could not be sent.');
    } finally {
      setSending(false);
    }
  }

  function startEdit(message: BookingMessage) {
    setEditingId(message.id);
    setEditDraft(message.body ?? '');
    setEditError(null);
  }

  function cancelEdit() {
    setEditingId(null);
    setEditDraft('');
    setEditError(null);
  }

  async function saveEdit() {
    const body = editDraft.trim();
    if (!body || !token || !editingId) return;
    setSavingEdit(true);
    setEditError(null);
    try {
      const updated = await updateBookingMessage(token, bookingId, editingId, body);
      setMessages((prev) => prev.map((m) => (m.id === updated.id ? updated : m)));
      cancelEdit();
    } catch (err) {
      setEditError(err instanceof HttpError ? err.message : 'Could not save the edit.');
    } finally {
      setSavingEdit(false);
    }
  }

  async function confirmDelete() {
    if (!token || !deletingId) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      await deleteBookingMessage(token, bookingId, deletingId);
      const deletedAt = new Date().toISOString();
      setMessages((prev) => prev.map((m) => (m.id === deletingId ? { ...m, body: null, deletedAt } : m)));
      setDeletingId(null);
    } catch (err) {
      setDeleteError(err instanceof HttpError ? err.message : 'Could not delete the message.');
    } finally {
      setDeleting(false);
    }
  }

  if (!token) return null;

  const isEmpty = messages.length === 0 && pending.length === 0;

  return (
    <div className="flex flex-col gap-3">
      <p className="flex items-center gap-1.5 text-sm font-semibold text-slate-700 dark:text-slate-200">
        <ChatBubbleLeftRightIcon aria-hidden className="h-4 w-4 text-brand-600 dark:text-brand-300" />
        Conversation
      </p>

      <div className="flex min-h-[4rem] flex-col gap-2 rounded-xl bg-slate-50 dark:bg-slate-800/40 p-3">
        {loading ? (
          <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
            <BrandLoader size="sm" />
            Loading…
          </div>
        ) : isEmpty ? (
          <p className="text-xs text-slate-500 dark:text-slate-400">No messages yet — say hello 👋</p>
        ) : (
          <ul className="flex flex-col gap-1.5">
            {messages.map((message) => {
              const mine = message.senderUserId === user?.id;
              const deleted = Boolean(message.deletedAt);
              const isEditingThis = editingId === message.id;
              return (
                <li key={message.id} className={`flex flex-col ${mine ? 'items-end' : 'items-start'}`}>
                  {isEditingThis ? (
                    <div className="flex w-full max-w-[85%] flex-col gap-1.5">
                      <textarea
                        value={editDraft}
                        onChange={(e) => setEditDraft(e.target.value)}
                        maxLength={2000}
                        rows={2}
                        autoFocus
                        className="w-full rounded-2xl rounded-br-sm border border-brand-400 bg-white px-3 py-1.5 text-sm text-slate-800 outline-none focus:border-brand-500 dark:border-brand-600 dark:bg-slate-800 dark:text-slate-100"
                      />
                      {editError && <p className="text-[11px] text-flag-700 dark:text-flag-300">{editError}</p>}
                      <div className="flex justify-end gap-3 text-[11px] font-medium">
                        <button
                          type="button"
                          onClick={cancelEdit}
                          disabled={savingEdit}
                          className="text-slate-500 hover:underline dark:text-slate-400"
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          onClick={saveEdit}
                          disabled={savingEdit || !editDraft.trim()}
                          className="text-brand-700 hover:underline disabled:opacity-50 dark:text-brand-300"
                        >
                          {savingEdit ? 'Saving…' : 'Save'}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div
                      className={`max-w-[85%] rounded-2xl px-3 py-1.5 text-sm shadow-sm ${
                        mine
                          ? 'rounded-br-sm bg-brand-700 text-white'
                          : 'rounded-bl-sm bg-white text-slate-800 dark:bg-slate-800 dark:text-slate-100'
                      } ${deleted ? 'italic opacity-70' : ''}`}
                    >
                      {!mine && !deleted && (
                        <p className="text-[11px] font-semibold opacity-70">{message.sender?.name ?? 'Unknown'}</p>
                      )}
                      <p>
                        {deleted ? 'This message was deleted' : message.body}
                        {!deleted && message.editedAt && (
                          <span className={`ml-1 text-[10px] ${mine ? 'text-white/70' : 'text-slate-400 dark:text-slate-500'}`}>
                            (edited)
                          </span>
                        )}
                      </p>
                    </div>
                  )}

                  {mine && !deleted && !isEditingThis && (
                    <div className="mt-0.5 flex items-center gap-2.5 pr-1 text-[11px] text-slate-400 dark:text-slate-500">
                      <button
                        type="button"
                        onClick={() => startEdit(message)}
                        className="flex items-center gap-0.5 hover:text-brand-600 hover:underline dark:hover:text-brand-300"
                      >
                        <PencilSquareIcon aria-hidden className="h-3 w-3" />
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => setDeletingId(message.id)}
                        className="flex items-center gap-0.5 hover:text-flag-600 hover:underline dark:hover:text-flag-400"
                      >
                        <TrashIcon aria-hidden className="h-3 w-3" />
                        Delete
                      </button>
                      <span aria-hidden>·</span>
                      <MessageStatus viewed={Boolean(message.readAt)} />
                    </div>
                  )}
                </li>
              );
            })}
            {pending.map((p) => (
              <li key={p.localId} className="flex flex-col items-end">
                <div className="max-w-[85%] rounded-2xl rounded-br-sm bg-brand-700/70 px-3 py-1.5 text-sm text-white shadow-sm">
                  <p>{p.body}</p>
                </div>
                <div className="mt-0.5 pr-1 text-[11px] text-slate-400 dark:text-slate-500">
                  <MessageStatus sending />
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {error && <p className="text-xs text-flag-700 dark:text-flag-300">{error}</p>}

      <div className="flex items-center gap-2">
        <input
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              send();
            }
          }}
          placeholder="Write a message…"
          maxLength={2000}
          className="flex-1 rounded-full border border-slate-300 dark:border-slate-700 px-4 py-2 text-sm outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
        />
        <button
          type="button"
          aria-label="Send message"
          disabled={sending || !draft.trim()}
          onClick={send}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-700 text-white transition-transform hover:bg-brand-800 disabled:opacity-40 disabled:hover:bg-brand-700 enabled:active:scale-90"
        >
          <PaperAirplaneIcon aria-hidden className="h-4 w-4 -rotate-45" />
        </button>
      </div>

      <ConfirmDialog
        open={deletingId !== null}
        title="Delete this message?"
        description="It'll be replaced with a 'message deleted' notice for both of you."
        confirmLabel="Delete message"
        cancelLabel="Keep message"
        loadingLabel="Deleting…"
        isLoading={deleting}
        error={deleteError}
        onConfirm={confirmDelete}
        onCancel={() => {
          if (deleting) return;
          setDeletingId(null);
          setDeleteError(null);
        }}
      />
    </div>
  );
}
