'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { ArrowLeftIcon, ChatBubbleLeftRightIcon, ClockIcon, PhoneIcon } from '@heroicons/react/24/outline';
import { BrandLoader } from '@/components/BrandLoader';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { CopyButton } from '@/components/menu/CartSheet';
import { OrderStepper } from '@/components/orders/OrderStepper';
import { ThreadChat } from '@/components/stays/StayChat';
import { formatMoney } from '@/lib/currency';
import {
  cancelRental,
  getRental,
  getRentalMessages,
  resendRentalPayment,
  sendRentalMessage,
  type Rental,
} from '@/lib/rentals-api';
import { RENTAL_PAYMENT_LABELS, isOpenRental, rentalSteps, timeLeft, when } from '@/lib/rentals';
import { RentalBadges, RentalBill, RentalReadings, RentalSchedule } from './RentalParts';

const usd = (n: number) => formatMoney(n, 'USD');

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

/** What happens next, in a sentence the renter can act on. */
function NextStep({ r }: { r: Rental }) {
  if (r.status === 'requested' && r.paymentStatus === 'awaiting_verification')
    return (
      <Note tone="amber">
        The owner is checking your {RENTAL_PAYMENT_LABELS[r.paymentMethod]} payment (transaction{' '}
        <span className="font-mono font-semibold">{r.paymentReference}</span>). The car is held for you, and you&apos;ll get a
        notification the moment it&apos;s confirmed.
      </Note>
    );
  if (r.status === 'requested')
    return <Note tone="amber">The car is held while the owner confirms. You&apos;ll get a notification, usually within the hour.</Note>;
  if (r.status === 'confirmed')
    return (
      <Note tone="sky">
        <p className="font-semibold">
          {r.delivery ? 'Your car will be delivered' : 'Collect your car'} {when(r.pickupDate, r.pickupTime)}.
        </p>
        <p className="mt-1">
          Show code <span className="font-mono font-bold">{r.code}</span>
          {!r.withDriver ? ' and your driving licence' : ''}.
          {r.paymentStatus === 'pay_at_pickup' && ` Bring ${usd(r.totalAmount)} in cash`}
          {r.depositAmount != null && `${r.paymentStatus === 'pay_at_pickup' ? ', plus' : ' Bring'} the ${usd(r.depositAmount)} refundable deposit`}
          {r.paymentStatus === 'pay_at_pickup' || r.depositAmount != null ? '.' : ''}
        </p>
      </Note>
    );
  if (r.status === 'on_trip') {
    const left = timeLeft(r.dueBackAt);
    return (
      <Note tone={left.late ? 'red' : 'emerald'}>
        <p className="flex items-center gap-1.5 font-semibold">
          <ClockIcon aria-hidden className="h-5 w-5" />
          {left.late ? `${left.text} late: please bring the car back or message the owner` : `Due back in ${left.text}`}
        </p>
        <p className="mt-1">Return by {when(r.returnDate, r.returnTime)}. Drive safe.</p>
      </Note>
    );
  }
  if (r.status === 'returned')
    return (
      <Note tone="slate">
        Returned. {r.extrasTotal ? `Extra charges came to ${usd(r.extrasTotal)}.` : 'No extra charges.'}
        {r.depositReturned == null || r.depositCollected == null
          ? ''
          : r.depositReturned >= r.depositCollected
            ? ' Your deposit was returned in full.'
            : r.depositReturned === 0
              ? ' The deposit was kept towards the extra charges.'
              : ` ${usd(r.depositReturned)} of your ${usd(r.depositCollected)} deposit was returned.`}
      </Note>
    );
  if (r.status === 'declined')
    return (
      <Note tone="red">
        <p className="font-semibold">The owner couldn&apos;t take this rental.</p>
        {r.ownerNote && <p className="mt-1 whitespace-pre-line">{r.ownerNote}</p>}
      </Note>
    );
  if (r.status === 'no_show') return <Note tone="red">This rental was closed because the car wasn&apos;t collected.</Note>;
  return <Note tone="slate">You cancelled this rental.</Note>;
}

