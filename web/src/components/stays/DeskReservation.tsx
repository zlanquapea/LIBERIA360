'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { ArrowLeftIcon, PhoneIcon } from '@heroicons/react/24/outline';
import { BrandLoader } from '@/components/BrandLoader';
import { OrderStepper } from '@/components/orders/OrderStepper';
import { formatMoney } from '@/lib/currency';
import {
  checkInGuest,
  checkOutGuest,
  getReservation,
  markNoShow,
  markStayRefunded,
  respondToReservation,
  verifyStayPayment,
  type Reservation,
} from '@/lib/stays-api';
import { STAY_PAYMENT_LABELS, isOpenStay, stayDate, staySteps, todayInLiberia } from '@/lib/stays';
import { StayChat } from './StayChat';
import { StayBadges, StaySummary } from './StayParts';

const errorText = (e: unknown, fallback: string) => (e instanceof Error ? e.message : fallback);

/** One booking at the front desk, with the next thing to do on top. */
export function DeskReservation({ businessId, id }: { businessId: string; id: string }) {
  const [r, setR] = useState<Reservation | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [actionError, setActionError] = useState('');
  const [message, setMessage] = useState('');
  const [declining, setDeclining] = useState(false);
  const [roomNumbers, setRoomNumbers] = useState('');

  const load = useCallback(
    () =>
      getReservation(id)
        .then((x) => {
          setR(x);
          setRoomNumbers((v) => v || x.roomNumbers || '');
        })
        .catch((e) => setError(errorText(e, 'Could not load this booking.'))),
    [id],
  );
  useEffect(() => {
    void load();
  }, [load]);

  const back = `/account/my-businesses/${businessId}/front-desk`;
  if (error)
    return (
      <div className="flex flex-col gap-4">
        <p role="alert" className="error-state">
          {error}
        </p>
        <Link href={back} className="btn-secondary min-h-11 self-start">
          Front desk
        </Link>
      </div>
    );
  if (!r)
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <BrandLoader />
      </div>
    );

  async function run(key: string, action: () => Promise<Reservation>) {
    setBusy(key);
    setActionError('');
    try {
      setR(await action());
      setDeclining(false);
      setMessage('');
    } catch (err) {
      setActionError(errorText(err, 'Something went wrong.'));
    } finally {
      setBusy(null);
    }
  }

  const today = todayInLiberia();
  const due = r.checkIn <= today;
  const awaitingMoney = r.paymentStatus === 'awaiting_verification';
  const leavingToday = r.status === 'checked_in' && r.checkOut <= today;

  return (
    <div className="flex flex-col gap-5">
      <Link href={back} className="flex items-center gap-1 self-start text-sm font-semibold text-brand-700 dark:text-brand-300">
        <ArrowLeftIcon aria-hidden className="h-4 w-4" /> Front desk
      </Link>

      <section className="flex flex-col gap-4 rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-bold uppercase tracking-wide text-slate-400">
              {r.source === 'walk_in' ? 'Walk-in' : 'Online booking'} · #{r.code}
            </p>
            <h2 className="font-display text-2xl font-bold text-slate-950 dark:text-slate-50">{r.guestName}</h2>
            {r.guestPhone && (
              <a href={`tel:${r.guestPhone.replace(/\s/g, '')}`} className="mt-1 inline-flex items-center gap-1 text-sm font-semibold text-brand-700 dark:text-brand-300">
                <PhoneIcon aria-hidden className="h-4 w-4" /> {r.guestPhone}
              </a>
            )}
          </div>
          <StayBadges r={r} desk />
        </div>
        {!['declined', 'cancelled', 'no_show'].includes(r.status) && <OrderStepper steps={staySteps(r)} />}
        <StaySummary r={r} />
        {(r.arrivalTime || r.specialRequests) && (
          <dl className="grid gap-2 rounded-2xl bg-slate-50 p-3 text-sm dark:bg-slate-800/60">
            {r.arrivalTime && (
              <div>
                <dt className="text-xs font-semibold text-slate-500">Arriving</dt>
                <dd>{r.arrivalTime}</dd>
              </div>
            )}
            {r.specialRequests && (
              <div>
                <dt className="text-xs font-semibold text-slate-500">Requests</dt>
                <dd className="whitespace-pre-line">{r.specialRequests}</dd>
              </div>
            )}
          </dl>
        )}
      </section>

      {/* The next thing to do, first. */}
      {isOpenStay(r) && awaitingMoney && (
        <div className="flex flex-col gap-3 rounded-2xl bg-amber-50 p-4 dark:bg-amber-950/40">
          <p className="text-sm text-amber-900 dark:text-amber-100">
            <strong>Check your {STAY_PAYMENT_LABELS[r.paymentMethod]}</strong>
            {r.paymentAccount ? ` (${r.paymentAccount})` : ''} for{' '}
            <strong>{formatMoney(r.totalAmount, r.currency)}</strong>, transaction{' '}
            <span className="font-mono font-bold">{r.paymentReference}</span>.
          </p>
          <div className="flex flex-wrap gap-2">
            <button type="button" disabled={busy !== null} onClick={() => void run('paid', () => verifyStayPayment(r.id, true))} className="btn-primary min-h-11">
              {busy === 'paid' ? 'Saving…' : r.status === 'requested' ? 'Payment received, confirm' : 'Payment received'}
            </button>
            <button type="button" disabled={busy !== null} onClick={() => void run('missing', () => verifyStayPayment(r.id, false))} className="btn-secondary min-h-11">
              Not found
            </button>
          </div>
        </div>
      )}

      {r.status === 'requested' && !awaitingMoney && (
        <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 p-4 dark:border-slate-800">
          <p className="text-sm text-slate-700 dark:text-slate-200">
            {r.paymentStatus === 'failed'
              ? 'Waiting for the guest to send the right transaction ID. You can still confirm if they’ll pay on arrival, or decline.'
              : 'The room is held for this guest until you answer.'}
          </p>
          <label className="text-sm font-medium text-slate-700 dark:text-slate-200">
            Message to the guest (optional)
            <textarea
              rows={2}
              maxLength={1000}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder={declining ? 'e.g. Sorry, we are fully booked for a wedding that weekend.' : 'e.g. Ask for Musu at reception. Airport pickup is US$25.'}
              className="input mt-1 w-full"
            />
          </label>
          <div className="flex flex-wrap gap-2">
            {r.paymentStatus !== 'failed' && (
              <button type="button" disabled={busy !== null} onClick={() => void run('confirm', () => respondToReservation(r.id, 'confirm', message))} className="btn-primary min-h-11">
                {busy === 'confirm' ? 'Confirming…' : 'Confirm booking'}
              </button>
            )}
            {declining ? (
              <button type="button" disabled={busy !== null} onClick={() => void run('decline', () => respondToReservation(r.id, 'decline', message))} className="min-h-11 rounded-full bg-red-600 px-5 text-sm font-bold text-white hover:bg-red-700 disabled:opacity-50">
                {busy === 'decline' ? 'Declining…' : 'Yes, decline'}
              </button>
            ) : (
              <button type="button" onClick={() => setDeclining(true)} className="btn-secondary min-h-11">
                Decline
              </button>
            )}
          </div>
        </div>
      )}
      {isOpenStay(r) && awaitingMoney && r.status === 'requested' && (
        <button type="button" disabled={busy !== null} onClick={() => void run('decline', () => respondToReservation(r.id, 'decline'))} className="self-start text-sm font-semibold text-red-700 underline dark:text-red-300">
          Decline this booking
        </button>
      )}

      {r.status === 'confirmed' && (
        <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 p-4 dark:border-slate-800">
          <p className="text-sm text-slate-700 dark:text-slate-200">
            {due
              ? `Due ${r.checkIn === today ? 'today' : `since ${stayDate(r.checkIn)}`}.${r.paymentStatus === 'pay_at_property' ? ` Collect ${formatMoney(r.totalAmount, r.currency)}.` : ''}`
              : `Arrives ${stayDate(r.checkIn)}. You can check them in from that day.`}
          </p>
          {due && (
            <>
              <label className="text-sm font-medium text-slate-700 dark:text-slate-200">
                Room number{r.rooms > 1 ? 's' : ''}
                <input value={roomNumbers} onChange={(e) => setRoomNumbers(e.target.value)} maxLength={60} placeholder={r.rooms > 1 ? '12, 14' : '12'} className="input mt-1 w-full max-w-xs" />
              </label>
              <div className="flex flex-wrap gap-2">
                <button type="button" disabled={busy !== null} onClick={() => void run('in', () => checkInGuest(r.id, roomNumbers))} className="btn-primary min-h-11">
                  {busy === 'in' ? 'Checking in…' : 'Check in'}
                </button>
                <button type="button" disabled={busy !== null} onClick={() => void run('noshow', () => markNoShow(r.id))} className="btn-secondary min-h-11">
                  Didn&apos;t arrive
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {r.status === 'checked_in' && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 p-4 dark:border-slate-800">
          <p className="text-sm text-slate-700 dark:text-slate-200">
            {leavingToday ? 'Leaving today.' : `In house until ${stayDate(r.checkOut)}.`}
            {r.paymentStatus === 'pay_at_property' && ` Collect ${formatMoney(r.totalAmount, r.currency)} before they go.`}
          </p>
          <button type="button" disabled={busy !== null} onClick={() => void run('out', () => checkOutGuest(r.id))} className="btn-primary min-h-11">
            {busy === 'out' ? 'Checking out…' : 'Check out'}
          </button>
        </div>
      )}

      {r.paymentStatus === 'refund_due' && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-orange-50 p-4 dark:bg-orange-950/40">
          <p className="text-sm text-orange-900 dark:text-orange-100">
            Refund {formatMoney(r.totalAmount, r.currency)} by {STAY_PAYMENT_LABELS[r.paymentMethod]} (transaction{' '}
            <span className="font-mono">{r.paymentReference}</span>).
          </p>
          <button type="button" disabled={busy !== null} onClick={() => void run('refund', () => markStayRefunded(r.id))} className="btn-secondary min-h-10">
            {busy === 'refund' ? 'Saving…' : 'Mark refunded'}
          </button>
        </div>
      )}

      {actionError && (
        <p role="alert" className="error-state">
          {actionError}
        </p>
      )}

      {r.source === 'online' && (
        <div className="flex flex-col gap-2">
          <h2 className="text-lg font-bold text-slate-950 dark:text-slate-50">Messages with {r.guestName}</h2>
          <StayChat reservationId={r.id} otherName={r.guestName} emptyHint="Send directions, confirm an airport pickup, or answer a question." />
        </div>
      )}
    </div>
  );
}
