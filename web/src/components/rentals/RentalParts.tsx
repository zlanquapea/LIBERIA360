'use client';

import Link from 'next/link';
import { ChatBubbleLeftRightIcon, ClockIcon } from '@heroicons/react/24/outline';
import { SafeImage } from '@/components/SafeImage';
import { formatMoney } from '@/lib/currency';
import { resolveImageUrl, resolveThumbUrl } from '@/lib/images';
import type { Rental } from '@/lib/rentals-api';
import {
  FUEL_LABELS,
  OWNER_STATUS_LABELS,
  RENTAL_PAYMENT_BADGES,
  RENTAL_PAYMENT_LABELS,
  RENTAL_STATUS_LABELS,
  durationLabel,
  rentalStatusClass,
  timeLeft,
  when,
} from '@/lib/rentals';

const usd = (n: number) => formatMoney(n, 'USD');

export function RentalBadges({ r, owner = false }: { r: Rental; owner?: boolean }) {
  const pay = RENTAL_PAYMENT_BADGES[r.paymentStatus];
  const showPay = r.paymentStatus !== 'paid' && !(r.paymentStatus === 'pay_at_pickup' && !owner);
  return (
    <span className="flex flex-wrap gap-1.5">
      <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${rentalStatusClass(r.status, r.overdue)}`}>
        {r.overdue ? 'Late' : (owner ? OWNER_STATUS_LABELS : RENTAL_STATUS_LABELS)[r.status]}
      </span>
      {showPay && <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${pay.style}`}>{pay.label}</span>}
    </span>
  );
}

/** Pickup and return, where, and what's included. */
export function RentalSchedule({ r }: { r: Rental }) {
  const place = r.delivery ? `Delivered to ${r.deliveryAddress}` : r.pickupLocation ? `Collect at ${r.pickupLocation}` : null;
  return (
    <dl className="grid grid-cols-2 gap-3 text-sm">
      <div className="rounded-2xl bg-slate-50 p-3 dark:bg-slate-800/60">
        <dt className="text-xs text-slate-500 dark:text-slate-400">Pickup</dt>
        <dd className="font-bold text-slate-950 dark:text-slate-50">{when(r.pickupDate, r.pickupTime)}</dd>
      </div>
      <div className="rounded-2xl bg-slate-50 p-3 dark:bg-slate-800/60">
        <dt className="text-xs text-slate-500 dark:text-slate-400">Return</dt>
        <dd className="font-bold text-slate-950 dark:text-slate-50">{when(r.returnDate, r.returnTime)}</dd>
      </div>
      {place && (
        <div className="col-span-2">
          <dt className="sr-only">Where</dt>
          <dd className="text-slate-700 dark:text-slate-200">{place}</dd>
        </div>
      )}
      <div className="col-span-2 flex flex-wrap gap-1.5">
        <dt className="sr-only">Includes</dt>
        <dd className="rounded-full bg-slate-100 px-2.5 py-1 text-xs dark:bg-slate-800">{durationLabel(r)}</dd>
        {r.withDriver && <dd className="rounded-full bg-slate-100 px-2.5 py-1 text-xs dark:bg-slate-800">With driver</dd>}
        {r.additionalDriver && <dd className="rounded-full bg-slate-100 px-2.5 py-1 text-xs dark:bg-slate-800">Second driver</dd>}
        {r.mileageLimitPerDay != null && (
          <dd className="rounded-full bg-slate-100 px-2.5 py-1 text-xs dark:bg-slate-800">{r.mileageLimitPerDay} miles a day</dd>
        )}
      </div>
    </dl>
  );
}

/** What it costs, line by line, then the deposit and any extras. */
export function RentalBill({ r }: { r: Rental }) {
  const lines: Array<[string, number]> = [[`${usd(r.unitPrice)} × ${durationLabel(r)}`, r.baseAmount]];
  if (r.driverFee) lines.push(['Driver', r.driverFee]);
  if (r.additionalDriverFee) lines.push(['Second driver', r.additionalDriverFee]);
  if (r.deliveryFee) lines.push(['Delivery', r.deliveryFee]);
  return (
    <div className="flex flex-col gap-1.5 text-sm">
      {lines.map(([label, amount]) => (
        <p key={label} className="flex justify-between gap-3 text-slate-600 dark:text-slate-300">
          <span>{label}</span>
          <span>{usd(amount)}</span>
        </p>
      ))}
      <p className="flex justify-between gap-3 border-t border-slate-100 pt-1.5 font-bold text-slate-950 dark:border-slate-800 dark:text-slate-50">
        <span>Rental · {RENTAL_PAYMENT_LABELS[r.paymentMethod]}</span>
        <span>{usd(r.totalAmount)}</span>
      </p>
      {r.extraCharges.map((c) => (
        <p key={c.label} className="flex justify-between gap-3 text-orange-800 dark:text-orange-200">
          <span>{c.label}</span>
          <span>{usd(c.amount)}</span>
        </p>
      ))}
      {r.depositAmount != null && (
        <p className="flex justify-between gap-3 text-xs text-slate-500 dark:text-slate-400">
          <span>
            Refundable deposit
            {r.depositCollected != null ? ` · ${usd(r.depositCollected)} collected` : ' · paid in cash at pickup'}
            {r.depositReturned != null ? ` · ${usd(r.depositReturned)} returned` : ''}
          </span>
          <span>{usd(r.depositAmount)}</span>
        </p>
      )}
    </div>
  );
}

