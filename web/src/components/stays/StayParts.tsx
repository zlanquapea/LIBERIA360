'use client';

import Link from 'next/link';
import { ChatBubbleLeftRightIcon } from '@heroicons/react/24/outline';
import { SafeImage } from '@/components/SafeImage';
import { formatMoney } from '@/lib/currency';
import { resolveImageUrl, resolveThumbUrl } from '@/lib/images';
import type { Reservation } from '@/lib/stays-api';
import {
  DESK_STATUS_LABELS,
  RESERVATION_STATUS_LABELS,
  STAY_PAYMENT_BADGES,
  STAY_PAYMENT_LABELS,
  guestsLabel,
  nightsLabel,
  reservationStatusClass,
  stayDate,
} from '@/lib/stays';

export function StayBadges({ r, desk = false }: { r: Reservation; desk?: boolean }) {
  const pay = STAY_PAYMENT_BADGES[r.paymentStatus];
  const showPay = r.paymentStatus !== 'paid' && !(r.paymentStatus === 'pay_at_property' && !desk);
  return (
    <span className="flex flex-wrap gap-1.5">
      <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${reservationStatusClass(r.status)}`}>
        {(desk ? DESK_STATUS_LABELS : RESERVATION_STATUS_LABELS)[r.status]}
      </span>
      {showPay && <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${pay.style}`}>{pay.label}</span>}
    </span>
  );
}

/** Dates, room, guests and price at a glance. */
export function StaySummary({ r }: { r: Reservation }) {
  return (
    <dl className="grid grid-cols-2 gap-3 text-sm">
      <div className="rounded-2xl bg-slate-50 p-3 dark:bg-slate-800/60">
        <dt className="text-xs text-slate-500 dark:text-slate-400">Check-in</dt>
        <dd className="font-bold text-slate-950 dark:text-slate-50">{stayDate(r.checkIn)}</dd>
      </div>
      <div className="rounded-2xl bg-slate-50 p-3 dark:bg-slate-800/60">
        <dt className="text-xs text-slate-500 dark:text-slate-400">Check-out</dt>
        <dd className="font-bold text-slate-950 dark:text-slate-50">{stayDate(r.checkOut)}</dd>
      </div>
      <div className="col-span-2 flex flex-wrap justify-between gap-2 border-b border-slate-100 pb-3 dark:border-slate-800">
        <dt className="sr-only">Room</dt>
        <dd className="text-slate-800 dark:text-slate-100">
          {r.rooms} × {r.roomName}
          {r.roomNumbers && <span className="font-semibold"> · Room {r.roomNumbers}</span>}
        </dd>
        <dd className="text-slate-500 dark:text-slate-400">
          {nightsLabel(r.nights)} · {guestsLabel(r.adults, r.children)}
        </dd>
      </div>
      <div className="col-span-2 flex justify-between gap-2">
        <dt className="text-slate-500 dark:text-slate-400">
          {formatMoney(r.pricePerNight, r.currency)} × {nightsLabel(r.nights)}
          {r.rooms > 1 ? ` × ${r.rooms} rooms` : ''} · {STAY_PAYMENT_LABELS[r.paymentMethod]}
        </dt>
        <dd className="text-base font-bold text-slate-950 dark:text-slate-50">{formatMoney(r.totalAmount, r.currency)}</dd>
      </div>
    </dl>
  );
}

/** One stay in a list: the guest's own, or a row at the front desk. */
export function StayCard({ r, href, desk = false }: { r: Reservation; href: string; desk?: boolean }) {
  const image = desk ? r.roomImage : (r.property.image ?? r.roomImage);
  return (
    <Link
      href={href}
      className="flex gap-3 rounded-[1.5rem] border border-slate-200 bg-white p-3 shadow-sm transition hover:border-brand-300 hover:shadow-md dark:border-slate-800 dark:bg-slate-900"
    >
      <SafeImage
        src={image ? resolveImageUrl(image) : null}
        thumbSrc={image ? resolveThumbUrl(image) : null}
        alt=""
        className="h-20 w-20 shrink-0 rounded-2xl object-cover"
        fallback={
          <div aria-hidden className="flex h-20 w-20 shrink-0 items-center justify-center rounded-2xl bg-brand-50 text-3xl dark:bg-brand-950/40">
            🛏️
          </div>
        }
      />
      <span className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="flex flex-wrap items-start justify-between gap-2">
          <span className="min-w-0">
            <span className="block truncate font-semibold text-slate-950 dark:text-slate-50">
              {desk ? r.guestName : r.property.name}
            </span>
            <span className="block text-xs text-slate-500 dark:text-slate-400">
              {stayDate(r.checkIn)} → {stayDate(r.checkOut)} · {nightsLabel(r.nights)}
            </span>
          </span>
          <StayBadges r={r} desk={desk} />
        </span>
        <span className="text-sm text-slate-700 dark:text-slate-300">
          {r.rooms} × {r.roomName}
          {r.roomNumbers ? ` · Room ${r.roomNumbers}` : ''}
          {desk && r.source === 'walk_in' ? ' · Walk-in' : ''}
        </span>
        <span className="mt-auto flex items-center justify-between gap-2 text-xs text-slate-500 dark:text-slate-400">
          <span>
            {formatMoney(r.totalAmount, r.currency)} · #{r.code}
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