export function RenterTrip({ id }: { id: string }) {
  const [r, setR] = useState<Rental | null>(null);
  const [error, setError] = useState('');
  const [reference, setReference] = useState('');
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState('');
  const [confirming, setConfirming] = useState(false);

  const load = useCallback(
    () =>
      getRental(id)
        .then(setR)
        .catch((e) => setError(e instanceof Error ? e.message : 'Could not load this rental.')),
    [id],
  );
  useEffect(() => {
    void load();
  }, [load]);
  const open = r ? isOpenRental(r) : false;
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
        <Link href="/account/rentals" className="btn-secondary min-h-11 self-start">
          My rentals
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
      setR(await resendRentalPayment(id, reference.trim()));
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
      setR(await cancelRental(id));
      setConfirming(false);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Could not cancel.');
    } finally {
      setBusy(false);
    }
  }

  const canCancel = r.status === 'requested' || r.status === 'confirmed';
  const paidSomething = r.paymentStatus === 'paid' || r.paymentStatus === 'awaiting_verification';

  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-5 px-4 py-8">
      <Link href="/account/rentals" className="flex items-center gap-1 self-start text-sm font-semibold text-brand-700 dark:text-brand-300">
        <ArrowLeftIcon aria-hidden className="h-4 w-4" /> My rentals
      </Link>

      <section className="flex flex-col gap-4 rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-wrap items-start justify-between gap-3">
          {r.carListingId ? (
            <Link href={`/car-rentals/${r.carListingId}`} className="font-display text-xl font-bold text-slate-950 hover:underline dark:text-slate-50">
              {r.carTitle}
            </Link>
          ) : (
            <h1 className="font-display text-xl font-bold text-slate-950 dark:text-slate-50">{r.carTitle}</h1>
          )}
          <RentalBadges r={r} />
        </div>
        <div className="flex items-center justify-between gap-3 rounded-2xl border border-dashed border-slate-300 px-4 py-3 dark:border-slate-700">
          <span>
            <span className="block text-xs font-semibold uppercase tracking-wide text-slate-500">Rental code</span>
            <span className="font-mono text-2xl font-black tracking-[0.2em] text-slate-950 dark:text-slate-50">{r.code}</span>
          </span>
          <CopyButton value={r.code} label="rental code" />
        </div>
        {!['declined', 'cancelled', 'no_show'].includes(r.status) && <OrderStepper steps={rentalSteps(r)} />}
        <RentalSchedule r={r} />
        <RentalBill r={r} />
      </section>

      <NextStep r={r} />

      {r.ownerNote && r.status !== 'declined' && (
        <Note tone="slate">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">From the owner</p>
          <p className="mt-1 whitespace-pre-line">{r.ownerNote}</p>
        </Note>
      )}

      {r.paymentStatus === 'failed' && open && (
        <form onSubmit={resend} className="flex flex-col gap-3 rounded-2xl bg-red-50 p-4 dark:bg-red-950/40">
          <p className="text-sm text-red-900 dark:text-red-100">
            The owner couldn&apos;t find transaction <span className="font-mono">{r.paymentReference}</span>. Check the SMS from{' '}
            {RENTAL_PAYMENT_LABELS[r.paymentMethod]} and send the right ID to keep the car.
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
        <Note tone="amber">The owner owes you a refund of {usd(r.totalAmount)} to the number you paid from.</Note>
      )}
      {r.paymentStatus === 'refunded' && <Note tone="emerald">Your {usd(r.totalAmount)} has been refunded.</Note>}

      <RentalReadings r={r} />

      <div className="grid grid-cols-2 gap-2">
        {r.owner.phone && (
          <a href={`tel:${r.owner.phone.replace(/\s/g, '')}`} className="btn-secondary min-h-11 gap-1.5">
            <PhoneIcon aria-hidden className="h-5 w-5" /> Call owner
          </a>
        )}
        {r.owner.whatsapp && (
          <a
            href={`https://wa.me/${r.owner.whatsapp.replace(/\D/g, '').replace(/^0/, '231')}`}
            target="_blank"
            rel="noopener noreferrer"
            className="btn-secondary min-h-11 gap-1.5"
          >
            <ChatBubbleLeftRightIcon aria-hidden className="h-5 w-5" /> WhatsApp
          </a>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <h2 className="text-lg font-bold text-slate-950 dark:text-slate-50">Messages with the owner</h2>
        <ThreadChat
          threadId={r.id}
          load={getRentalMessages}
          send={sendRentalMessage}
          otherName="Owner"
          emptyHint="Ask about pickup, a child seat, or driving upcountry."
        />
      </div>

      {actionError && (
        <p role="alert" className="error-state">
          {actionError}
        </p>
      )}
      {canCancel && (
        <button type="button" onClick={() => setConfirming(true)} className="self-start text-sm font-semibold text-red-700 underline dark:text-red-300">
          Cancel rental
        </button>
      )}
      <ConfirmDialog
        open={confirming}
        title="Cancel this rental?"
        description={
          paidSomething
            ? `The owner will be told and will refund your ${usd(r.totalAmount)}.`
            : 'The owner will be told and the car is released.'
        }
        confirmLabel="Cancel rental"
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