/** The handover and return readings both sides agreed on. */
export function RentalReadings({ r }: { r: Rental }) {
  if (!r.pickedUpAt) return null;
  const driven = r.returnOdometer != null && r.pickupOdometer != null ? r.returnOdometer - r.pickupOdometer : null;
  const row = (label: string, pickup: string | null, back: string | null) => (
    <tr className="border-t border-slate-100 dark:border-slate-800">
      <th scope="row" className="py-1.5 pr-3 text-left font-medium text-slate-500 dark:text-slate-400">
        {label}
      </th>
      <td className="py-1.5 pr-3">{pickup ?? '—'}</td>
      <td className="py-1.5">{r.returnedAt ? (back ?? '—') : '…'}</td>
    </tr>
  );
  return (
    <section className="flex flex-col gap-2 rounded-[2rem] border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
      <h2 className="font-bold text-slate-950 dark:text-slate-50">Car check</h2>
      <table className="w-full text-sm">
        <thead>
          <tr className="text-xs text-slate-500">
            <th />
            <th className="pb-1 text-left font-semibold">Pickup</th>
            <th className="pb-1 text-left font-semibold">Return</th>
          </tr>
        </thead>
        <tbody>
          {row('Odometer', r.pickupOdometer?.toLocaleString() ?? null, r.returnOdometer?.toLocaleString() ?? null)}
          {row('Fuel', r.pickupFuel ? FUEL_LABELS[r.pickupFuel] : null, r.returnFuel ? FUEL_LABELS[r.returnFuel] : null)}
          {row('Notes', r.pickupNotes, r.returnNotes)}
        </tbody>
      </table>
      {driven != null && <p className="text-xs text-slate-500">{driven.toLocaleString()} miles driven.</p>}
      {r.licenceChecked && <p className="text-xs text-slate-500">Driving licence checked at pickup.</p>}
    </section>
  );
}

/** One rental in a list: the renter's own, or a row on the owner's desk. */
export function RentalCard({ r, href, owner = false }: { r: Rental; href: string; owner?: boolean }) {
  const left = r.status === 'on_trip' ? timeLeft(r.dueBackAt) : null;
  return (
    <Link
      href={href}
      className="flex gap-3 rounded-[1.5rem] border border-slate-200 bg-white p-3 shadow-sm transition hover:border-brand-300 hover:shadow-md dark:border-slate-800 dark:bg-slate-900"
    >
      <SafeImage
        src={r.carImage ? resolveImageUrl(r.carImage) : null}
        thumbSrc={r.carImage ? resolveThumbUrl(r.carImage) : null}
        alt=""
        className="h-20 w-24 shrink-0 rounded-2xl object-cover"
        fallback={
          <div aria-hidden className="flex h-20 w-24 shrink-0 items-center justify-center rounded-2xl bg-brand-50 text-3xl dark:bg-brand-950/40">
            🚙
          </div>
        }
      />
      <span className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="flex flex-wrap items-start justify-between gap-2">
          <span className="min-w-0">
            <span className="block truncate font-semibold text-slate-950 dark:text-slate-50">{owner ? r.renterName : r.carTitle}</span>
            <span className="block text-xs text-slate-500 dark:text-slate-400">
              {when(r.pickupDate, r.pickupTime)} → {when(r.returnDate, r.returnTime)}
            </span>
          </span>
          <RentalBadges r={r} owner={owner} />
        </span>
        {owner && <span className="text-sm text-slate-700 dark:text-slate-300">{r.carTitle}</span>}
        {left && (
          <span className={`flex items-center gap-1 text-xs font-semibold ${left.late ? 'text-red-700 dark:text-red-300' : 'text-emerald-700 dark:text-emerald-300'}`}>
            <ClockIcon aria-hidden className="h-4 w-4" />
            {left.late ? `${left.text} late` : `Due back in ${left.text}`}
          </span>
        )}
        <span className="mt-auto flex items-center justify-between gap-2 text-xs text-slate-500 dark:text-slate-400">
          <span>
            {usd(r.totalAmount)} · #{r.code}
            {r.delivery ? ' · Delivery' : ''}
          </span>
          {r.unreadMessages > 0 && (
            <span className="flex items-center gap-1 rounded-full bg-brand-600 px-2 py-0.5 font-semibold text-white">
              <ChatBubbleLeftRightIcon aria-hidden className="h-3.5 w-3.5" />
              {r.unreadMessages} new
            </span>
          )}
        </span>
      </span>
    </Link>
  );
}
