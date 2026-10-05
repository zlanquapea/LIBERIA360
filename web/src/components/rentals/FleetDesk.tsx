'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { ChevronLeftIcon, ChevronRightIcon, LockClosedIcon, XMarkIcon } from '@heroicons/react/24/outline';
import { SafeImage } from '@/components/SafeImage';
import { createCarListingBlockedDate, deleteCarListingBlockedDate } from '@/lib/car-rentals-api';
import { resolveThumbUrl } from '@/lib/images';
import {
  getFleetCalendar,
  getFleetDesk,
  getRentalSettings,
  saveRentalSettings,
  type FleetCalendar as Calendar,
  type FleetCarState,
  type FleetDayState,
  type FleetDesk as Desk,
  type Rental,
  type RentalSettings,
} from '@/lib/rentals-api';
import { addDays, stayDate, todayInLiberia } from '@/lib/stays';
import { RentalCard } from './RentalParts';

const errorText = (e: unknown, fallback: string) => (e instanceof Error ? e.message : fallback);
const rentalHref = (id: string) => `/account/my-car-listings/rentals/${id}`;

const CAR_STATE: Record<FleetCarState, { label: string; style: string }> = {
  free: { label: 'Available', style: 'bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200' },
  going_out: { label: 'Going out today', style: 'bg-sky-50 text-sky-800 dark:bg-sky-950/40 dark:text-sky-200' },
  out: { label: 'On the road', style: 'bg-amber-50 text-amber-900 dark:bg-amber-950/40 dark:text-amber-100' },
  overdue: { label: 'Late back', style: 'bg-red-100 text-red-800 dark:bg-red-950/50 dark:text-red-200' },
  blocked: { label: 'Off the road', style: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300' },
};

const DAY_STATE: Record<FleetDayState, string> = {
  free: 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-950/30 dark:text-emerald-300',
  requested: 'bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-200',
  booked: 'bg-sky-100 text-sky-800 dark:bg-sky-950/50 dark:text-sky-200',
  out: 'bg-brand-600 text-white',
  blocked: 'bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-300',
};

const DAY_LABEL: Record<FleetDayState, string> = {
  free: 'Free',
  requested: 'Request',
  booked: 'Booked',
  out: 'Out',
  blocked: 'Blocked',
};

function Column({
  title,
  hint,
  list,
  tone,
}: {
  title: string;
  hint: string;
  list: Rental[];
  tone: 'amber' | 'sky' | 'emerald' | 'orange' | 'slate';
}) {
  const dot = { amber: 'bg-amber-500', sky: 'bg-sky-500', emerald: 'bg-emerald-500', orange: 'bg-orange-500', slate: 'bg-slate-400' }[tone];
  return (
    <section className="flex flex-col gap-2">
      <h3 className="flex items-center gap-2 text-base font-bold text-slate-950 dark:text-slate-50">
        <span aria-hidden className={`h-2.5 w-2.5 rounded-full ${dot}`} />
        {title} <span className="text-sm font-normal text-slate-500">({list.length})</span>
      </h3>
      {list.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-slate-200 p-4 text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">{hint}</p>
      ) : (
        list.map((r) => <RentalCard key={r.id} r={r} owner href={rentalHref(r.id)} />)
      )}
    </section>
  );
}

