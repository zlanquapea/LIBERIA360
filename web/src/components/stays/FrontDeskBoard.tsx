'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  LockClosedIcon,
  UserPlusIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline';
import {
  addRoomBlock,
  getFrontDesk,
  getPropertyReservations,
  getStayCalendar,
  recordWalkIn,
  removeRoomBlock,
  type FrontDesk,
  type Reservation,
  type StayCalendar,
} from '@/lib/stays-api';
import { addDays, occupancyTone, stayDate, todayInLiberia } from '@/lib/stays';
import { StayCard } from './StayParts';

type Tab = 'today' | 'calendar' | 'all';
const errorText = (e: unknown, fallback: string) => (e instanceof Error ? e.message : fallback);

function Column({
  title,
  hint,
  list,
  businessId,
  tone = 'slate',
}: {
  title: string;
  hint: string;
  list: Reservation[];
  businessId: string;
  tone?: 'amber' | 'sky' | 'emerald' | 'orange' | 'slate';
}) {
  const dot = {
    amber: 'bg-amber-500',
    sky: 'bg-sky-500',
    emerald: 'bg-emerald-500',
    orange: 'bg-orange-500',
    slate: 'bg-slate-400',
  }[tone];
  return (
    <section className="flex flex-col gap-2">
      <h3 className="flex items-center gap-2 text-base font-bold text-slate-950 dark:text-slate-50">
        <span aria-hidden className={`h-2.5 w-2.5 rounded-full ${dot}`} />
        {title} <span className="text-sm font-normal text-slate-500">({list.length})</span>
      </h3>
      {list.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-slate-200 p-4 text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">{hint}</p>
      ) : (
        list.map((r) => (
          <StayCard key={r.id} r={r} desk href={`/account/my-businesses/${businessId}/front-desk/${r.id}`} />
        ))
      )}
    </section>
  );
}

function WalkInForm({
  businessId,
  rooms,
  onDone,
  onCancel,
}: {
  businessId: string;
  rooms: FrontDesk['occupancy'];
  onDone: () => void;
  onCancel: () => void;
}) {
  const today = todayInLiberia();
  const [roomTypeId, setRoomTypeId] = useState(rooms.find((r) => r.left > 0)?.id ?? rooms[0]?.id ?? '');
  const [checkOut, setCheckOut] = useState(addDays(today, 1));
  const [count, setCount] = useState('1');
  const [adults, setAdults] = useState('1');
  const [guestName, setGuestName] = useState('');
  const [guestPhone, setGuestPhone] = useState('');
  const [roomNumbers, setRoomNumbers] = useState('');
  const [paid, setPaid] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await recordWalkIn(businessId, {
        roomTypeId,
        checkOut,
        rooms: Number(count) || 1,
        adults: Number(adults) || 1,
        guestName: guestName.trim(),
        guestPhone: guestPhone.trim() || undefined,
        roomNumbers: roomNumbers.trim() || undefined,
        paid,
      });
      onDone();
    } catch (err) {
      setError(errorText(err, 'Could not record the walk-in.'));
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="grid gap-3 rounded-3xl border border-brand-200 bg-brand-50/40 p-5 dark:border-brand-900 dark:bg-brand-950/20 sm:grid-cols-2">
      <h3 className="font-bold text-slate-950 dark:text-slate-50 sm:col-span-2">Walk-in guest, checking in now</h3>
      <label className="text-sm font-medium text-slate-700 dark:text-slate-200">
        Room type
        <select value={roomTypeId} onChange={(e) => setRoomTypeId(e.target.value)} className="input mt-1 w-full">
          {rooms.map((r) => (
            <option key={r.id} value={r.id} disabled={r.left === 0}>
              {r.name} ({r.left} free tonight)
            </option>
          ))}
        </select>
      </label>
      <label className="text-sm font-medium text-slate-700 dark:text-slate-200">
        Leaving on
        <input type="date" min={addDays(today, 1)} value={checkOut} onChange={(e) => setCheckOut(e.target.value)} className="input mt-1 w-full" />
      </label>
      <label className="text-sm font-medium text-slate-700 dark:text-slate-200">
        Guest name
        <input required minLength={2} value={guestName} onChange={(e) => setGuestName(e.target.value)} className="input mt-1 w-full" />
      </label>
      <label className="text-sm font-medium text-slate-700 dark:text-slate-200">
        Phone (optional)
        <input type="tel" value={guestPhone} onChange={(e) => setGuestPhone(e.target.value)} className="input mt-1 w-full" />
      </label>
      <div className="grid grid-cols-3 gap-3 sm:col-span-2">
        <label className="text-sm font-medium text-slate-700 dark:text-slate-200">
          Rooms
          <input type="number" min={1} max={20} value={count} onChange={(e) => setCount(e.target.value)} className="input mt-1 w-full" />
        </label>
        <label className="text-sm font-medium text-slate-700 dark:text-slate-200">
          Guests
          <input type="number" min={1} max={100} value={adults} onChange={(e) => setAdults(e.target.value)} className="input mt-1 w-full" />
        </label>
        <label className="text-sm font-medium text-slate-700 dark:text-slate-200">
          Room no.
          <input value={roomNumbers} onChange={(e) => setRoomNumbers(e.target.value)} maxLength={60} placeholder="12" className="input mt-1 w-full" />
        </label>
      </div>
      <label className="flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-200 sm:col-span-2">
        <input type="checkbox" checked={paid} onChange={(e) => setPaid(e.target.checked)} className="h-5 w-5 accent-brand-600" />
        Already paid
      </label>
      {error && (
        <p role="alert" className="error-state sm:col-span-2">
          {error}
        </p>
      )}
      <div className="flex flex-wrap gap-2 sm:col-span-2">
        <button disabled={busy || !roomTypeId} className="btn-primary min-h-11">
          {busy ? 'Checking in…' : 'Check in'}
        </button>
        <button type="button" onClick={onCancel} className="btn-secondary min-h-11">
          Cancel
        </button>
      </div>
    </form>
  );
}

