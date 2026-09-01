'use client';

import { useEffect, useRef, useState } from 'react';
import {
  ArrowUturnLeftIcon,
  ChatBubbleLeftRightIcon,
  ExclamationCircleIcon,
  FaceSmileIcon,
  PaperAirplaneIcon,
  PencilSquareIcon,
  PhotoIcon,
  TrashIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline';
import { useAuth } from '@/hooks/useAuth';
import {
  deleteTripMessage,
  getTripMessages,
  markTripChatDelivered,
  markTripChatRead,
  sendTripMessage,
  toggleTripMessageReaction,
  updateTripMessage,
} from '@/lib/trip-chat-api';
import { uploadImage } from '@/lib/uploads-api';
import { HttpError } from '@/lib/http';
import { resolveImageUrl } from '@/lib/images';
import { ConfirmDialog } from './ConfirmDialog';
import { MessageStatus } from './MessageStatus';
import { SafeImage } from './SafeImage';
import type { TripMessage } from '@/lib/types';

// No websocket/push infra in this app yet (see BookingMessageThread's doc
// comment) — a shorter poll than the 5s used for a two-party booking
// thread, since a live group conversation is a more active surface.
const POLL_INTERVAL_MS = 3000;
const MESSAGE_PAGE_SIZE = 50;
// Must match TripChatService.ALLOWED_REACTIONS on the backend exactly —
// the server is the real enforcement, this is just what the picker offers.
const REACTION_EMOJIS = ['👍', '❤️', '😂', '😮', '😢', '🙏', '🎉'];

// A message still in flight, or one that failed and is waiting on a
// manual retry (Section 10's "retry-on-fail") — `file` is kept around
// (not just its preview) so Retry can re-attempt the exact same upload +
// send without asking the composer to reconstruct anything.
interface PendingMessage {
  localId: string;
  body?: string;
  file: File | null;
  localImagePreview?: string;
  replyTo: TripMessage | null;
  failed: boolean;
  errorMessage?: string;
}

// The trip's group chat (Sections 9-12 of the Aug 2026 social-trip spec)
// — real-time text, image sharing, replies, reactions, delivery/read
// status, and system messages for joins/leaves/updates. Member-only:
// callers are expected to only mount this where the viewer is already
// known to be the trip admin or a collaborator (the backend enforces the
// same boundary regardless).
export function TripChatPanel({ itineraryId }: { itineraryId: string }) {
  const { user, token } = useAuth();
  const [messages, setMessages] = useState<TripMessage[]>([]);
  const [pending, setPending] = useState<PendingMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [hasMoreOlder, setHasMoreOlder] = useState(true);

  const [draft, setDraft] = useState('');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [replyingTo, setReplyingTo] = useState<TripMessage | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const [openReactionPickerId, setOpenReactionPickerId] = useState<string | null>(null);
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null);

  const [newMessagesBelow, setNewMessagesBelow] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);
  const isLoadingOlderRef = useRef(false);
  const messagesRef = useRef<TripMessage[]>([]);
  messagesRef.current = messages;

  // "Near enough to the bottom to be following along" — every poll (every
  // 3s) re-merges the latest page whether or not anything new arrived, so
  // without this a visitor who scrolls up to read earlier messages gets
  // yanked back to the bottom on the very next poll. Scrolling should only
  // ever follow someone who's already at the bottom; someone reading
  // history keeps their place, and sees a "New messages" pill instead.
  const NEAR_BOTTOM_PX = 80;
  function isNearBottom(): boolean {
    const el = scrollRef.current;
    if (!el) return true;
    return el.scrollHeight - el.scrollTop - el.clientHeight < NEAR_BOTTOM_PX;
  }

  useEffect(() => {
    if (!token) return;
    let cancelled = false;

    async function poll(initial: boolean) {
      try {
        const data = await getTripMessages(token as string, itineraryId, { limit: MESSAGE_PAGE_SIZE });
        if (cancelled) return;
        mergeIncoming(data);
        // Fire-and-forget — "delivered" reflects the thread having
        // actually reached this device, "read" that it's visibly open;
        // neither is worth blocking the poll loop on.
        markTripChatDelivered(token as string, itineraryId).catch(() => undefined);
        markTripChatRead(token as string, itineraryId).catch(() => undefined);
      } catch (err) {
        if (!cancelled && initial) {
          setLoadError(err instanceof HttpError ? err.message : 'Could not load the trip chat.');
        }
      } finally {
        if (!cancelled && initial) setLoading(false);
      }
    }

    poll(true);
    const interval = setInterval(() => poll(false), POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, itineraryId]);

  function mergeIncoming(incoming: TripMessage[]) {
    const wasNearBottom = isNearBottom();
    const hasGenuinelyNew = incoming.some((m) => !messagesRef.current.some((existing) => existing.id === m.id));
    setMessages((prev) => {
      const byId = new Map(prev.map((m) => [m.id, m]));
      for (const m of incoming) byId.set(m.id, m);
      return [...byId.values()].sort(
        (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
      );
    });
    // A message that just arrived via poll and carries a clientId
    // matching one of ours means our own optimistic bubble can retire —
    // covers the race where the poll wins against our own POST response.
    setPending((prev) => prev.filter((p) => !incoming.some((m) => m.clientId && m.clientId === p.localId)));
    if (isLoadingOlderRef.current) return;
    if (wasNearBottom) {
      requestAnimationFrame(scrollToBottom);
    } else if (hasGenuinelyNew) {
      setNewMessagesBelow(true);
    }
  }

  function scrollToBottom() {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
    setNewMessagesBelow(false);
  }

  // Clears the "New messages" pill the moment someone scrolls back down on
  // their own, not just when they tap the pill itself.
  function handleScroll() {
    if (newMessagesBelow && isNearBottom()) setNewMessagesBelow(false);
  }

  async function loadOlder() {
    if (!token || messagesRef.current.length === 0) return;
    isLoadingOlderRef.current = true;
    setLoadingOlder(true);
    const el = scrollRef.current;
    const previousHeight = el?.scrollHeight ?? 0;
    try {
      const older = await getTripMessages(token, itineraryId, {
        before: messagesRef.current[0].createdAt,
        limit: MESSAGE_PAGE_SIZE,
      });
      if (older.length < MESSAGE_PAGE_SIZE) setHasMoreOlder(false);
      if (older.length > 0) {
        setMessages((prev) => {
          const byId = new Map(older.map((m) => [m.id, m]));
          const rest = prev.filter((m) => !byId.has(m.id));
          return [...older, ...rest];
        });
        // Keep the viewport anchored on what was already visible instead
        // of jumping to the top once older messages are prepended.
        requestAnimationFrame(() => {
          if (el) el.scrollTop = el.scrollHeight - previousHeight;
        });
      }
    } catch {
      // Not worth a hard error state — "Load earlier" just stays clickable to retry.
    } finally {
      setLoadingOlder(false);
      isLoadingOlderRef.current = false;
    }
  }

  function pickImage(file: File | null) {
    setImageFile(file);
    setImagePreview(file ? URL.createObjectURL(file) : null);
  }

  async function send() {
    const body = draft.trim() || undefined;
    const file = imageFile;
    if (!token || (!body && !file)) return;
    const replyTo = replyingTo;
    const clientId = `local-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    setPending((prev) => [
      ...prev,
      {
        localId: clientId,
        body,
        file,
        localImagePreview: file ? URL.createObjectURL(file) : undefined,
        replyTo,
        failed: false,
      },
    ]);
    setDraft('');
    pickImage(null);
    setReplyingTo(null);
    requestAnimationFrame(scrollToBottom);
    await attemptSend(clientId, body, file, replyTo);
  }

  async function attemptSend(
    clientId: string,
    body: string | undefined,
    file: File | null,
    replyTo: TripMessage | null,
  ) {
    if (!token) return;
    setPending((prev) => prev.map((p) => (p.localId === clientId ? { ...p, failed: false } : p)));
    try {
      const imageUrl = file ? await uploadImage(token, file) : undefined;
      const message = await sendTripMessage(token, itineraryId, {
        body,
        imageUrl,
        replyToMessageId: replyTo?.id,
        clientId,
      });
      setMessages((prev) => (prev.some((m) => m.id === message.id) ? prev : [...prev, message]));
      setPending((prev) => prev.filter((p) => p.localId !== clientId));
      requestAnimationFrame(scrollToBottom);
    } catch (err) {
      setPending((prev) =>
        prev.map((p) =>
          p.localId === clientId
            ? {
                ...p,
                failed: true,
                errorMessage: err instanceof HttpError ? err.message : 'Could not send.',
              }
            : p,
        ),
      );
    }
  }

  function retry(item: PendingMessage) {
    attemptSend(item.localId, item.body, item.file, item.replyTo);
  }

  function startEdit(message: TripMessage) {
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
    if (!token || !editingId || !body) return;
    setSavingEdit(true);
    setEditError(null);
    try {
      const updated = await updateTripMessage(token, itineraryId, editingId, body);
      setMessages((prev) => prev.map((m) => (m.id === updated.id ? updated : m)));
      cancelEdit();
    } catch (err) {
      setEditError(err instanceof HttpError ? err.message : 'Could not save the edit.');
    } finally {
      setSavingEdit(false);
    }
  }

  async function confirmDelete() {
    if (!token || !pendingDeleteId) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      const updated = await deleteTripMessage(token, itineraryId, pendingDeleteId);
      setMessages((prev) => prev.map((m) => (m.id === updated.id ? updated : m)));
      setPendingDeleteId(null);
    } catch (err) {
      setDeleteError(err instanceof HttpError ? err.message : 'Could not delete the message.');
    } finally {
      setDeleting(false);
    }
  }

  async function react(messageId: string, emoji: string) {
    if (!token) return;
    setOpenReactionPickerId(null);
    try {
      const updated = await toggleTripMessageReaction(token, itineraryId, messageId, emoji);
      setMessages((prev) => prev.map((m) => (m.id === updated.id ? updated : m)));
    } catch {
      // A missed tap isn't worth surfacing an error for — the next poll
      // reconciles the real state either way.
    }
  }

  if (!token) return null;

  return (
    <section className="flex flex-col rounded-xl border border-slate-200 dark:border-slate-800">
      <div className="flex items-center gap-1.5 border-b border-slate-100 px-3 py-2.5 dark:border-slate-800">
        <ChatBubbleLeftRightIcon aria-hidden className="h-4 w-4 text-brand-600 dark:text-brand-300" />
        <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">Trip chat</p>
      </div>

      {loading ? (
        <p className="px-3 py-6 text-center text-sm text-slate-500 dark:text-slate-400">Loading…</p>
      ) : loadError && messages.length === 0 ? (
        <p className="mx-3 my-3 rounded-lg bg-flag-500/10 px-3 py-2 text-sm text-flag-700 dark:text-flag-300">{loadError}</p>
      ) : (
        <div className="relative">
          {newMessagesBelow && (
            <button
              type="button"
              onClick={() => requestAnimationFrame(scrollToBottom)}
              className="absolute bottom-2 left-1/2 z-10 -translate-x-1/2 rounded-full bg-brand-700 px-3 py-1 text-xs font-semibold text-white shadow-lg hover:bg-brand-800"
            >
              ↓ New messages
            </button>
          )}
          <div
            ref={scrollRef}
            onScroll={handleScroll}
            className="flex max-h-[28rem] min-h-[10rem] flex-col gap-2 overflow-y-auto px-3 py-3"
          >
          {hasMoreOlder && messages.length > 0 && (
            <button
              type="button"
              onClick={loadOlder}
              disabled={loadingOlder}
              className="mx-auto rounded-full px-3 py-1 text-xs font-medium text-brand-700 hover:underline disabled:opacity-50 dark:text-brand-300"
            >
              {loadingOlder ? 'Loading…' : 'Load earlier messages'}
            </button>
          )}

          {messages.length === 0 && pending.length === 0 ? (
            <p className="my-auto text-center text-xs text-slate-500 dark:text-slate-400">No messages yet — say hello 👋</p>
          ) : (
            messages.map((message) =>
              message.type === 'system' ? (
                <p key={message.id} className="my-1 text-center text-[11px] text-slate-400 dark:text-slate-500">
                  {message.body}
                </p>
              ) : (
                <MessageRow
                  key={message.id}
                  message={message}
                  mine={message.sender?.id === user?.id}
                  editing={editingId === message.id}
                  editDraft={editDraft}
                  onEditDraftChange={setEditDraft}
                  savingEdit={savingEdit}
                  editError={editError}
                  onStartEdit={() => startEdit(message)}
                  onCancelEdit={cancelEdit}
                  onSaveEdit={saveEdit}
                  onDelete={() => setPendingDeleteId(message.id)}
                  onReply={() => setReplyingTo(message)}
                  reactionPickerOpen={openReactionPickerId === message.id}
                  onToggleReactionPicker={() =>
                    setOpenReactionPickerId((current) => (current === message.id ? null : message.id))
                  }
                  onReact={(emoji) => react(message.id, emoji)}
                  onOpenImage={setLightboxSrc}
                  currentUserId={user?.id}
                />
              ),
            )
          )}

          {pending.map((item) => (
            <PendingMessageRow key={item.localId} item={item} onRetry={() => retry(item)} onDiscard={() => setPending((prev) => prev.filter((p) => p.localId !== item.localId))} />
          ))}
          </div>
        </div>
      )}

      {replyingTo && (
        <div className="mx-3 mb-2 flex items-center justify-between gap-2 rounded-lg bg-slate-50 px-3 py-1.5 text-xs dark:bg-slate-800/60">
          <span className="min-w-0 truncate text-slate-500 dark:text-slate-400">
            Replying to <span className="font-medium text-slate-700 dark:text-slate-200">{replyingTo.sender?.name ?? 'a message'}</span>
            {replyingTo.body ? `: ${replyingTo.body}` : replyingTo.imageUrl ? ' (photo)' : ''}
          </span>
          <button
            type="button"
            onClick={() => setReplyingTo(null)}
            aria-label="Cancel reply"
            className="shrink-0 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
          >
            <XMarkIcon aria-hidden className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {imagePreview && (
        <div className="mx-3 mb-2 flex items-center gap-2 rounded-lg bg-slate-50 px-3 py-1.5 dark:bg-slate-800/60">
          {/* eslint-disable-next-line @next/next/no-img-element -- a local blob: preview, not a network image SafeImage is built for */}
          <img src={imagePreview} alt="" className="h-10 w-10 rounded object-cover" />
          <span className="text-xs text-slate-500 dark:text-slate-400">Photo attached</span>
          <button
            type="button"
            onClick={() => pickImage(null)}
            aria-label="Remove photo"
            className="ml-auto text-slate-400 hover:text-flag-700 dark:hover:text-flag-300"
          >
            <XMarkIcon aria-hidden className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      <div className="flex items-center gap-2 px-3 pb-3">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif"
          className="hidden"
          onChange={(e) => pickImage(e.target.files?.[0] ?? null)}
        />
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          aria-label="Attach a photo"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
        >
          <PhotoIcon aria-hidden className="h-5 w-5" />
        </button>
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
          placeholder="Message the trip…"
          maxLength={4000}
          className="flex-1 rounded-full border border-slate-300 dark:border-slate-700 px-4 py-2 text-sm outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
        />
        <button
          type="button"
          aria-label="Send message"
          disabled={!draft.trim() && !imageFile}
          onClick={send}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-700 text-white transition-transform hover:bg-brand-800 disabled:opacity-40 disabled:hover:bg-brand-700 enabled:active:scale-90"
        >
          <PaperAirplaneIcon aria-hidden className="h-4 w-4 -rotate-45" />
        </button>
      </div>

      <ConfirmDialog
        open={pendingDeleteId !== null}
        title="Delete this message?"
        description="It'll be replaced with a 'message deleted' notice for everyone on this trip."
        confirmLabel="Delete message"
        cancelLabel="Keep message"
        loadingLabel="Deleting…"
        isLoading={deleting}
        error={deleteError}
        onConfirm={confirmDelete}
        onCancel={() => {
          if (deleting) return;
          setPendingDeleteId(null);
          setDeleteError(null);
        }}
      />

      {lightboxSrc && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Photo"
          className="fixed inset-0 z-[2100] flex min-h-[100dvh] items-center justify-center bg-black/95 p-4"
          onClick={() => setLightboxSrc(null)}
        >
          <button
            type="button"
            aria-label="Close photo viewer"
            onClick={() => setLightboxSrc(null)}
            className="absolute right-4 top-[calc(1rem+env(safe-area-inset-top))] flex h-11 w-11 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20"
          >
            <XMarkIcon aria-hidden className="h-7 w-7" />
          </button>
          {/* eslint-disable-next-line @next/next/no-img-element -- full-bleed lightbox, deliberately outside SafeImage's card-sized use cases */}
          <img src={lightboxSrc} alt="" className="max-h-[90dvh] max-w-full object-contain" onClick={(e) => e.stopPropagation()} />
        </div>
      )}
    </section>
  );
}

function MessageRow({
  message,
  mine,
  editing,
  editDraft,
  onEditDraftChange,
  savingEdit,
  editError,
  onStartEdit,
  onCancelEdit,
  onSaveEdit,
  onDelete,
  onReply,
  reactionPickerOpen,
  onToggleReactionPicker,
  onReact,
  onOpenImage,
  currentUserId,
}: {
  message: TripMessage;
  mine: boolean;
  editing: boolean;
  editDraft: string;
  onEditDraftChange: (value: string) => void;
  savingEdit: boolean;
  editError: string | null;
  onStartEdit: () => void;
  onCancelEdit: () => void;
  onSaveEdit: () => void;
  onDelete: () => void;
  onReply: () => void;
  reactionPickerOpen: boolean;
  onToggleReactionPicker: () => void;
  onReact: (emoji: string) => void;
  onOpenImage: (src: string) => void;
  currentUserId?: string;
}) {
  const deleted = Boolean(message.deletedAt);
  const hasImage = !deleted && Boolean(message.imageUrl);
  const hasCaption = !deleted && Boolean(message.body);
  const canEditOrDelete = mine && !deleted;

  return (
    <div className={`flex flex-col ${mine ? 'items-end' : 'items-start'}`}>
      {message.replyTo && (
        <div className="mb-0.5 max-w-[85%] rounded-lg border-l-2 border-slate-300 bg-slate-50 px-2 py-1 text-[11px] text-slate-500 dark:border-slate-600 dark:bg-slate-800/60 dark:text-slate-400">
          <span className="font-medium">{message.replyTo.deleted ? 'Deleted message' : message.replyTo.senderName ?? 'Someone'}</span>
          {!message.replyTo.deleted && message.replyTo.body && `: ${message.replyTo.body}`}
          {!message.replyTo.deleted && !message.replyTo.body && message.replyTo.imageUrl && ' 📷 Photo'}
        </div>
      )}

      {editing ? (
        <div className="flex w-full max-w-[85%] flex-col gap-1.5">
          <textarea
            value={editDraft}
            onChange={(e) => onEditDraftChange(e.target.value)}
            maxLength={4000}
            rows={2}
            autoFocus
            className="w-full rounded-2xl rounded-br-sm border border-brand-400 bg-white px-3 py-1.5 text-sm text-slate-800 outline-none focus:border-brand-500 dark:border-brand-600 dark:bg-slate-800 dark:text-slate-100"
          />
          {editError && <p className="text-[11px] text-flag-700 dark:text-flag-300">{editError}</p>}
          <div className="flex justify-end gap-3 text-[11px] font-medium">
            <button type="button" onClick={onCancelEdit} disabled={savingEdit} className="text-slate-500 hover:underline dark:text-slate-400">
              Cancel
            </button>
            <button
              type="button"
              onClick={onSaveEdit}
              disabled={savingEdit || !editDraft.trim()}
              className="text-brand-700 hover:underline disabled:opacity-50 dark:text-brand-300"
            >
              {savingEdit ? 'Saving…' : 'Save'}
            </button>
          </div>
        </div>
      ) : (
        <div
          className={`max-w-[85%] overflow-hidden rounded-2xl text-sm shadow-sm ${
            mine ? 'rounded-br-sm bg-brand-700 text-white' : 'rounded-bl-sm bg-white text-slate-800 dark:bg-slate-800 dark:text-slate-100'
          }`}
        >
          {!mine && !deleted && <p className="px-3 pt-1.5 text-[11px] font-semibold opacity-70">{message.sender?.name ?? 'Unknown'}</p>}
          {deleted ? (
            <p className="px-3 py-1.5 italic opacity-70">This message was deleted</p>
          ) : (
            <>
              {hasImage && (
                <button type="button" onClick={() => onOpenImage(resolveImageUrl(message.imageUrl as string))} className="block w-full">
                  <SafeImage
                    src={resolveImageUrl(message.imageUrl as string)}
                    alt=""
                    className="max-h-64 w-full object-cover"
                    fallback={<div className="flex h-32 items-center justify-center text-xs text-slate-400">Photo unavailable</div>}
                  />
                </button>
              )}
              {hasCaption && (
                <p className="px-3 py-1.5">
                  {message.body}
                  {message.editedAt && (
                    <span className={`ml-1 text-[10px] ${mine ? 'text-white/70' : 'text-slate-400 dark:text-slate-500'}`}>(edited)</span>
                  )}
                </p>
              )}
            </>
          )}
        </div>
      )}

      {!deleted && message.reactions.length > 0 && (
        <div className="mt-1 flex flex-wrap gap-1">
          {message.reactions.map((r) => (
            <button
              key={r.emoji}
              type="button"
              onClick={() => onReact(r.emoji)}
              className={`flex items-center gap-0.5 rounded-full border px-1.5 py-0.5 text-[11px] ${
                currentUserId && r.userIds.includes(currentUserId)
                  ? 'border-brand-400 bg-brand-50 dark:border-brand-600 dark:bg-brand-950/40'
                  : 'border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-800'
              }`}
            >
              <span>{r.emoji}</span>
              <span className="text-slate-500 dark:text-slate-400">{r.count}</span>
            </button>
          ))}
        </div>
      )}

      {!deleted && !editing && (
        <div className="relative mt-0.5 flex items-center gap-2.5 text-[11px] text-slate-400 dark:text-slate-500">
          <button type="button" onClick={onReply} className="flex items-center gap-0.5 hover:text-brand-600 hover:underline dark:hover:text-brand-300">
            <ArrowUturnLeftIcon aria-hidden className="h-3 w-3" />
            Reply
          </button>
          <button
            type="button"
            onClick={onToggleReactionPicker}
            className="flex items-center gap-0.5 hover:text-brand-600 hover:underline dark:hover:text-brand-300"
          >
            <FaceSmileIcon aria-hidden className="h-3 w-3" />
            React
          </button>
          {canEditOrDelete && hasCaption && (
            <button type="button" onClick={onStartEdit} className="flex items-center gap-0.5 hover:text-brand-600 hover:underline dark:hover:text-brand-300">
              <PencilSquareIcon aria-hidden className="h-3 w-3" />
              Edit
            </button>
          )}
          {canEditOrDelete && (
            <button type="button" onClick={onDelete} className="flex items-center gap-0.5 hover:text-flag-600 hover:underline dark:hover:text-flag-400">
              <TrashIcon aria-hidden className="h-3 w-3" />
              Delete
            </button>
          )}
          {mine && <MessageStatus status={message.status} />}

          {reactionPickerOpen && (
            <div
              className={`absolute bottom-full z-10 mb-1 flex gap-1 rounded-full border border-slate-200 bg-white p-1 shadow-lg dark:border-slate-700 dark:bg-slate-900 ${mine ? 'right-0' : 'left-0'}`}
            >
              {REACTION_EMOJIS.map((emoji) => (
                <button
                  key={emoji}
                  type="button"
                  onClick={() => onReact(emoji)}
                  className="flex h-7 w-7 items-center justify-center rounded-full text-base hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  {emoji}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function PendingMessageRow({
  item,
  onRetry,
  onDiscard,
}: {
  item: PendingMessage;
  onRetry: () => void;
  onDiscard: () => void;
}) {
  return (
    <div className="flex flex-col items-end">
      <div className={`max-w-[85%] overflow-hidden rounded-2xl rounded-br-sm text-sm text-white shadow-sm ${item.failed ? 'bg-flag-600/80' : 'bg-brand-700/70'}`}>
        {item.localImagePreview && (
          // eslint-disable-next-line @next/next/no-img-element -- a local blob: preview, not a network image
          <img src={item.localImagePreview} alt="" className="max-h-64 w-full object-cover" />
        )}
        {item.body && <p className="px-3 py-1.5">{item.body}</p>}
      </div>
      <div className="mt-0.5 flex items-center gap-2 pr-1 text-[11px] text-slate-400 dark:text-slate-500">
        {item.failed ? (
          <>
            <span className="flex items-center gap-1 text-flag-700 dark:text-flag-300">
              <ExclamationCircleIcon aria-hidden className="h-3.5 w-3.5" />
              {item.errorMessage ?? 'Failed to send'}
            </span>
            <button type="button" onClick={onRetry} className="font-medium text-brand-700 hover:underline dark:text-brand-300">
              Retry
            </button>
            <button type="button" onClick={onDiscard} className="hover:text-flag-700 dark:hover:text-flag-300">
              Discard
            </button>
          </>
        ) : (
          <MessageStatus sending />
        )}
      </div>
    </div>
  );
}
