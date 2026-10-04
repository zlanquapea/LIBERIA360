'use client';

import { useEffect, useRef, useState } from 'react';
import {
  ArrowPathIcon,
  ChatBubbleLeftRightIcon,
  CheckIcon,
  PaperAirplaneIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline';
import { CopyButton } from '@/components/menu/CartSheet';
import {
  cancelPharmacyOrder,
  getPharmacyOrderMessages,
  getPharmacyReorder,
  sendPharmacyOrderMessage,
  submitPharmacyPayment,
  type PharmacyOrder,
  type PharmacyOrderMessage,
} from '@/lib/pharmacy-api';
import {
  PAYMENT_LABELS,
  PAYMENT_STATUS_COPY,
  TIMELINE_LABELS,
  money,
  saveCart,
  trackerSteps,
} from '@/lib/pharmacy-ordering';

function errorText(e: unknown, fallback: string) {
  return e instanceof Error && e.message ? e.message : fallback;
}

/** Where the order is, step by step, with the time of each step so far. */
export function PharmacyOrderTracker({ order }: { order: PharmacyOrder }) {
  if (order.status === 'cancelled' || order.status === 'rejected') return null;
  const steps = trackerSteps(order);
  const timeOf = new Map<string, string>();
  for (const entry of order.timeline ?? []) {
    const key =
      entry.key === 'rx_accepted' ? 'rx'
        : entry.key === 'payment_confirmed' ? 'payment'
        : entry.key === 'ready_for_pickup' || entry.key === 'out_for_delivery' ? 'handover'
        : entry.key;
    if (!timeOf.has(key)) timeOf.set(key, entry.at);
  }
  const time = (iso?: string) =>
    iso ? new Date(iso).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' }) : null;

  return (
    <ol aria-label="Order progress" className="mt-4 flex flex-col">
      {steps.map((step, i) => (
        <li key={step.key} className="flex gap-3">
          <div className="flex flex-col items-center">
            <span
              className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                step.state === 'done'
                  ? 'bg-emerald-600 text-white'
                  : step.state === 'current'
                    ? 'bg-white text-emerald-700 ring-2 ring-emerald-600 dark:bg-slate-900 dark:text-emerald-300'
                    : 'bg-slate-100 text-slate-400 dark:bg-slate-800'
              }`}
            >
              {step.state === 'done' ? <CheckIcon aria-hidden className="h-4 w-4" /> : i + 1}
            </span>
            {i < steps.length - 1 && (
              <span aria-hidden className={`w-0.5 flex-1 min-h-4 ${step.state === 'done' ? 'bg-emerald-600' : 'bg-slate-200 dark:bg-slate-700'}`} />
            )}
          </div>
          <div className="flex min-w-0 flex-1 items-baseline justify-between gap-2 pb-3">
            <span
              className={`text-sm ${
                step.state === 'upcoming'
                  ? 'text-slate-400'
                  : step.state === 'current'
                    ? 'font-bold text-slate-950 dark:text-slate-50'
                    : 'font-medium text-slate-700 dark:text-slate-200'
              }`}
            >
              {step.label}
              {step.state === 'current' && <span className="sr-only"> (now)</span>}
            </span>
            {step.state === 'done' && time(timeOf.get(step.key)) && (
              <span className="shrink-0 text-xs text-slate-400">{time(timeOf.get(step.key))}</span>
            )}
          </div>
        </li>
      ))}
    </ol>
  );
}

/** Payment state, and — when it's the customer's move — how to pay. */
export function PharmacyPaymentPanel({ order, onChanged }: { order: PharmacyOrder; onChanged: (o: PharmacyOrder) => void }) {
  const [reference, setReference] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const method = order.paymentMethod ?? 'cash';
  const status = order.paymentStatus ?? 'pay_on_collection';
  const closed = ['completed', 'cancelled', 'rejected'].includes(order.status);
  const yourMove =
    method !== 'cash' &&
    !closed &&
    order.status !== 'under_review' &&
    (status === 'awaiting_payment' || status === 'failed');

  async function submit() {
    if (reference.trim().length < 4) {
      setError('Enter the transaction ID from your confirmation SMS.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      onChanged(await submitPharmacyPayment(order.id, reference.trim()));
      setReference('');
    } catch (e) {
      setError(errorText(e, 'Could not send the transaction ID.'));
    } finally {
      setBusy(false);
    }
  }

  if (!yourMove) {
    const tone =
      status === 'paid' || status === 'refunded'
        ? 'bg-emerald-50 text-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200'
        : status === 'refund_due' || status === 'failed'
          ? 'bg-amber-50 text-amber-900 dark:bg-amber-950/40 dark:text-amber-200'
          : 'bg-slate-50 text-slate-700 dark:bg-slate-800/60 dark:text-slate-200';
    const waitingRx = method !== 'cash' && status === 'awaiting_payment' && order.status === 'under_review';
    return (
      <p className={`mt-3 rounded-2xl px-4 py-3 text-sm ${tone}`}>
        <strong>{PAYMENT_LABELS[method]}</strong> ·{' '}
        {waitingRx
          ? 'You’ll pay once the pharmacist approves your prescription.'
          : PAYMENT_STATUS_COPY[status]}
        {status === 'awaiting_verification' && order.paymentReference && (
          <span className="block text-xs opacity-80">Transaction {order.paymentReference}</span>
        )}
      </p>
    );
  }

  return (
    <div className="mt-3 flex flex-col gap-3 rounded-3xl border-2 border-emerald-600 bg-emerald-50/60 p-4 dark:bg-emerald-950/20">
      <p className="font-display text-lg font-bold text-slate-950 dark:text-slate-50">
        {status === 'failed' ? 'Payment not found — try again' : 'Pay now to get your order prepared'}
      </p>
      <p className="text-sm text-slate-700 dark:text-slate-200">
        Send <strong>{money(order.finalTotal)}</strong> by {PAYMENT_LABELS[method]} to
      </p>
      {order.paymentAccount && (
        <div className="flex items-center justify-between gap-3 rounded-2xl bg-white px-4 py-3 dark:bg-slate-900">
          <span className="font-mono text-lg font-bold tabular-nums">{order.paymentAccount}</span>
          <CopyButton value={order.paymentAccount.replace(/\s/g, '')} label="number" />
        </div>
      )}
      <label className="flex flex-col gap-1 text-sm text-slate-700 dark:text-slate-200">
        Then enter the transaction ID
        <input
          value={reference}
          onChange={(e) => setReference(e.target.value)}
          placeholder="e.g. MP240115.1234.A56789"
          className="w-full rounded-2xl border border-slate-300 bg-white p-3 font-mono text-sm outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100 dark:border-slate-700 dark:bg-slate-800"
        />
      </label>
      {error && <p role="alert" className="text-sm font-medium text-rose-700 dark:text-rose-300">{error}</p>}
      <button
        type="button"
        onClick={submit}
        disabled={busy}
        className="min-h-12 rounded-full bg-emerald-700 px-5 text-sm font-bold text-white hover:bg-emerald-800 disabled:opacity-60"
      >
        {busy ? 'Sending…' : 'I’ve paid — send transaction ID'}
      </button>
    </div>
  );
}

/** Chat on an order between the customer and the pharmacy. */
export function PharmacyOrderChat({
  orderId,
  unread = 0,
  side,
  title,
}: {
  orderId: string;
  unread?: number;
  side: 'customer' | 'pharmacy';
  title: string;
}) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<PharmacyOrderMessage[] | null>(null);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [unseen, setUnseen] = useState(unread);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => setUnseen(unread), [unread]);

  useEffect(() => {
    if (!open) return;
    let alive = true;
    const load = () =>
      getPharmacyOrderMessages(orderId)
        .then((rows) => {
          if (alive) {
            setMessages(rows);
            setUnseen(0);
          }
        })
        .catch((e) => alive && setError(errorText(e, 'Could not load messages.')));
    load();
    // Light polling while the thread is open, like the restaurant chat.
    const timer = setInterval(load, 15000);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, [open, orderId]);

  useEffect(() => {
    endRef.current?.scrollIntoView?.({ block: 'nearest' });
  }, [messages]);

  async function send() {
    const body = draft.trim();
    if (!body) return;
    setSending(true);
    setError(null);
    try {
      const saved = await sendPharmacyOrderMessage(orderId, body);
      setMessages((m) => [...(m ?? []), saved]);
      setDraft('');
    } catch (e) {
      setError(errorText(e, 'Message not sent.'));
    } finally {
      setSending(false);
    }
  }

  const mine = (m: PharmacyOrderMessage) => (side === 'pharmacy' ? m.fromPharmacy : !m.fromPharmacy);

  return (
    <div className="mt-3">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="inline-flex min-h-10 items-center gap-2 rounded-full border border-slate-200 px-4 text-sm font-semibold text-slate-700 hover:border-emerald-400 hover:bg-emerald-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-emerald-950/30"
      >
        <ChatBubbleLeftRightIcon aria-hidden className="h-4 w-4" />
        {title}
        {unseen > 0 && (
          <span className="rounded-full bg-rose-600 px-1.5 py-0.5 text-[11px] font-bold leading-none text-white">{unseen}</span>
        )}
      </button>
      {open && (
        <div className="mt-2 flex flex-col gap-2 rounded-3xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-900/60">
          <div className="flex max-h-72 flex-col gap-2 overflow-y-auto">
            {messages === null ? (
              <p className="text-sm text-slate-500">Loading…</p>
            ) : messages.length === 0 ? (
              <p className="text-sm text-slate-500">
                {side === 'customer' ? 'Ask about stock, a generic, or where the rider is.' : 'No messages yet.'}
              </p>
            ) : (
              messages.map((m) => (
                <div key={m.id} className={`flex flex-col ${mine(m) ? 'items-end' : 'items-start'}`}>
                  <span
                    className={`max-w-[85%] whitespace-pre-line rounded-2xl px-3 py-2 text-sm [overflow-wrap:anywhere] ${
                      mine(m) ? 'bg-emerald-700 text-white' : 'bg-white text-slate-800 shadow-sm dark:bg-slate-800 dark:text-slate-100'
                    }`}
                  >
                    {m.body}
                  </span>
                  <span className="mt-0.5 text-[11px] text-slate-400">
                    {mine(m) ? 'You' : m.senderName} · {new Date(m.createdAt).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}
                  </span>
                </div>
              ))
            )}
            <div ref={endRef} />
          </div>
          {error && <p role="alert" className="text-sm text-rose-700 dark:text-rose-300">{error}</p>}
          <div className="flex items-end gap-2">
            <label className="flex-1">
              <span className="sr-only">Message</span>
              <textarea
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                rows={1}
                maxLength={2000}
                placeholder="Write a message"
                className="w-full resize-none rounded-2xl border border-slate-300 bg-white p-3 text-sm outline-none focus:border-emerald-600 dark:border-slate-700 dark:bg-slate-800"
              />
            </label>
            <button
              type="button"
              onClick={send}
              disabled={sending || !draft.trim()}
              aria-label="Send message"
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-emerald-700 text-white hover:bg-emerald-800 disabled:opacity-50"
            >
              <PaperAirplaneIcon aria-hidden className="h-5 w-5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/** "Order again" and "Cancel order" for the customer. */
export function PharmacyOrderActions({ order, onChanged }: { order: PharmacyOrder; onChanged: (o: PharmacyOrder) => void }) {
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState<'cancel' | 'reorder' | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const cancellable = ['pending', 'under_review', 'accepted'].includes(order.status);

  async function reorder() {
    setBusy('reorder');
    setNote(null);
    try {
      const r = await getPharmacyReorder(order.id);
      const cart = Object.fromEntries(
        r.lines.filter((l) => l.available && l.productId && l.quantity > 0).map((l) => [l.productId!, l.quantity]),
      );
      if (Object.keys(cart).length === 0) {
        setNote('None of these medicines are in stock at this pharmacy right now.');
        return;
      }
      saveCart(r.pharmacyId, cart);
      // A full navigation: the shop reads the saved cart when it loads.
      window.location.assign(`/pharmacies/${r.pharmacySlug ?? order.pharmacy?.slug ?? ''}`);
    } catch (e) {
      setNote(errorText(e, 'Could not load this order again.'));
    } finally {
      setBusy(null);
    }
  }

  async function cancel() {
    setBusy('cancel');
    setNote(null);
    try {
      onChanged(await cancelPharmacyOrder(order.id));
      setConfirming(false);
    } catch (e) {
      setNote(errorText(e, 'Could not cancel the order.'));
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="mt-3 flex flex-col gap-2">
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={reorder}
          disabled={busy !== null}
          className="inline-flex min-h-10 items-center gap-2 rounded-full bg-emerald-700 px-4 text-sm font-semibold text-white hover:bg-emerald-800 disabled:opacity-60"
        >
          <ArrowPathIcon aria-hidden className="h-4 w-4" />
          {busy === 'reorder' ? 'Loading…' : 'Order again'}
        </button>
        {cancellable && !confirming && (
          <button
            type="button"
            onClick={() => setConfirming(true)}
            className="inline-flex min-h-10 items-center gap-2 rounded-full border border-slate-200 px-4 text-sm font-semibold text-slate-700 hover:border-rose-300 hover:text-rose-700 dark:border-slate-700 dark:text-slate-200"
          >
            <XMarkIcon aria-hidden className="h-4 w-4" />
            Cancel order
          </button>
        )}
      </div>
      {confirming && (
        <div className="flex flex-wrap items-center gap-2 rounded-2xl bg-rose-50 p-3 text-sm text-rose-900 dark:bg-rose-950/40 dark:text-rose-200">
          <span className="flex-1">
            Cancel this order?
            {(order.paymentStatus === 'paid' || order.paymentStatus === 'awaiting_verification') &&
              ' The pharmacy will refund your mobile money.'}
          </span>
          <button type="button" onClick={cancel} disabled={busy !== null} className="min-h-9 rounded-full bg-rose-600 px-4 font-semibold text-white hover:bg-rose-700">
            {busy === 'cancel' ? 'Cancelling…' : 'Yes, cancel'}
          </button>
          <button type="button" onClick={() => setConfirming(false)} className="min-h-9 rounded-full px-3 font-semibold">
            Keep it
          </button>
        </div>
      )}
      {note && <p role="alert" className="text-sm text-amber-800 dark:text-amber-300">{note}</p>}
    </div>
  );
}

/** Compact history of what has happened (for staff). */
export function PharmacyOrderHistory({ order }: { order: PharmacyOrder }) {
  const entries = order.timeline ?? [];
  if (entries.length === 0) return null;
  return (
    <ul className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-slate-500 dark:text-slate-400">
      {entries.map((e, i) => (
        <li key={`${e.key}-${i}`}>
          {TIMELINE_LABELS[e.key] ?? e.key}{' '}
          <span className="text-slate-400">{new Date(e.at).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}</span>
        </li>
      ))}
    </ul>
  );
}