function Calendar({ businessId }: { businessId: string }) {
  const [from, setFrom] = useState(todayInLiberia());
  const [cal, setCal] = useState<StayCalendar | null>(null);
  const [error, setError] = useState('');
  const [blocking, setBlocking] = useState<{ roomTypeId: string; name: string; date: string; max: number } | null>(null);
  const [endDate, setEndDate] = useState('');
  const [count, setCount] = useState('1');
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    getStayCalendar(businessId, from, 14)
      .then(setCal)
      .catch((e) => setError(errorText(e, 'Could not load the calendar.')));
  }, [businessId, from]);
  useEffect(load, [load]);

  async function block(e: React.FormEvent) {
    e.preventDefault();
    if (!blocking) return;
    setBusy(true);
    setError('');
    try {
      await addRoomBlock(businessId, {
        roomTypeId: blocking.roomTypeId,
        startDate: blocking.date,
        endDate: endDate || blocking.date,
        rooms: Number(count) || 1,
        reason: reason.trim() || undefined,
      });
      setBlocking(null);
      load();
    } catch (err) {
      setError(errorText(err, 'Could not block those rooms.'));
    } finally {
      setBusy(false);
    }
  }

  async function unblock(id: string) {
    setError('');
    try {
      await removeRoomBlock(businessId, id);
      load();
    } catch (err) {
      setError(errorText(err, 'Could not reopen those rooms.'));
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-slate-600 dark:text-slate-300">Rooms left to sell each night. Tap a night to block rooms for repairs or other reasons.</p>
        <div className="flex items-center gap-1">
          <button type="button" aria-label="Earlier" onClick={() => setFrom(addDays(from, -14))} disabled={from <= todayInLiberia()} className="flex h-10 w-10 items-center justify-center rounded-full border border-slate-300 disabled:opacity-30 dark:border-slate-600">
            <ChevronLeftIcon aria-hidden className="h-5 w-5" />
          </button>
          <button type="button" onClick={() => setFrom(todayInLiberia())} className="min-h-10 rounded-full border border-slate-300 px-3 text-sm font-semibold dark:border-slate-600">
            Today
          </button>
          <button type="button" aria-label="Later" onClick={() => setFrom(addDays(from, 14))} className="flex h-10 w-10 items-center justify-center rounded-full border border-slate-300 dark:border-slate-600">
            <ChevronRightIcon aria-hidden className="h-5 w-5" />
          </button>
        </div>
      </div>
      {error && (
        <p role="alert" className="error-state">
          {error}
        </p>
      )}
      {!cal ? (
        <p className="text-sm text-slate-500">Loading…</p>
      ) : cal.roomTypes.length === 0 ? (
        <p className="empty-state">Add your rooms first.</p>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-800">
          <table className="w-full border-collapse text-center text-sm">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-800/60">
                <th scope="col" className="sticky left-0 z-10 min-w-36 bg-slate-50 p-2 text-left font-semibold dark:bg-slate-800">
                  Room
                </th>
                {cal.nights.map((n) => (
                  <th key={n} scope="col" className={`min-w-14 p-2 text-xs font-semibold ${n === todayInLiberia() ? 'text-brand-700 dark:text-brand-300' : 'text-slate-500'}`}>
                    {stayDate(n).split(' ')[0]}
                    <span className="block text-sm text-slate-900 dark:text-slate-100">{Number(n.slice(8))}</span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {cal.roomTypes.map((rt) => (
                <tr key={rt.id} className="border-t border-slate-100 dark:border-slate-800">
                  <th scope="row" className="sticky left-0 z-10 bg-white p-2 text-left font-semibold dark:bg-slate-900">
                    {rt.name}
                    <span className="block text-xs font-normal text-slate-500">{rt.totalRooms} {rt.totalRooms === 1 ? 'room' : 'rooms'}</span>
                  </th>
                  {rt.nights.map((n) => (
                    <td key={n.date} className="p-1">
                      <button
                        type="button"
                        onClick={() => {
                          setBlocking({ roomTypeId: rt.id, name: rt.name, date: n.date, max: n.left });
                          setEndDate(n.date);
                          setCount('1');
                          setReason('');
                        }}
                        aria-label={`${rt.name}, ${stayDate(n.date)}: ${n.left} of ${rt.totalRooms} left${n.blocked ? `, ${n.blocked} blocked` : ''}`}
                        className={`flex h-12 w-full flex-col items-center justify-center rounded-xl font-bold ${occupancyTone(n.left, rt.totalRooms)}`}
                      >
                        {n.left}
                        {n.blocked > 0 && <LockClosedIcon aria-hidden className="h-3 w-3 opacity-70" />}
                      </button>
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="flex flex-wrap gap-3 text-xs text-slate-500">
        <span className="flex items-center gap-1"><span className="h-3 w-3 rounded bg-emerald-100" /> Plenty left</span>
        <span className="flex items-center gap-1"><span className="h-3 w-3 rounded bg-amber-100" /> Almost full</span>
        <span className="flex items-center gap-1"><span className="h-3 w-3 rounded bg-red-100" /> Full</span>
        <span className="flex items-center gap-1"><LockClosedIcon className="h-3 w-3" /> Has blocked rooms</span>
      </p>

      {blocking && (
        <form onSubmit={block} className="grid gap-3 rounded-3xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900 sm:grid-cols-4">
          <div className="flex items-start justify-between gap-2 sm:col-span-4">
            <h3 className="font-bold text-slate-950 dark:text-slate-50">
              Block {blocking.name} from {stayDate(blocking.date)}
            </h3>
            <button type="button" aria-label="Close" onClick={() => setBlocking(null)} className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-slate-100 dark:hover:bg-slate-800">
              <XMarkIcon aria-hidden className="h-5 w-5" />
            </button>
          </div>
          <label className="text-sm font-medium text-slate-700 dark:text-slate-200">
            Last night
            <input type="date" min={blocking.date} value={endDate} onChange={(e) => setEndDate(e.target.value)} className="input mt-1 w-full" />
          </label>
          <label className="text-sm font-medium text-slate-700 dark:text-slate-200">
            Rooms
            <input type="number" min={1} max={Math.max(1, blocking.max)} value={count} onChange={(e) => setCount(e.target.value)} className="input mt-1 w-full" />
          </label>
          <label className="text-sm font-medium text-slate-700 dark:text-slate-200 sm:col-span-2">
            Why (only you see this)
            <input value={reason} onChange={(e) => setReason(e.target.value)} maxLength={200} placeholder="AC repair, private event…" className="input mt-1 w-full" />
          </label>
          <button disabled={busy || blocking.max === 0} className="btn-primary min-h-11 sm:col-span-4 sm:justify-self-start">
            {busy ? 'Blocking…' : blocking.max === 0 ? 'No rooms free that night' : 'Block rooms'}
          </button>
        </form>
      )}

      {cal && cal.roomTypes.some((rt) => rt.blocks.length) && (
        <section className="flex flex-col gap-2">
          <h3 className="font-bold text-slate-950 dark:text-slate-50">Blocked rooms</h3>
          <ul className="flex flex-col gap-2">
            {cal.roomTypes.flatMap((rt) =>
              rt.blocks.map((b) => (
                <li key={b.id} className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200 p-3 text-sm dark:border-slate-700">
                  <span>
                    <span className="font-semibold">
                      {b.rooms} × {rt.name}
                    </span>{' '}
                    · {stayDate(b.startDate)}
                    {b.endDate !== b.startDate ? ` to ${stayDate(b.endDate)}` : ''}
                    {b.reason && <span className="block text-xs text-slate-500">{b.reason}</span>}
                  </span>
                  <button type="button" onClick={() => void unblock(b.id)} className="btn-secondary min-h-9 px-3 text-xs">
                    Reopen
                  </button>
                </li>
              )),
            )}
          </ul>
        </section>
      )}
    </div>
  );
}

/** What the front desk needs to see and do today, plus the calendar. */
export function FrontDeskBoard({ businessId, roomsHref }: { businessId: string; roomsHref: string }) {
  const [tab, setTab] = useState<Tab>('today');
  const [desk, setDesk] = useState<FrontDesk | null>(null);
  const [all, setAll] = useState<Reservation[] | null>(null);
  const [error, setError] = useState('');
  const [walkIn, setWalkIn] = useState(false);

  const load = useCallback(() => {
    getFrontDesk(businessId)
      .then(setDesk)
      .catch((e) => setError(errorText(e, 'Could not load the front desk.')));
  }, [businessId]);

  useEffect(() => {
    load();
    const t = setInterval(load, 30000);
    return () => clearInterval(t);
  }, [load]);

  useEffect(() => {
    if (tab !== 'all') return;
    getPropertyReservations(businessId)
      .then(setAll)
      .catch((e) => setError(errorText(e, 'Could not load bookings.')));
  }, [tab, businessId]);

  if (!desk)
    return error ? (
      <p role="alert" className="error-state">
        {error}
      </p>
    ) : (
      <p className="text-sm text-slate-500">Loading the front desk…</p>
    );

  if (desk.occupancy.length === 0)
    return (
      <div className="flex flex-col items-start gap-3 rounded-3xl border border-dashed border-slate-300 p-6 dark:border-slate-700">
        <h2 className="font-display text-lg font-bold text-slate-950 dark:text-slate-50">Set up your rooms first</h2>
        <p className="text-sm text-slate-600 dark:text-slate-300">
          Add each kind of room you have and how many. Guests can then book online and you&apos;ll run arrivals,
          check-ins and check-outs from here.
        </p>
        <Link href={roomsHref} className="btn-primary min-h-11">
          Add rooms
        </Link>
      </div>
    );

  const totalRooms = desk.occupancy.reduce((n, o) => n + o.totalRooms, 0);
  const occupied = desk.occupancy.reduce((n, o) => n + o.booked, 0);
  const free = desk.occupancy.reduce((n, o) => n + o.left, 0);

  return (
    <div className="flex flex-col gap-5">
      <section className="grid grid-cols-3 gap-3">
        {[
          ['New requests', desk.requests.length],
          ['Arriving', desk.arrivals.length],
          ['Leaving', desk.departures.length],
        ].map(([label, value]) => (
          <div key={label as string} className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
            <p className="text-2xl font-black text-slate-950 dark:text-slate-50">{value}</p>
            <p className="text-xs text-slate-500 dark:text-slate-400">{label}</p>
          </div>
        ))}
      </section>

      <section className="flex flex-col gap-3 rounded-3xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <h2 className="font-display text-lg font-bold text-slate-950 dark:text-slate-50">Tonight</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              {occupied} of {totalRooms} rooms taken · {free} left to sell
            </p>
          </div>
          {!walkIn && (
            <button type="button" onClick={() => setWalkIn(true)} className="btn-secondary min-h-11 gap-1.5">
              <UserPlusIcon aria-hidden className="h-5 w-5" /> Walk-in guest
            </button>
          )}
        </div>
        <div className="h-2.5 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
          <div className="h-full rounded-full bg-brand-600" style={{ width: `${totalRooms ? Math.round(((totalRooms - free) / totalRooms) * 100) : 0}%` }} />
        </div>
        <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {desk.occupancy.map((o) => (
            <li key={o.id} className={`rounded-2xl p-3 ${occupancyTone(o.left, o.totalRooms)}`}>
              <p className="truncate text-sm font-semibold">{o.name}</p>
              <p className="text-xl font-black">
                {o.left}
                <span className="text-sm font-semibold opacity-80"> / {o.totalRooms} left</span>
              </p>
              {o.blocked > 0 && <p className="text-xs opacity-80">{o.blocked} blocked</p>}
            </li>
          ))}
        </ul>
        {walkIn && (
          <WalkInForm
            businessId={businessId}
            rooms={desk.occupancy}
            onCancel={() => setWalkIn(false)}
            onDone={() => {
              setWalkIn(false);
              load();
            }}
          />
        )}
      </section>

      <div role="tablist" aria-label="Front desk" className="flex gap-1 self-start rounded-full bg-slate-100 p-1 dark:bg-slate-800">
        {(
          [
            ['today', 'Today'],
            ['calendar', 'Calendar'],
            ['all', 'All bookings'],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={tab === id}
            onClick={() => setTab(id)}
            className={`min-h-10 rounded-full px-4 text-sm font-semibold transition ${
              tab === id ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-900 dark:text-slate-50' : 'text-slate-500 dark:text-slate-400'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {error && (
        <p role="alert" className="error-state">
          {error}
        </p>
      )}

      {tab === 'today' && (
        <div className="grid gap-6 lg:grid-cols-2">
          <Column title="New requests" hint="No requests waiting." list={desk.requests} businessId={businessId} tone="amber" />
          <Column title="Arriving" hint="Nobody due to arrive." list={desk.arrivals} businessId={businessId} tone="sky" />
          <Column title="Leaving today" hint="Nobody checking out today." list={desk.departures} businessId={businessId} tone="orange" />
          <Column
            title="In house"
            hint="No other guests checked in."
            list={desk.inHouse.filter((r) => !desk.departures.some((d) => d.id === r.id))}
            businessId={businessId}
            tone="emerald"
          />
          <Column title="Coming up" hint="No confirmed bookings ahead." list={desk.upcoming} businessId={businessId} />
          {desk.refundsDue.length > 0 && (
            <Column title="Refunds to send" hint="" list={desk.refundsDue} businessId={businessId} tone="orange" />
          )}
        </div>
      )}
      {tab === 'calendar' && <Calendar businessId={businessId} />}
      {tab === 'all' &&
        (all === null ? (
          <p className="text-sm text-slate-500">Loading…</p>
        ) : all.length === 0 ? (
          <p className="empty-state">No bookings yet.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {all.map((r) => (
              <StayCard key={r.id} r={r} desk href={`/account/my-businesses/${businessId}/front-desk/${r.id}`} />
            ))}
          </div>
        ))}
    </div>
  );
}
