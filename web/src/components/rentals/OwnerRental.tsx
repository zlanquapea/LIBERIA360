'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { ArrowLeftIcon, PhoneIcon, PlusIcon, TrashIcon } from '@heroicons/react/24/outline';
import { BrandLoader } from '@/components/BrandLoader';
import { OrderStepper } from '@/components/orders/OrderStepper';
import { ThreadChat } from '@/components/stays/StayChat';
import { formatMoney } from '@/lib/currency';
import {
  getRental,
  getRentalMessages,
  handOverCar,
  markRentalNoShow,
  markRentalRefunded,
  respondToRental,
  returnCar,
  sendRentalMessage,
  verifyRentalPayment,
  type FuelLevel,
  type Rental,
} from '@/lib/rentals-api';
import {
  FUEL_LABELS,
  FUEL_LEVELS,
  RENTAL_PAYMENT_LABELS,
  excessMileage,
  isOpenRental,
  rentalSteps,
  timeLeft,
  when,
} from '@/lib/rentals';
import { todayInLiberia } from '@/lib/stays';
import { RentalBadges, RentalBill, RentalReadings, RentalSchedule } from './RentalParts';

const usd = (n: number) => formatMoney(n, 'USD');
const errorText = (e: unknown, fallback: string) => (e instanceof Error ? e.message : fallback);

