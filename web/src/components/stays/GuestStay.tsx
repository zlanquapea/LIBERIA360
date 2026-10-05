'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import {
  ArrowLeftIcon,
  ChatBubbleLeftRightIcon,
  MapPinIcon,
  PhoneIcon,
} from '@heroicons/react/24/outline';
import { BrandLoader } from '@/components/BrandLoader';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { CopyButton } from '@/components/menu/CartSheet';
import { OrderStepper } from '@/components/orders/OrderStepper';
import { formatMoney } from '@/lib/currency';
import {
  cancelReservation,
  getReservation,
  resendStayPayment,
  type Reservation,
} from '@/lib/stays-api';
import { STAY_PAYMENT_LABELS, isOpenStay, stayDate, staySteps } from '@/lib/stays';
import { StayChat } from './StayChat';
import { StayBadges, StaySummary } from './StayParts';

function Note({ tone, children }: { tone: 'amber' | 'emerald' | 'red' | 'slate' | 'sky'; children: React.ReactNode }) {
  const styles = {
    amber: 'bg-amber-50 text-amber-900 dark:bg-amber-950/40 dark:text-amber-100',
    emerald: 'bg-emerald-50 text-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-100',
    red: 'bg-red-50 text-red-900 dark:bg-red-950/40 dark:text-red-100',
    slate: 'bg-slate-50 text-slate-700 dark:bg-slate-800/60 dark:text-slate-200',
    sky: 'bg-sky-50 text-sky-900 dark:bg-sky-950/40 dark:text-sky-100',
  };
  return <div className={`rounded-2xl p-4 text-sm ${styles[tone]}`}>{children}</div>;
}

/** What happens next, in one sentence the guest can act on. */
function NextStep({ r }: { r: Reservation }) {
  const hotel = r.property.name;
  if (r.status === 'requested' && r.paymentStatus === 'awaiting_verification')
    return (
      <Note tone="amber">
        {hotel} is checking your {STAY_PAYMENT_LABELS[r.paymentMethod]} payment (transaction{' '}
        <span className="font-mono font-semibold">{r.paymentReference}</span>). Your room is held, and you&apos;ll get a
        notification the moment it&apos;s confirmed.
      </Note>
    );
  if (r.status === 'requested')
    return (
      <Note tone="amber">
        Your room is held while {hotel} confirms. You&apos;ll get a notification, usually within the hour.
      </Note>
    );
  if (r.status === 'confirmed')
    return (
      <Note tone="sky">
        <p className="font-semibold">You&apos;re booked for {stayDate(r.checkIn)}.</p>
        <p className="mt-1">
          Show code <span className="font-mono font-bold">{r.code}</span> at the front desk.
          {r.paymentStatus === 'pay_at_property' && ` Pay ${formatMoney(r.totalAmount, r.currency)} when you arrive.`}
        </p>
      </Note>
    );
  if (r.status === 'checked_in')
    return (
      <Note tone="emerald">
        <p className="font-semibold">Welcome! You&apos;re checked in{r.roomNumbers ? ` to room ${r.roomNumbers}` : ''}.</p>
        <p className="mt-1">Check-out is on {stayDate(r.checkOut)}. Message the front desk below if you need anything.</p>
      </Note>
    );
  if (r.status === 'checked_out') return <Note tone="slate">Thanks for staying at {hotel}. We hope to see you again.</Note>;
  if (r.status === 'declined')
    return (
      <Note tone="red">
        <p className="font-semibold">{hotel} couldn&apos;t take this booking.</p>
        {r.propertyNote && <p className="mt-1 whitespace-pre-line">{r.propertyNote}</p>}
      </Note>
    );
  if (r.status === 'no_show') return <Note tone="red">This booking was closed because you didn&apos;t arrive.</Note>;
  return <Note tone="slate">You cancelled this booking.</Note>;
}

