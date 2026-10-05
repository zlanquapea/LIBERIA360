'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import {
  ArrowRightIcon,
  BoltIcon,
  BuildingStorefrontIcon,
  CalendarDaysIcon,
  ClockIcon,
  DevicePhoneMobileIcon,
  MinusIcon,
  PlusIcon,
  UserGroupIcon,
} from '@heroicons/react/24/outline';
import { useAuth } from '@/hooks/useAuth';
import { SafeImage } from '@/components/SafeImage';
import { MenuSheet } from '@/components/menu/MenuSheet';
import { ChoiceCard, CopyButton } from '@/components/menu/CartSheet';
import { formatMoney } from '@/lib/currency';
import { resolveImageUrl, resolveThumbUrl } from '@/lib/images';
import {
  getStayAvailability,
  reserveRoom,
  type PublicRoomType,
  type PublicStay,
  type StayAvailability,
  type StayPaymentMethod,
} from '@/lib/stays-api';
import {
  addDays,
  clockTime,
  guestsLabel,
  nightsBetween,
  nightsLabel,
  stayDate,
  todayInLiberia,
} from '@/lib/stays';

type Selection = { room: PublicRoomType; rooms: number };

const METHOD_ICON: Record<StayPaymentMethod, React.ReactNode> = {
  pay_at_property: <BuildingStorefrontIcon className="h-5 w-5" />,
  mtn_momo: <span className="block h-4 w-4 rounded-full bg-yellow-400" />,
  orange_money: <span className="block h-4 w-4 rounded-full bg-orange-500" />,
};

function Counter({
  label,
  value,
  min,
  max,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (n: number) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-sm font-medium text-slate-700 dark:text-slate-200">{label}</span>
      <span className="flex items-center gap-1">
        <button
          type="button"
          aria-label={`Fewer ${label.toLowerCase()}`}
          disabled={value <= min}
          onClick={() => onChange(value - 1)}
          className="flex h-9 w-9 items-center justify-center rounded-full border border-slate-300 disabled:opacity-30 dark:border-slate-600"
        >
          <MinusIcon aria-hidden className="h-4 w-4" />
        </button>
        <span aria-live="polite" className="w-6 text-center font-bold tabular-nums">
          {value}
        </span>
        <button
          type="button"
          aria-label={`More ${label.toLowerCase()}`}
          disabled={value >= max}
          onClick={() => onChange(value + 1)}
          className="flex h-9 w-9 items-center justify-center rounded-full border border-slate-300 disabled:opacity-30 dark:border-slate-600"
        >
          <PlusIcon aria-hidden className="h-4 w-4" />
        </button>
      </span>
    </div>
  );
}

/**
 * Pick dates and guests, see what's free with the real price, choose a
 * room and book it, the same way you order from a restaurant's menu.
 */