/** Today across the fleet: where each car is and what needs doing. */
export function FleetDesk() {
  const [desk, setDesk] = useState<Desk | null>(null);
  const [error, setError] = useState('');

  const load = useCallback(() => {
    getFleetDesk()
      .then(setDesk)
      .catch((e) => setError(errorText(e, 'Could not load your rentals.')));
  }, []);
  useEffect(() => {
    load();
    const t = setInterval(load, 30000);
    return () => clearInterval(t);
  }, [load]);

  if (!desk)
    return error ? (
      <p role="alert" className="error-state">
        {error}
      </p>
    ) : (
      <p className="text-sm text-slate-500">Loading your rentals…</p>
    );

  const late = desk.onTrip.filter((r) => r.overdue).length;
  const dueIds = new Set(desk.dueBack.map((r) => r.id));
  return (
    <div className="flex flex-col gap-5">
      <section className="grid grid-cols-3 gap-3">
        {[
          ['New requests', desk.requests.length],
          ['Going out', desk.pickups.length],
          ['Due back', desk.dueBack.length],
        ].map(([label, value]) => (
          <div key={label as string} className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
            <p className="text-2xl font-black text-slate-950 dark:text-slate-50">{value}</p>
            <p className="text-xs text-slate-500 dark:text-slate-400">{label}</p>
          </div>
        ))}
      </section>

      {late > 0 && (
        <p role="alert" className="rounded-2xl bg-red-50 p-3 text-sm font-semibold text-red-800 dark:bg-red-950/40 dark:text-red-200">
          {late} {late === 1 ? 'car is' : 'cars are'} late back. Call the renter.
        </p>
      )}

      {desk.fleet.length > 0 && (
        <section className="flex flex-col gap-2 rounded-3xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
          <h2 className="font-display text-lg font-bold text-slate-950 dark:text-slate-50">Your cars today</h2>
          <ul className="grid gap-2 sm:grid-cols-2">
            {desk.fleet.map((car) => {
              const state = CAR_STATE[car.state];
              const body = (
                <>
                  <SafeImage
                    src={car.image ? resolveThumbUrl(car.image) : null}
                    alt=""
                    className="h-12 w-14 shrink-0 rounded-xl object-cover"
                    fallback={
                      <div aria-hidden className="flex h-12 w-14 shrink-0 items-center justify-center rounded-xl bg-white/60 text-xl dark:bg-slate-900/40">
                        🚙
                      </div>
                    }
                  />
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-semibold">{car.title}</span>
                    <span className="block text-xs font-bold">{car.active ? state.label : 'Not bookable'}</span>
                  </span>
                </>
              );
              return (
                <li key={car.id}>
                  {car.rentalId ? (
                    <Link href={rentalHref(car.rentalId)} className={`flex items-center gap-3 rounded-2xl p-2 ${state.style}`}>
                      {body}
                    </Link>
                  ) : (
                    <div className={`flex items-center gap-3 rounded-2xl p-2 ${state.style}`}>{body}</div>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <Column title="New requests" hint="No requests waiting." list={desk.requests} tone="amber" />
        <Column title="Going out" hint="No pickups due." list={desk.pickups} tone="sky" />
        <Column title="Due back today" hint="Nothing due back today." list={desk.dueBack} tone="orange" />
        <Column
          title="On the road"
          hint="No other cars out."
          list={desk.onTrip.filter((r) => !dueIds.has(r.id))}
          tone="emerald"
        />
        <Column title="Coming up" hint="No confirmed rentals ahead." list={desk.upcoming} tone="slate" />
        {desk.refundsDue.length > 0 && <Column title="Refunds to send" hint="" list={desk.refundsDue} tone="orange" />}
      </div>
    </div>
  );
}

/** Each car, day by day. Tap a free day to take the car off the road. */
export function FleetCalendar({ token }: { token: string }) {
  const [from, setFrom] = useState(todayInLiberia());
  const [cal, setCal] = useState<Calendar | null>(null);
  const [error, setError] = useState('');
  const [blocking, setBlocking] = useState<{ carId: string; title: string; date: string } | null>(null);
  const [endDate, setEndDate] = useState('');
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    getFleetCalendar(from, 14)
      .then(setCal)
      .catch((e) => setError(errorText(e, 'Could not load the calendar.')));
  }, [from]);
  useEffect(load, [load]);

  async function block(e: React.FormEvent) {
    e.preventDefault();
    if (!blocking) return;
    setBusy(true);
    setError('');
    try {
      await createCarListingBlockedDate(token, blocking.carId, {
        startDate: blocking.date,
        endDate: endDate || blocking.date,
        reason: reason.trim() || undefined,
      });
      setBlocking(null);
      load();
    } catch (err) {
      setError(errorText(err, 'Could not block those days.'));
    } finally {
      setBusy(false);
    }
  }

  async function unblock(carId: string, blockId: string) {
    setError('');
    try {
      await deleteCarListingBlockedDate(token, carId, blockId);
      load();
    } catch (err) {
      setError(errorText(err, 'Could not reopen those days.'));
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-slate-600 dark:text-slate-300">Tap a free day to take a car off the road, or a booking to open it.</p>
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
      ) : cal.cars.length === 0 ? (
        <p className="empty-state">Add a car first.</p>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-800">
          <table className="w-full border-collapse text-center text-xs">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-800/60">
                <th scope="col" className="sticky left-0 z-10 min-w-36 bg-slate-50 p-2 text-left text-sm font-semibold dark:bg-slate-800">
                  Car
                </th>
                {cal.dates.map((d) => (
                  <th key={d} scope="col" className={`min-w-14 p-2 font-semibold ${d === todayInLiberia() ? 'text-brand-700 dark:text-brand-300' : 'text-slate-500'}`}>
                    {stayDate(d).split(' ')[0]}
                    <span className="block text-sm text-slate-900 dark:text-slate-100">{Number(d.slice(8))}</span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {cal.cars.map((car) => (
                <tr key={car.id} className="border-t border-slate-100 dark:border-slate-800">
                  <th scope="row" className="sticky left-0 z-10 max-w-40 truncate bg-white p-2 text-left text-sm font-semibold dark:bg-slate-900">
                    {car.title}
                  </th>
                  {car.days.map((d) => {
                    const label = `${car.title}, ${stayDate(d.date)}: ${DAY_LABEL[d.state]}${d.label && d.state !== 'free' ? ` (${d.label})` : ''}`;
                    const cls = `flex h-12 w-full flex-col items-center justify-center rounded-xl px-1 font-semibold ${DAY_STATE[d.state]}`;
                    return (
                      <td key={d.date} className="p-1">
                        {d.rentalId ? (
                          <Link href={rentalHref(d.rentalId)} aria-label={label} className={cls}>
                            <span className="max-w-14 truncate">{d.label?.split(' ')[0]}</span>
                          </Link>
                        ) : d.state === 'blocked' && d.blockId ? (
                          <button type="button" aria-label={`${label}. Reopen`} onClick={() => void unblock(car.id, d.blockId!)} className={cls}>
                            <LockClosedIcon aria-hidden className="h-4 w-4" />
                          </button>
                        ) : d.state === 'free' ? (
                          <button
                            type="button"
                            aria-label={`${label}. Block`}
                            onClick={() => {
                              setBlocking({ carId: car.id, title: car.title, date: d.date });
                              setEndDate(d.date);
                              setReason('');
                            }}
                            className={cls}
                          >
                            ·
                          </button>
                        ) : (
                          <span aria-label={label} className={cls}>
                            {DAY_LABEL[d.state]}
                          </span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="flex flex-wrap gap-3 text-xs text-slate-500">
        {(Object.keys(DAY_LABEL) as FleetDayState[]).map((s) => (
          <span key={s} className="flex items-center gap-1">
            <span className={`h-3 w-3 rounded ${DAY_STATE[s].split(' ')[0]}`} /> {DAY_LABEL[s]}
          </span>
        ))}
      </p>

      {blocking && (
        <form onSubmit={block} className="grid gap-3 rounded-3xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900 sm:grid-cols-3">
          <div className="flex items-start justify-between gap-2 sm:col-span-3">
            <h3 className="font-bold text-slate-950 dark:text-slate-50">
              Take {blocking.title} off the road from {stayDate(blocking.date)}
            </h3>
            <button type="button" aria-label="Close" onClick={() => setBlocking(null)} className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-slate-100 dark:hover:bg-slate-800">
              <XMarkIcon aria-hidden className="h-5 w-5" />
            </button>
          </div>
          <label className="text-sm font-medium text-slate-700 dark:text-slate-200">
            Until
            <input type="date" min={blocking.date} value={endDate} onChange={(e) => setEndDate(e.target.value)} className="input mt-1 w-full" />
          </label>
          <label className="text-sm font-medium text-slate-700 dark:text-slate-200 sm:col-span-2">
            Why (only you see this)
            <input value={reason} onChange={(e) => setReason(e.target.value)} maxLength={200} placeholder="Service, rented elsewhere, personal trip…" className="input mt-1 w-full" />
          </label>
          <button disabled={busy} className="btn-primary min-h-11 sm:col-span-3 sm:justify-self-start">
            {busy ? 'Saving…' : 'Block these days'}
          </button>
        </form>
      )}
    </div>
  );
}

/** Cash at pickup, MTN MoMo and Orange Money: how renters pay this owner. */
export function RentalPaymentSettings() {
  const [s, setS] = useState<RentalSettings | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    getRentalSettings()
      .then(setS)
      .catch((e) => setError(errorText(e, 'Could not load your payment settings.')));
  }, []);

  if (!s)
    return error ? (
      <p role="alert" className="error-state">
        {error}
      </p>
    ) : (
      <p className="text-sm text-slate-500">Loading…</p>
    );

  const set = (patch: Partial<RentalSettings>) => {
    setSaved(false);
    setS((x) => (x ? { ...x, ...patch } : x));
  };

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!s) return;
    setBusy(true);
    setError('');
    try {
      setS(
        await saveRentalSettings({
          cashAtPickupEnabled: s.cashAtPickupEnabled,
          mtnMomoNumber: s.mtnMomoNumber ?? '',
          orangeMoneyNumber: s.orangeMoneyNumber ?? '',
          mobileMoneyAccountName: s.mobileMoneyAccountName ?? '',
        }),
      );
      setSaved(true);
    } catch (err) {
      setError(errorText(err, 'Could not save.'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div>
        <h2 className="font-display text-lg font-bold text-slate-950 dark:text-slate-50">How renters pay you</h2>
        <p className="text-sm text-slate-500 dark:text-slate-400">For every car you list. Renters choose one when they book.</p>
      </div>
      <label className="flex items-start gap-3 rounded-2xl bg-slate-50 p-4 text-sm dark:bg-slate-800/60">
        <input type="checkbox" checked={s.cashAtPickupEnabled} onChange={(e) => set({ cashAtPickupEnabled: e.target.checked })} className="mt-0.5 h-5 w-5 accent-brand-600" />
        <span>
          <span className="block font-semibold text-slate-900 dark:text-slate-50">Cash at pickup</span>
          <span className="text-slate-600 dark:text-slate-300">The renter pays you when they collect the car.</span>
        </span>
      </label>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-sm font-medium text-slate-700 dark:text-slate-200">
          MTN MoMo number
          <input type="tel" inputMode="tel" value={s.mtnMomoNumber ?? ''} onChange={(e) => set({ mtnMomoNumber: e.target.value })} placeholder="0886 000 000" className="input mt-1 w-full" />
        </label>
        <label className="text-sm font-medium text-slate-700 dark:text-slate-200">
          Orange Money number
          <input type="tel" inputMode="tel" value={s.orangeMoneyNumber ?? ''} onChange={(e) => set({ orangeMoneyNumber: e.target.value })} placeholder="0777 000 000" className="input mt-1 w-full" />
        </label>
        <label className="text-sm font-medium text-slate-700 dark:text-slate-200 sm:col-span-2">
          Name on the mobile money account
          <input value={s.mobileMoneyAccountName ?? ''} onChange={(e) => set({ mobileMoneyAccountName: e.target.value })} maxLength={120} className="input mt-1 w-full" />
          <span className="mt-1 block text-xs font-normal text-slate-500">
            Renters see it before sending money. Leave a number empty to stop taking that method.
          </span>
        </label>
      </div>
      {error && (
        <p role="alert" className="error-state">
          {error}
        </p>
      )}
      {saved && (
        <p role="status" className="text-sm font-semibold text-emerald-700 dark:text-emerald-300">
          Saved.
        </p>
      )}
      <button disabled={busy} className="btn-primary min-h-11 self-start">
        {busy ? 'Saving…' : 'Save payment settings'}
      </button>
    </form>
  );
}