export function GuestStay({ id }: { id: string }) {
  const [r, setR] = useState<Reservation | null>(null);
  const [error, setError] = useState('');
  const [reference, setReference] = useState('');
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState('');
  const [confirming, setConfirming] = useState(false);

  const load = useCallback(
    () =>
      getReservation(id)
        .then(setR)
        .catch((e) => setError(e instanceof Error ? e.message : 'Could not load this booking.')),
    [id],
  );
  useEffect(() => {
    void load();
  }, [load]);
  const open = r ? isOpenStay(r) : false;
  useEffect(() => {
    if (!open) return;
    const t = setInterval(() => void load(), 30000);
    return () => clearInterval(t);
  }, [open, load]);

  if (error)
    return (
      <main className="mx-auto flex max-w-2xl flex-col gap-4 px-4 py-8">
        <p role="alert" className="error-state">
          {error}
        </p>
        <Link href="/account/stays" className="btn-secondary min-h-11 self-start">
          My stays
        </Link>
      </main>
    );
  if (!r)
    return (
      <main className="flex min-h-[60vh] items-center justify-center">
        <BrandLoader />
      </main>
    );

  async function resend(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setActionError('');
    try {
      setR(await resendStayPayment(id, reference.trim()));
      setReference('');
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Could not send it.');
    } finally {
      setBusy(false);
    }
  }

  async function cancel() {
    setBusy(true);
    setActionError('');
    try {
      setR(await cancelReservation(id));
      setConfirming(false);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Could not cancel.');
    } finally {
      setBusy(false);
    }
  }

  const p = r.property;
  const canCancel = r.status === 'requested' || r.status === 'confirmed';
  const paidSomething = r.paymentStatus === 'paid' || r.paymentStatus === 'awaiting_verification';
  const directions =
    p.latitude != null && p.longitude != null
      ? `https://www.google.com/maps/dir/?api=1&destination=${p.latitude},${p.longitude}`
      : null;

  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-5 px-4 py-8">
      <Link href="/account/stays" className="flex items-center gap-1 self-start text-sm font-semibold text-brand-700 dark:text-brand-300">
        <ArrowLeftIcon aria-hidden className="h-4 w-4" /> My stays
      </Link>

      <section className="flex flex-col gap-4 rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <Link href={`/businesses/${p.slug}`} className="font-display text-xl font-bold text-slate-950 hover:underline dark:text-slate-50">
              {p.name}
            </Link>
            {p.address && <p className="text-sm text-slate-500 dark:text-slate-400">{p.address}</p>}
          </div>
          <StayBadges r={r} />
        </div>
        <div className="flex items-center justify-between gap-3 rounded-2xl border border-dashed border-slate-300 px-4 py-3 dark:border-slate-700">
          <span>
            <span className="block text-xs font-semibold uppercase tracking-wide text-slate-500">Booking code</span>
            <span className="font-mono text-2xl font-black tracking-[0.2em] text-slate-950 dark:text-slate-50">{r.code}</span>
          </span>
          <CopyButton value={r.code} label="booking code" />
        </div>
        {!['declined', 'cancelled', 'no_show'].includes(r.status) && <OrderStepper steps={staySteps(r)} />}
        <StaySummary r={r} />
      </section>

      <NextStep r={r} />

      {r.propertyNote && r.status !== 'declined' && (
        <Note tone="slate">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">From {p.name}</p>
          <p className="mt-1 whitespace-pre-line">{r.propertyNote}</p>
        </Note>
      )}

      {r.paymentStatus === 'failed' && open && (
        <form onSubmit={resend} className="flex flex-col gap-3 rounded-2xl bg-red-50 p-4 dark:bg-red-950/40">
          <p className="text-sm text-red-900 dark:text-red-100">
            {p.name} couldn&apos;t find transaction <span className="font-mono">{r.paymentReference}</span>. Check the
            SMS from {STAY_PAYMENT_LABELS[r.paymentMethod]} and send the right ID to keep your room.
          </p>
          {r.paymentAccount && (
            <p className="flex items-center gap-2 text-sm text-red-900 dark:text-red-100">
              Pay to <span className="font-mono font-semibold">{r.paymentAccount}</span>
              <CopyButton value={r.paymentAccount.replace(/\s/g, '')} label="number" />
            </p>
          )}
          <label className="text-sm font-semibold text-slate-700 dark:text-slate-200">
            Transaction ID
            <input value={reference} onChange={(e) => setReference(e.target.value)} className="input mt-1 w-full font-mono" />
          </label>
          <button disabled={busy || reference.trim().length < 4} className="btn-primary min-h-11 self-start">
            {busy ? 'Sending…' : 'Send transaction ID'}
          </button>
        </form>
      )}
      {r.paymentStatus === 'refund_due' && (
        <Note tone="amber">
          {p.name} owes you a refund of {formatMoney(r.totalAmount, r.currency)} to the number you paid from. If it
          hasn&apos;t arrived within a day, call them{p.phone ? ` on ${p.phone}` : ''}.
        </Note>
      )}
      {r.paymentStatus === 'refunded' && (
        <Note tone="emerald">Your {formatMoney(r.totalAmount, r.currency)} has been refunded.</Note>
      )}

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {p.phone && (
          <a href={`tel:${p.phone.replace(/\s/g, '')}`} className="btn-secondary min-h-11 gap-1.5">
            <PhoneIcon aria-hidden className="h-5 w-5" /> Call
          </a>
        )}
        {p.whatsapp && (
          <a
            href={`https://wa.me/${p.whatsapp.replace(/\D/g, '').replace(/^0/, '231')}`}
            target="_blank"
            rel="noopener noreferrer"
            className="btn-secondary min-h-11 gap-1.5"
          >
            <ChatBubbleLeftRightIcon aria-hidden className="h-5 w-5" /> WhatsApp
          </a>
        )}
        {directions && (
          <a href={directions} target="_blank" rel="noopener noreferrer" className="btn-secondary min-h-11 gap-1.5">
            <MapPinIcon aria-hidden className="h-5 w-5" /> Directions
          </a>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <h2 className="text-lg font-bold text-slate-950 dark:text-slate-50">Messages with the front desk</h2>
        <StayChat
          reservationId={r.id}
          otherName={p.name}
          emptyHint={`Ask ${p.name} anything: airport pickup, an early check-in, a baby cot.`}
        />
      </div>

      {actionError && (
        <p role="alert" className="error-state">
          {actionError}
        </p>
      )}
      {canCancel && (
        <button type="button" onClick={() => setConfirming(true)} className="self-start text-sm font-semibold text-red-700 underline dark:text-red-300">
          Cancel booking
        </button>
      )}
      <ConfirmDialog
        open={confirming}
        title="Cancel this booking?"
        description={
          paidSomething
            ? `${p.name} will be told and will refund your ${formatMoney(r.totalAmount, r.currency)}.`
            : `${p.name} will be told and your room is released.`
        }
        consequences={r.status === 'confirmed' ? ['Check the hotel’s cancellation policy for late cancellations.'] : undefined}
        confirmLabel="Cancel booking"
        cancelLabel="Keep it"
        loadingLabel="Cancelling…"
        isLoading={busy}
        error={actionError || null}
        onConfirm={() => void cancel()}
        onCancel={() => setConfirming(false)}
      />
    </main>
  );
}