function FuelPicker({ value, onChange, name }: { value: FuelLevel | ''; onChange: (v: FuelLevel) => void; name: string }) {
  return (
    <fieldset>
      <legend className="mb-1 text-sm font-medium text-slate-700 dark:text-slate-200">Fuel</legend>
      <div className="flex flex-wrap gap-1.5">
        {FUEL_LEVELS.map((f) => (
          <label
            key={f}
            className={`flex min-h-10 cursor-pointer items-center rounded-full border px-3 text-sm ${
              value === f ? 'border-brand-600 bg-brand-600 font-semibold text-white' : 'border-slate-300 dark:border-slate-600'
            }`}
          >
            <input type="radio" name={name} value={f} checked={value === f} onChange={() => onChange(f)} className="sr-only" />
            {FUEL_LABELS[f]}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

function HandoverForm({ r, onDone }: { r: Rental; onDone: (r: Rental) => void }) {
  const [licence, setLicence] = useState(false);
  const [odometer, setOdometer] = useState('');
  const [fuel, setFuel] = useState<FuelLevel | ''>('full');
  const [deposit, setDeposit] = useState(r.depositAmount != null ? String(r.depositAmount) : '');
  const [paid, setPaid] = useState(r.paymentStatus === 'pay_at_pickup');
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const owesCash = r.paymentStatus === 'pay_at_pickup' || r.paymentStatus === 'failed' || r.paymentStatus === 'awaiting_verification';

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      onDone(
        await handOverCar(r.id, {
          licenceChecked: licence,
          odometer: odometer ? Number(odometer) : undefined,
          fuel: fuel || undefined,
          depositCollected: deposit ? Number(deposit) : undefined,
          notes: notes.trim() || undefined,
          paymentCollected: owesCash ? paid : undefined,
        }),
      );
    } catch (err) {
      setError(errorText(err, 'Could not hand over the car.'));
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4 rounded-[2rem] border border-brand-200 bg-brand-50/40 p-5 dark:border-brand-900 dark:bg-brand-950/20">
      <div>
        <h2 className="font-bold text-slate-950 dark:text-slate-50">Hand over the keys</h2>
        <p className="text-sm text-slate-600 dark:text-slate-300">Write down how the car leaves, so you both agree when it comes back.</p>
      </div>
      {!r.withDriver && (
        <label className="flex items-start gap-3 rounded-2xl bg-white p-3 text-sm dark:bg-slate-900">
          <input type="checkbox" checked={licence} onChange={(e) => setLicence(e.target.checked)} className="mt-0.5 h-5 w-5 accent-brand-600" />
          <span>
            <span className="block font-semibold text-slate-900 dark:text-slate-50">I&apos;ve seen the driving licence</span>
            <span className="text-slate-600 dark:text-slate-300">
              {r.licenceNumber ? `They gave licence number ${r.licenceNumber}.` : 'Check the name matches the renter.'}
            </span>
          </span>
        </label>
      )}
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-sm font-medium text-slate-700 dark:text-slate-200">
          Odometer (miles)
          <input type="number" min={0} inputMode="numeric" value={odometer} onChange={(e) => setOdometer(e.target.value)} placeholder="e.g. 42000" className="input mt-1 w-full" />
        </label>
        {r.depositAmount != null && (
          <label className="text-sm font-medium text-slate-700 dark:text-slate-200">
            Deposit taken (US$)
            <input type="number" min={0} step="0.01" inputMode="decimal" value={deposit} onChange={(e) => setDeposit(e.target.value)} className="input mt-1 w-full" />
          </label>
        )}
      </div>
      <FuelPicker value={fuel} onChange={setFuel} name="pickup-fuel" />
      <label className="text-sm font-medium text-slate-700 dark:text-slate-200">
        Condition notes
        <textarea rows={2} maxLength={1000} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Scratches, dents, spare tyre, jack…" className="input mt-1 w-full" />
      </label>
      {owesCash && (
        <label className="flex items-center gap-2 text-sm font-semibold text-slate-800 dark:text-slate-100">
          <input type="checkbox" checked={paid} onChange={(e) => setPaid(e.target.checked)} className="h-5 w-5 accent-brand-600" />
          I&apos;ve received {usd(r.totalAmount)} for the rental
        </label>
      )}
      {error && (
        <p role="alert" className="error-state">
          {error}
        </p>
      )}
      <button disabled={busy || (!r.withDriver && !licence)} className="btn-primary min-h-11 self-start">
        {busy ? 'Saving…' : 'Hand over the car'}
      </button>
    </form>
  );
}

function ReturnForm({ r, onDone }: { r: Rental; onDone: (r: Rental) => void }) {
  const [odometer, setOdometer] = useState('');
  const [fuel, setFuel] = useState<FuelLevel | ''>(r.pickupFuel ?? 'full');
  const [notes, setNotes] = useState('');
  const [extras, setExtras] = useState<Array<{ label: string; amount: string }>>([]);
  const [deposit, setDeposit] = useState(r.depositCollected != null ? String(r.depositCollected) : '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const driven = odometer && r.pickupOdometer != null ? Number(odometer) - r.pickupOdometer : 0;
  const mileage = excessMileage(r, driven);
  const extrasTotal = extras.reduce((n, x) => n + (Number(x.amount) || 0), 0);
  const left = timeLeft(r.dueBackAt);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      onDone(
        await returnCar(r.id, {
          odometer: odometer ? Number(odometer) : undefined,
          fuel: fuel || undefined,
          notes: notes.trim() || undefined,
          extraCharges: extras
            .filter((x) => x.label.trim() && Number(x.amount) > 0)
            .map((x) => ({ label: x.label.trim(), amount: Number(x.amount) })),
          depositReturned: deposit !== '' ? Number(deposit) : undefined,
        }),
      );
    } catch (err) {
      setError(errorText(err, 'Could not close the rental.'));
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4 rounded-[2rem] border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
      <div>
        <h2 className="font-bold text-slate-950 dark:text-slate-50">Car is back</h2>
        <p className={`text-sm ${left.late ? 'font-semibold text-red-700 dark:text-red-300' : 'text-slate-600 dark:text-slate-300'}`}>
          {left.late ? `${left.text} late.` : `Due ${when(r.returnDate, r.returnTime)}.`} Compare with the pickup readings below.
        </p>
      </div>
      <label className="text-sm font-medium text-slate-700 dark:text-slate-200">
        Odometer (miles)
        <input
          type="number"
          min={r.pickupOdometer ?? 0}
          inputMode="numeric"
          value={odometer}
          onChange={(e) => setOdometer(e.target.value)}
          placeholder={r.pickupOdometer != null ? `Was ${r.pickupOdometer} at pickup` : ''}
          className="input mt-1 w-full"
        />
        {driven > 0 && (
          <span className="mt-1 block text-xs font-normal text-slate-500">
            {driven.toLocaleString()} miles driven
            {r.mileageLimitPerDay != null ? `, allowance ${(r.mileageLimitPerDay * (r.rentalUnit === 'hour' ? 1 : r.units)).toLocaleString()}` : ''}.
          </span>
        )}
      </label>
      {mileage.over > 0 && !extras.some((x) => x.label.startsWith('Extra') && x.label.includes('miles')) && (
        <button
          type="button"
          onClick={() => setExtras((xs) => [...xs, { label: `Extra ${mileage.over} miles`, amount: String(mileage.charge) }])}
          className="self-start rounded-2xl bg-amber-50 px-3 py-2 text-left text-sm text-amber-900 dark:bg-amber-950/40 dark:text-amber-100"
        >
          {mileage.over} miles over the allowance: add {usd(mileage.charge)}
        </button>
      )}
      <FuelPicker value={fuel} onChange={setFuel} name="return-fuel" />
      <label className="text-sm font-medium text-slate-700 dark:text-slate-200">
        Condition notes
        <textarea rows={2} maxLength={1000} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Any new damage, cleanliness…" className="input mt-1 w-full" />
      </label>
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 text-sm font-medium text-slate-700 dark:text-slate-200">Extra charges</legend>
        {extras.map((x, i) => (
          <div key={i} className="flex gap-2">
            <input
              aria-label={`Charge ${i + 1}`}
              value={x.label}
              onChange={(e) => setExtras((xs) => xs.map((y, j) => (j === i ? { ...y, label: e.target.value } : y)))}
              placeholder="Fuel top-up, late return, cleaning…"
              className="input min-w-0 flex-1"
            />
            <input
              aria-label={`Amount ${i + 1}`}
              type="number"
              min={0}
              step="0.01"
              inputMode="decimal"
              value={x.amount}
              onChange={(e) => setExtras((xs) => xs.map((y, j) => (j === i ? { ...y, amount: e.target.value } : y)))}
              placeholder="US$"
              className="input w-24"
            />
            <button type="button" aria-label={`Remove charge ${i + 1}`} onClick={() => setExtras((xs) => xs.filter((_, j) => j !== i))} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-red-700 hover:bg-red-50 dark:text-red-300 dark:hover:bg-red-950/40">
              <TrashIcon aria-hidden className="h-5 w-5" />
            </button>
          </div>
        ))}
        <button type="button" onClick={() => setExtras((xs) => [...xs, { label: '', amount: '' }])} className="btn-secondary min-h-10 gap-1.5 self-start">
          <PlusIcon aria-hidden className="h-4 w-4" /> Add a charge
        </button>
      </fieldset>
      {r.depositCollected != null && (
        <label className="text-sm font-medium text-slate-700 dark:text-slate-200">
          Deposit given back (US$)
          <input type="number" min={0} max={r.depositCollected} step="0.01" inputMode="decimal" value={deposit} onChange={(e) => setDeposit(e.target.value)} className="input mt-1 w-full" />
          <span className="mt-1 block text-xs font-normal text-slate-500">
            You took {usd(r.depositCollected)}.
            {extrasTotal > 0 && ` Extras come to ${usd(extrasTotal)}: you can keep that from the deposit.`}
          </span>
        </label>
      )}
      {error && (
        <p role="alert" className="error-state">
          {error}
        </p>
      )}
      <button disabled={busy} className="btn-primary min-h-11 self-start">
        {busy ? 'Saving…' : extrasTotal > 0 ? `Close rental with ${usd(extrasTotal)} extra` : 'Close rental'}
      </button>
    </form>
  );
}

/** One rental on the owner's side, with the next thing to do on top. */
export function OwnerRental({ id }: { id: string }) {
  const [r, setR] = useState<Rental | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [actionError, setActionError] = useState('');
  const [message, setMessage] = useState('');
  const [declining, setDeclining] = useState(false);

  const load = useCallback(
    () =>
      getRental(id)
        .then(setR)
        .catch((e) => setError(errorText(e, 'Could not load this rental.'))),
    [id],
  );
  useEffect(() => {
    void load();
  }, [load]);

  const back = '/account/my-car-listings';
  if (error)
    return (
      <main className="mx-auto flex max-w-2xl flex-col gap-4 px-4 py-8">
        <p role="alert" className="error-state">
          {error}
        </p>
        <Link href={back} className="btn-secondary min-h-11 self-start">
          My fleet
        </Link>
      </main>
    );
  if (!r)
    return (
      <main className="flex min-h-[60vh] items-center justify-center">
        <BrandLoader />
      </main>
    );

  async function run(key: string, action: () => Promise<Rental>) {
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

  const due = r.pickupDate <= todayInLiberia();
  const awaitingMoney = r.paymentStatus === 'awaiting_verification';

  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-5 px-4 py-8">
      <Link href={back} className="flex items-center gap-1 self-start text-sm font-semibold text-brand-700 dark:text-brand-300">
        <ArrowLeftIcon aria-hidden className="h-4 w-4" /> My fleet
      </Link>

      <section className="flex flex-col gap-4 rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-bold uppercase tracking-wide text-slate-400">
              {r.carTitle} · #{r.code}
            </p>
            <h1 className="font-display text-2xl font-bold text-slate-950 dark:text-slate-50">{r.renterName}</h1>
            <a href={`tel:${r.renterPhone.replace(/\s/g, '')}`} className="mt-1 inline-flex items-center gap-1 text-sm font-semibold text-brand-700 dark:text-brand-300">
              <PhoneIcon aria-hidden className="h-4 w-4" /> {r.renterPhone}
            </a>
            {r.licenceNumber && <p className="text-xs text-slate-500">Licence {r.licenceNumber}</p>}
          </div>
          <RentalBadges r={r} owner />
        </div>
        {!['declined', 'cancelled', 'no_show'].includes(r.status) && <OrderStepper steps={rentalSteps(r)} />}
        <RentalSchedule r={r} />
        <RentalBill r={r} />
        {r.notes && (
          <p className="rounded-2xl bg-slate-50 p-3 text-sm dark:bg-slate-800/60">
            <span className="block text-xs font-semibold text-slate-500">From the renter</span>
            {r.notes}
          </p>
        )}
      </section>

      {isOpenRental(r) && awaitingMoney && (
        <div className="flex flex-col gap-3 rounded-2xl bg-amber-50 p-4 dark:bg-amber-950/40">
          <p className="text-sm text-amber-900 dark:text-amber-100">
            <strong>Check your {RENTAL_PAYMENT_LABELS[r.paymentMethod]}</strong>
            {r.paymentAccount ? ` (${r.paymentAccount})` : ''} for <strong>{usd(r.totalAmount)}</strong>, transaction{' '}
            <span className="font-mono font-bold">{r.paymentReference}</span>.
          </p>
          <div className="flex flex-wrap gap-2">
            <button type="button" disabled={busy !== null} onClick={() => void run('paid', () => verifyRentalPayment(r.id, true))} className="btn-primary min-h-11">
              {busy === 'paid' ? 'Saving…' : r.status === 'requested' ? 'Payment received, confirm' : 'Payment received'}
            </button>
            <button type="button" disabled={busy !== null} onClick={() => void run('missing', () => verifyRentalPayment(r.id, false))} className="btn-secondary min-h-11">
              Not found
            </button>
          </div>
        </div>
      )}

      {r.status === 'requested' && (
        <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 p-4 dark:border-slate-800">
          <p className="text-sm text-slate-700 dark:text-slate-200">
            {awaitingMoney
              ? 'Or decline if the car can’t go out.'
              : r.paymentStatus === 'failed'
                ? 'Waiting for the renter to send the right transaction ID.'
                : 'The car is held for this renter until you answer.'}
          </p>
          <label className="text-sm font-medium text-slate-700 dark:text-slate-200">
            Message to the renter (optional)
            <textarea
              rows={2}
              maxLength={1000}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder={declining ? 'e.g. Sorry, the car is in the garage that week.' : 'e.g. Meet me at the Total station in Sinkor.'}
              className="input mt-1 w-full"
            />
          </label>
          <div className="flex flex-wrap gap-2">
            {!awaitingMoney && r.paymentStatus !== 'failed' && (
              <button type="button" disabled={busy !== null} onClick={() => void run('confirm', () => respondToRental(r.id, 'confirm', message))} className="btn-primary min-h-11">
                {busy === 'confirm' ? 'Confirming…' : 'Confirm rental'}
              </button>
            )}
            {declining ? (
              <button type="button" disabled={busy !== null} onClick={() => void run('decline', () => respondToRental(r.id, 'decline', message))} className="min-h-11 rounded-full bg-red-600 px-5 text-sm font-bold text-white hover:bg-red-700 disabled:opacity-50">
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

      {r.status === 'confirmed' &&
        (due ? (
          <>
            <HandoverForm r={r} onDone={setR} />
            <button
              type="button"
              disabled={busy !== null}
              onClick={() => void run('noshow', () => markRentalNoShow(r.id))}
              className="self-start text-sm font-semibold text-red-700 underline dark:text-red-300"
            >
              The renter didn&apos;t come
            </button>
          </>
        ) : (
          <p className="rounded-2xl border border-slate-200 p-4 text-sm text-slate-700 dark:border-slate-800 dark:text-slate-200">
            Goes out {when(r.pickupDate, r.pickupTime)}. You can hand it over from that day.
          </p>
        ))}

      {r.status === 'on_trip' && <ReturnForm r={r} onDone={setR} />}

      {r.paymentStatus === 'refund_due' && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-orange-50 p-4 dark:bg-orange-950/40">
          <p className="text-sm text-orange-900 dark:text-orange-100">
            Refund {usd(r.totalAmount)} by {RENTAL_PAYMENT_LABELS[r.paymentMethod]} (transaction{' '}
            <span className="font-mono">{r.paymentReference}</span>).
          </p>
          <button type="button" disabled={busy !== null} onClick={() => void run('refund', () => markRentalRefunded(r.id))} className="btn-secondary min-h-10">
            {busy === 'refund' ? 'Saving…' : 'Mark refunded'}
          </button>
        </div>
      )}

      {actionError && (
        <p role="alert" className="error-state">
          {actionError}
        </p>
      )}

      <RentalReadings r={r} />

      <div className="flex flex-col gap-2">
        <h2 className="text-lg font-bold text-slate-950 dark:text-slate-50">Messages with {r.renterName}</h2>
        <ThreadChat
          threadId={r.id}
          load={getRentalMessages}
          send={sendRentalMessage}
          otherName={r.renterName}
          emptyHint="Agree where to meet, send directions, or confirm a delivery time."
        />
      </div>
    </main>
  );
}