export function StayBooking({
  business,
  stay,
  initialCheckIn,
  initialCheckOut,
}: {
  business: { id: string; name: string; slug: string };
  stay: PublicStay;
  initialCheckIn?: string;
  initialCheckOut?: string;
}) {
  const { user, ready } = useAuth();
  const router = useRouter();
  const today = todayInLiberia();
  const [checkIn, setCheckIn] = useState(initialCheckIn && initialCheckIn >= today ? initialCheckIn : today);
  const [checkOut, setCheckOut] = useState(
    initialCheckOut && initialCheckOut > (initialCheckIn ?? today) ? initialCheckOut : addDays(checkIn, 1),
  );
  const [adults, setAdults] = useState(2);
  const [children, setChildren] = useState(0);
  const [availability, setAvailability] = useState<StayAvailability | null>(null);
  const [loading, setLoading] = useState(false);
  const [searchError, setSearchError] = useState('');
  const [roomCounts, setRoomCounts] = useState<Record<string, number>>({});
  const [selection, setSelection] = useState<Selection | null>(null);

  const [guestName, setGuestName] = useState('');
  const [guestPhone, setGuestPhone] = useState('');
  const [arrivalTime, setArrivalTime] = useState('');
  const [requests, setRequests] = useState('');
  const [method, setMethod] = useState<StayPaymentMethod>(stay.paymentOptions[0]?.method ?? 'pay_at_property');
  const [reference, setReference] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!user) return;
    setGuestName((v) => v || user.name || '');
    setGuestPhone((v) => v || (user as { phone?: string | null }).phone || '');
  }, [user]);

  const nights = nightsBetween(checkIn, checkOut);
  const datesOk = checkIn >= today && nights >= 1 && nights <= 60;

  useEffect(() => {
    if (!datesOk) return;
    let live = true;
    setLoading(true);
    setSearchError('');
    getStayAvailability(business.id, checkIn, checkOut)
      .then((a) => live && setAvailability(a))
      .catch((e) => live && setSearchError(e instanceof Error ? e.message : 'Could not check rooms.'))
      .finally(() => live && setLoading(false));
    return () => {
      live = false;
    };
  }, [business.id, checkIn, checkOut, datesOk]);

  const left = useMemo(
    () => new Map(availability?.rooms.map((r) => [r.roomTypeId, r.roomsLeft]) ?? []),
    [availability],
  );
  const guests = adults + children;
  const currency = stay.currency;
  const option = stay.paymentOptions.find((o) => o.method === method);
  const mobile = method !== 'pay_at_property';
  const returnTo = `/businesses/${business.slug}/book?checkIn=${checkIn}&checkOut=${checkOut}`;

  function roomsFor(room: PublicRoomType) {
    return roomCounts[room.id] ?? Math.max(1, Math.ceil(guests / room.maxGuests));
  }

  function changeCheckIn(value: string) {
    setCheckIn(value);
    if (checkOut <= value) setCheckOut(addDays(value, 1));
  }

  async function submit() {
    if (!selection) return;
    if (guestName.trim().length < 2) return setError('Add the name the booking is under.');
    if (guestPhone.replace(/\D/g, '').length < 6) return setError('Add a phone number the hotel can call.');
    if (mobile && reference.trim().length < 4)
      return setError('Enter the transaction ID from your mobile money SMS.');
    setSubmitting(true);
    setError('');
    try {
      const r = await reserveRoom({
        roomTypeId: selection.room.id,
        checkIn,
        checkOut,
        rooms: selection.rooms,
        adults,
        children,
        guestName: guestName.trim(),
        guestPhone: guestPhone.trim(),
        arrivalTime: arrivalTime.trim() || undefined,
        specialRequests: requests.trim() || undefined,
        paymentMethod: method,
        paymentReference: mobile ? reference.trim() : undefined,
      });
      router.push(`/account/stays/${r.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not book the room.');
      setSubmitting(false);
    }
  }

  const total = selection ? selection.room.pricePerNight * nights * selection.rooms : 0;

  let footer: React.ReactNode = null;
  if (selection && ready && !user) {
    footer = (
      <Link
        href={`/login?next=${encodeURIComponent(returnTo)}`}
        className="flex min-h-12 items-center justify-center gap-2 rounded-full bg-brand-700 px-5 text-sm font-bold text-white hover:bg-brand-800"
      >
        Log in to book <ArrowRightIcon aria-hidden className="h-4 w-4" />
      </Link>
    );
  } else if (selection) {
    footer = (
      <div className="flex flex-col gap-2">
        {error && (
          <p role="alert" className="text-center text-sm font-semibold text-flag-700 dark:text-flag-300">
            {error}
          </p>
        )}
        <button
          type="button"
          disabled={submitting}
          onClick={() => void submit()}
          className="flex min-h-12 items-center justify-between gap-2 rounded-full bg-brand-700 px-5 text-sm font-bold text-white shadow-lg shadow-brand-700/25 transition hover:bg-brand-800 disabled:opacity-50"
        >
          <span>{submitting ? 'Booking…' : mobile ? 'Submit payment & book' : stay.instantConfirm ? 'Book now' : 'Request to book'}</span>
          <span>{formatMoney(total, currency)}</span>
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <section
        aria-label="Your dates"
        className="grid gap-4 rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:grid-cols-2"
      >
        <div className="grid grid-cols-2 gap-3 sm:col-span-2">
          <label className="text-xs font-semibold text-slate-600 dark:text-slate-300">
            Check-in
            <input
              type="date"
              min={today}
              value={checkIn}
              onChange={(e) => e.target.value && changeCheckIn(e.target.value)}
              className="input mt-1 w-full"
            />
          </label>
          <label className="text-xs font-semibold text-slate-600 dark:text-slate-300">
            Check-out
            <input
              type="date"
              min={addDays(checkIn, 1)}
              value={checkOut}
              onChange={(e) => e.target.value && setCheckOut(e.target.value)}
              className="input mt-1 w-full"
            />
          </label>
        </div>
        <div className="flex flex-col gap-2 sm:col-span-2 sm:flex-row sm:gap-8">
          <div className="flex-1">
            <Counter label="Adults" value={adults} min={1} max={30} onChange={setAdults} />
          </div>
          <div className="flex-1">
            <Counter label="Children" value={children} min={0} max={20} onChange={setChildren} />
          </div>
        </div>
        <p className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-slate-600 dark:text-slate-300 sm:col-span-2">
          <span className="flex items-center gap-1.5">
            <CalendarDaysIcon aria-hidden className="h-4 w-4 text-brand-600" />
            {datesOk ? `${nightsLabel(nights)} · ${stayDate(checkIn)} to ${stayDate(checkOut)}` : 'Choose your dates'}
          </span>
          <span className="flex items-center gap-1.5">
            <UserGroupIcon aria-hidden className="h-4 w-4 text-brand-600" />
            {guestsLabel(adults, children)}
          </span>
        </p>
        {!datesOk && nights > 60 && (
          <p className="text-sm text-flag-700 sm:col-span-2">Book up to 60 nights at a time.</p>
        )}
      </section>

      <ul className="flex flex-wrap gap-2 text-xs font-semibold text-slate-600 dark:text-slate-300">
        <li className="flex items-center gap-1 rounded-full bg-slate-100 px-3 py-1.5 dark:bg-slate-800">
          <ClockIcon aria-hidden className="h-4 w-4" /> Check-in from {clockTime(stay.checkInTime)} · out by{' '}
          {clockTime(stay.checkOutTime)}
        </li>
        {stay.instantConfirm && (
          <li className="flex items-center gap-1 rounded-full bg-emerald-50 px-3 py-1.5 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200">
            <BoltIcon aria-hidden className="h-4 w-4" /> Instant confirmation
          </li>
        )}
        {stay.paymentOptions.map((o) => (
          <li key={o.method} className="rounded-full bg-slate-100 px-3 py-1.5 dark:bg-slate-800">
            {o.label}
          </li>
        ))}
      </ul>

      {searchError && (
        <p role="alert" className="error-state">
          {searchError}
        </p>
      )}

      <section aria-label="Rooms" aria-busy={loading} className="flex flex-col gap-4">
        {stay.roomTypes.map((room) => {
          const roomsLeft = left.get(room.id);
          const count = Math.min(roomsFor(room), Math.max(1, roomsLeft ?? 1));
          const fits = guests <= room.maxGuests * count;
          const soldOut = roomsLeft === 0;
          const image = room.images[0];
          return (
            <article
              key={room.id}
              className={`overflow-hidden rounded-[2rem] border bg-white shadow-sm dark:bg-slate-900 ${
                soldOut ? 'border-slate-200 opacity-70 dark:border-slate-800' : 'border-slate-200 dark:border-slate-800'
              }`}
            >
              <div className="flex flex-col sm:flex-row">
                <SafeImage
                  src={image ? resolveImageUrl(image) : null}
                  thumbSrc={image ? resolveThumbUrl(image) : null}
                  alt=""
                  className="aspect-[4/3] w-full object-cover sm:w-56"
                  fallback={
                    <div
                      aria-hidden
                      className="flex aspect-[4/3] w-full items-center justify-center bg-gradient-to-br from-brand-100 to-sky-100 text-4xl dark:from-brand-950 dark:to-slate-800 sm:w-56"
                    >
                      🛏️
                    </div>
                  }
                />
                <div className="flex min-w-0 flex-1 flex-col gap-3 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <h3 className="font-display text-lg font-bold text-slate-950 dark:text-slate-50">{room.name}</h3>
                      <p className="text-sm text-slate-500 dark:text-slate-400">
                        {[room.bedSummary, `Sleeps ${room.maxGuests}`].filter(Boolean).join(' · ')}
                      </p>
                    </div>
                    {roomsLeft !== undefined && (
                      <span
                        className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-bold ${
                          soldOut
                            ? 'bg-red-100 text-red-800 dark:bg-red-950/50 dark:text-red-200'
                            : roomsLeft <= 2
                              ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-200'
                              : 'bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200'
                        }`}
                      >
                        {soldOut ? 'Sold out' : roomsLeft <= 2 ? `Only ${roomsLeft} left` : `${roomsLeft} available`}
                      </span>
                    )}
                  </div>
                  {room.description && (
                    <p className="text-sm text-slate-600 dark:text-slate-300">{room.description}</p>
                  )}
                  {room.amenities.length > 0 && (
                    <ul className="flex flex-wrap gap-1.5">
                      {room.amenities.slice(0, 6).map((a) => (
                        <li key={a} className="rounded-full bg-slate-100 px-2.5 py-1 text-xs text-slate-700 dark:bg-slate-800 dark:text-slate-200">
                          {a}
                        </li>
                      ))}
                      {room.amenities.length > 6 && (
                        <li className="px-1 py-1 text-xs text-slate-500">+{room.amenities.length - 6} more</li>
                      )}
                    </ul>
                  )}
                  <div className="mt-auto flex flex-wrap items-end justify-between gap-3 border-t border-slate-100 pt-3 dark:border-slate-800">
                    <div>
                      <p className="text-lg font-bold text-slate-950 dark:text-slate-50">
                        {formatMoney(room.pricePerNight, currency)}
                        <span className="text-sm font-normal text-slate-500"> / night</span>
                      </p>
                      {datesOk && (
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          {formatMoney(room.pricePerNight * nights * count, currency)} for {nightsLabel(nights)}
                          {count > 1 ? `, ${count} rooms` : ''}
                        </p>
                      )}
                    </div>
                    {!soldOut && (
                      <div className="flex items-center gap-2">
                        {(roomsLeft ?? 1) > 1 && (
                          <label className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                            <span className="sr-only">Rooms of {room.name}</span>
                            <select
                              value={count}
                              onChange={(e) => setRoomCounts((c) => ({ ...c, [room.id]: Number(e.target.value) }))}
                              className="input h-11 py-0"
                            >
                              {Array.from({ length: Math.min(roomsLeft ?? 1, 10) }, (_, i) => i + 1).map((n) => (
                                <option key={n} value={n}>
                                  {n} {n === 1 ? 'room' : 'rooms'}
                                </option>
                              ))}
                            </select>
                          </label>
                        )}
                        <button
                          type="button"
                          disabled={!datesOk || roomsLeft === undefined || !fits}
                          onClick={() => {
                            setError('');
                            setSelection({ room, rooms: count });
                          }}
                          className="btn-primary min-h-11 px-5"
                        >
                          Reserve
                        </button>
                      </div>
                    )}
                  </div>
                  {!fits && !soldOut && (
                    <p className="text-xs font-medium text-amber-800 dark:text-amber-200">
                      Sleeps up to {room.maxGuests} per room. Choose more rooms for {guests} guests.
                    </p>
                  )}
                </div>
              </div>
            </article>
          );
        })}
      </section>

      {(stay.cancellationPolicy || stay.houseRules) && (
        <section className="grid gap-3 sm:grid-cols-2">
          {stay.cancellationPolicy && (
            <div className="rounded-2xl bg-slate-50 p-4 text-sm dark:bg-slate-800/60">
              <h3 className="font-bold text-slate-900 dark:text-slate-50">Cancellation</h3>
              <p className="mt-1 whitespace-pre-line text-slate-600 dark:text-slate-300">{stay.cancellationPolicy}</p>
            </div>
          )}
          {stay.houseRules && (
            <div className="rounded-2xl bg-slate-50 p-4 text-sm dark:bg-slate-800/60">
              <h3 className="font-bold text-slate-900 dark:text-slate-50">House rules</h3>
              <p className="mt-1 whitespace-pre-line text-slate-600 dark:text-slate-300">{stay.houseRules}</p>
            </div>
          )}
        </section>
      )}

      <MenuSheet open={Boolean(selection)} onClose={() => setSelection(null)} label="Your booking" footer={footer}>
        {selection && (
          <div className="flex flex-col gap-5 px-5 pb-5 pt-6">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-brand-700 dark:text-brand-300">Your booking</p>
              <h2 className="mt-1 font-display text-2xl font-bold text-slate-950 dark:text-slate-50">{business.name}</h2>
            </div>
            <dl className="grid grid-cols-2 gap-3 rounded-3xl bg-slate-50 p-4 text-sm dark:bg-slate-800/60">
              <div>
                <dt className="text-xs text-slate-500 dark:text-slate-400">Check-in</dt>
                <dd className="font-semibold">{stayDate(checkIn)}</dd>
                <dd className="text-xs text-slate-500">from {clockTime(stay.checkInTime)}</dd>
              </div>
              <div>
                <dt className="text-xs text-slate-500 dark:text-slate-400">Check-out</dt>
                <dd className="font-semibold">{stayDate(checkOut)}</dd>
                <dd className="text-xs text-slate-500">by {clockTime(stay.checkOutTime)}</dd>
              </div>
              <div className="col-span-2 border-t border-slate-200 pt-3 dark:border-slate-700">
                <dt className="sr-only">Room</dt>
                <dd className="flex justify-between gap-2">
                  <span>
                    {selection.rooms} × {selection.room.name}
                  </span>
                  <span>{formatMoney(selection.room.pricePerNight, currency)} / night</span>
                </dd>
                <dd className="flex justify-between gap-2 text-slate-500">
                  <span>
                    {nightsLabel(nights)} · {guestsLabel(adults, children)}
                  </span>
                </dd>
                <dd className="mt-2 flex justify-between gap-2 text-base font-bold">
                  <span>Total</span>
                  <span>{formatMoney(total, currency)}</span>
                </dd>
              </div>
            </dl>

            <fieldset className="grid gap-3 sm:grid-cols-2">
              <legend className="mb-2 text-sm font-bold text-slate-900 dark:text-slate-50">Who&apos;s staying</legend>
              <label className="text-sm font-medium text-slate-700 dark:text-slate-200">
                Name on the booking
                <input value={guestName} onChange={(e) => setGuestName(e.target.value)} autoComplete="name" className="input mt-1 w-full" />
              </label>
              <label className="text-sm font-medium text-slate-700 dark:text-slate-200">
                Phone
                <input
                  type="tel"
                  inputMode="tel"
                  autoComplete="tel"
                  value={guestPhone}
                  onChange={(e) => setGuestPhone(e.target.value)}
                  placeholder="0886 123 456"
                  className="input mt-1 w-full"
                />
              </label>
              <label className="text-sm font-medium text-slate-700 dark:text-slate-200 sm:col-span-2">
                Arriving around (optional)
                <input
                  value={arrivalTime}
                  onChange={(e) => setArrivalTime(e.target.value)}
                  maxLength={60}
                  placeholder="e.g. 7pm, coming from RIA airport"
                  className="input mt-1 w-full"
                />
              </label>
              <label className="text-sm font-medium text-slate-700 dark:text-slate-200 sm:col-span-2">
                Requests for the hotel (optional)
                <textarea
                  rows={2}
                  maxLength={1000}
                  value={requests}
                  onChange={(e) => setRequests(e.target.value)}
                  placeholder="Baby cot, ground floor, late check-in…"
                  className="input mt-1 w-full"
                />
              </label>
            </fieldset>

            <fieldset className="flex flex-col gap-2">
              <legend className="mb-2 text-sm font-bold text-slate-900 dark:text-slate-50">How you&apos;ll pay</legend>
              {stay.paymentOptions.map((o) => (
                <ChoiceCard
                  key={o.method}
                  name="stay-payment"
                  checked={method === o.method}
                  onSelect={() => setMethod(o.method)}
                  icon={METHOD_ICON[o.method]}
                  title={o.label}
                  detail={o.method === 'pay_at_property' ? 'Cash or mobile money when you arrive' : 'Pay now, the hotel checks it and confirms'}
                />
              ))}
            </fieldset>

            {mobile && option?.account && (
              <div className="flex flex-col gap-3 rounded-3xl bg-slate-50 p-4 dark:bg-slate-800/60">
                <p className="text-sm text-slate-700 dark:text-slate-200">
                  1. Send <strong>{formatMoney(total, currency)}</strong> by {option.label} to
                  {stay.mobileMoneyAccountName ? ` ${stay.mobileMoneyAccountName}` : ''}
                </p>
                <div className="flex items-center justify-between gap-3 rounded-2xl bg-white px-4 py-3 dark:bg-slate-900">
                  <span className="flex items-center gap-2 font-mono text-lg font-bold tabular-nums">
                    <DevicePhoneMobileIcon aria-hidden className="h-5 w-5 text-slate-400" />
                    {option.account}
                  </span>
                  <CopyButton value={option.account.replace(/\s/g, '')} label="number" />
                </div>
                <label className="flex flex-col gap-1 text-sm text-slate-700 dark:text-slate-200">
                  2. Enter the transaction ID from your confirmation SMS
                  <input
                    value={reference}
                    onChange={(e) => setReference(e.target.value)}
                    maxLength={80}
                    placeholder="e.g. MP240115.1234.A56789"
                    className="w-full rounded-2xl border border-slate-300 bg-white p-3 font-mono text-sm outline-none focus:border-brand-600 dark:border-slate-700 dark:bg-slate-900"
                  />
                </label>
              </div>
            )}
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {stay.instantConfirm && !mobile
                ? 'Your room is confirmed straight away.'
                : mobile
                  ? 'The hotel confirms your room as soon as they see the payment.'
                  : 'The hotel confirms your room, usually within the hour. Your room is held while they do.'}
            </p>
          </div>
        )}
      </MenuSheet>
    </div>
  );
}
