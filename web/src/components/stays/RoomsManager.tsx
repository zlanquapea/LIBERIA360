'use client';

import { useEffect, useState } from 'react';
import { EyeSlashIcon, PencilSquareIcon, PlusIcon, TrashIcon } from '@heroicons/react/24/outline';
import { PhotoManager } from '@/components/PhotoManager';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { SafeImage } from '@/components/SafeImage';
import { formatMoney } from '@/lib/currency';
import { resolveThumbUrl } from '@/lib/images';
import {
  createRoomType,
  deleteRoomType,
  getStayManagement,
  saveStaySettings,
  updateRoomType,
  type RoomType,
  type RoomTypeInput,
  type StaySettings,
} from '@/lib/stays-api';

const AMENITY_IDEAS = [
  'Air conditioning',
  'Wi-Fi',
  'Hot shower',
  'Generator backup',
  'Breakfast',
  'Smart TV',
  'Ocean view',
  'Balcony',
  'Mini fridge',
  'Room service',
  'Airport pickup',
  'Parking',
];

const errorText = (e: unknown, fallback: string) => (e instanceof Error ? e.message : fallback);

type Draft = {
  name: string;
  description: string;
  images: string[];
  maxGuests: string;
  bedSummary: string;
  pricePerNight: string;
  totalRooms: string;
  amenities: string[];
  isActive: boolean;
};

const blank: Draft = {
  name: '',
  description: '',
  images: [],
  maxGuests: '2',
  bedSummary: '',
  pricePerNight: '',
  totalRooms: '1',
  amenities: [],
  isActive: true,
};

function toDraft(r: RoomType): Draft {
  return {
    name: r.name,
    description: r.description ?? '',
    images: r.images,
    maxGuests: String(r.maxGuests),
    bedSummary: r.bedSummary ?? '',
    pricePerNight: String(r.pricePerNight),
    totalRooms: String(r.totalRooms),
    amenities: r.amenities,
    isActive: r.isActive,
  };
}

function RoomEditor({
  token,
  initial,
  currency,
  onSave,
  onCancel,
}: {
  token: string;
  initial: Draft;
  currency: StaySettings['currency'];
  onSave: (input: RoomTypeInput) => Promise<void>;
  onCancel: () => void;
}) {
  const [d, setD] = useState(initial);
  const [custom, setCustom] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const set = (patch: Partial<Draft>) => setD((x) => ({ ...x, ...patch }));
  const toggle = (a: string) =>
    set({ amenities: d.amenities.includes(a) ? d.amenities.filter((x) => x !== a) : [...d.amenities, a] });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    const price = Number(d.pricePerNight);
    if (d.name.trim().length < 2) return setError('Give the room a name, like "Deluxe double".');
    if (!(price >= 0) || d.pricePerNight === '') return setError('Add the price per night.');
    setBusy(true);
    try {
      await onSave({
        name: d.name.trim(),
        description: d.description.trim() || null,
        images: d.images,
        maxGuests: Number(d.maxGuests) || 1,
        bedSummary: d.bedSummary.trim() || null,
        pricePerNight: price,
        totalRooms: Number(d.totalRooms) || 1,
        amenities: d.amenities,
        isActive: d.isActive,
      });
    } catch (err) {
      setError(errorText(err, 'Could not save the room.'));
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4 rounded-3xl border border-brand-200 bg-brand-50/40 p-5 dark:border-brand-900 dark:bg-brand-950/20">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-sm font-medium text-slate-700 dark:text-slate-200 sm:col-span-2">
          Room name
          <input value={d.name} onChange={(e) => set({ name: e.target.value })} maxLength={80} placeholder="e.g. Deluxe double, sea view" className="input mt-1 w-full" />
        </label>
        <label className="text-sm font-medium text-slate-700 dark:text-slate-200">
          Price per night ({currency})
          <input type="number" min={0} step="0.01" inputMode="decimal" value={d.pricePerNight} onChange={(e) => set({ pricePerNight: e.target.value })} className="input mt-1 w-full" />
        </label>
        <label className="text-sm font-medium text-slate-700 dark:text-slate-200">
          How many of these rooms you have
          <input type="number" min={1} max={500} inputMode="numeric" value={d.totalRooms} onChange={(e) => set({ totalRooms: e.target.value })} className="input mt-1 w-full" />
        </label>
        <label className="text-sm font-medium text-slate-700 dark:text-slate-200">
          Beds
          <input value={d.bedSummary} onChange={(e) => set({ bedSummary: e.target.value })} maxLength={80} placeholder="1 king bed" className="input mt-1 w-full" />
        </label>
        <label className="text-sm font-medium text-slate-700 dark:text-slate-200">
          Sleeps up to
          <input type="number" min={1} max={20} inputMode="numeric" value={d.maxGuests} onChange={(e) => set({ maxGuests: e.target.value })} className="input mt-1 w-full" />
        </label>
        <label className="text-sm font-medium text-slate-700 dark:text-slate-200 sm:col-span-2">
          Description (optional)
          <textarea rows={2} maxLength={2000} value={d.description} onChange={(e) => set({ description: e.target.value })} placeholder="What makes this room nice" className="input mt-1 w-full" />
        </label>
      </div>
      <fieldset>
        <legend className="mb-2 text-sm font-semibold text-slate-700 dark:text-slate-200">What the room has</legend>
        <div className="flex flex-wrap gap-2">
          {[...new Set([...AMENITY_IDEAS, ...d.amenities])].map((a) => (
            <button
              key={a}
              type="button"
              aria-pressed={d.amenities.includes(a)}
              onClick={() => toggle(a)}
              className={`min-h-9 rounded-full border px-3 text-sm ${
                d.amenities.includes(a)
                  ? 'border-brand-600 bg-brand-600 text-white'
                  : 'border-slate-300 text-slate-700 hover:border-brand-400 dark:border-slate-600 dark:text-slate-200'
              }`}
            >
              {a}
            </button>
          ))}
        </div>
        <div className="mt-2 flex gap-2">
          <input
            value={custom}
            onChange={(e) => setCustom(e.target.value)}
            maxLength={40}
            placeholder="Add another"
            className="input min-w-0 flex-1"
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                if (custom.trim()) toggle(custom.trim());
                setCustom('');
              }
            }}
          />
          <button
            type="button"
            onClick={() => {
              if (custom.trim()) toggle(custom.trim());
              setCustom('');
            }}
            className="btn-secondary min-h-11"
          >
            Add
          </button>
        </div>
      </fieldset>
      <PhotoManager token={token} images={d.images} onChange={(images) => set({ images })} label="Room photos" maxPhotos={10} />
      <label className="flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-200">
        <input type="checkbox" checked={d.isActive} onChange={(e) => set({ isActive: e.target.checked })} className="h-5 w-5 accent-brand-600" />
        Guests can book this room
      </label>
      {error && (
        <p role="alert" className="error-state">
          {error}
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        <button disabled={busy} className="btn-primary min-h-11">
          {busy ? 'Saving…' : 'Save room'}
        </button>
        <button type="button" onClick={onCancel} className="btn-secondary min-h-11">
          Cancel
        </button>
      </div>
    </form>
  );
}

function SettingsForm({ businessId, settings, onSaved }: { businessId: string; settings: StaySettings; onSaved: (s: StaySettings) => void }) {
  const [s, setS] = useState(settings);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);
  const set = (patch: Partial<StaySettings>) => {
    setSaved(false);
    setS((x) => ({ ...x, ...patch }));
  };

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const next = await saveStaySettings(businessId, {
        currency: s.currency,
        checkInTime: s.checkInTime,
        checkOutTime: s.checkOutTime,
        instantConfirm: s.instantConfirm,
        payAtPropertyEnabled: s.payAtPropertyEnabled,
        mtnMomoNumber: s.mtnMomoNumber ?? '',
        orangeMoneyNumber: s.orangeMoneyNumber ?? '',
        mobileMoneyAccountName: s.mobileMoneyAccountName ?? '',
        cancellationPolicy: s.cancellationPolicy ?? '',
        houseRules: s.houseRules ?? '',
      });
      setS(next);
      onSaved(next);
      setSaved(true);
    } catch (err) {
      setError(errorText(err, 'Could not save.'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-5 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div>
        <h2 className="font-display text-lg font-bold text-slate-950 dark:text-slate-50">How you take bookings</h2>
        <p className="text-sm text-slate-500 dark:text-slate-400">Shown to guests before they book.</p>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <label className="text-sm font-medium text-slate-700 dark:text-slate-200">
          Prices in
          <select value={s.currency} onChange={(e) => set({ currency: e.target.value as StaySettings['currency'] })} className="input mt-1 w-full">
            <option value="USD">US dollars (US$)</option>
            <option value="LRD">Liberian dollars (L$)</option>
          </select>
        </label>
        <label className="text-sm font-medium text-slate-700 dark:text-slate-200">
          Check-in from
          <input type="time" value={s.checkInTime} onChange={(e) => set({ checkInTime: e.target.value })} className="input mt-1 w-full" />
        </label>
        <label className="text-sm font-medium text-slate-700 dark:text-slate-200">
          Check-out by
          <input type="time" value={s.checkOutTime} onChange={(e) => set({ checkOutTime: e.target.value })} className="input mt-1 w-full" />
        </label>
      </div>
      <label className="flex items-start gap-3 rounded-2xl bg-slate-50 p-4 text-sm dark:bg-slate-800/60">
        <input type="checkbox" checked={s.instantConfirm} onChange={(e) => set({ instantConfirm: e.target.checked })} className="mt-0.5 h-5 w-5 accent-brand-600" />
        <span>
          <span className="block font-semibold text-slate-900 dark:text-slate-50">Confirm bookings automatically</span>
          <span className="text-slate-600 dark:text-slate-300">
            When a room is free, guests paying at the front desk are confirmed straight away. Mobile money bookings still
            wait for you to check the payment.
          </span>
        </span>
      </label>
      <fieldset className="grid gap-3 sm:grid-cols-2">
        <legend className="mb-2 text-sm font-bold text-slate-900 dark:text-slate-50">Payments</legend>
        <label className="flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-200 sm:col-span-2">
          <input type="checkbox" checked={s.payAtPropertyEnabled} onChange={(e) => set({ payAtPropertyEnabled: e.target.checked })} className="h-5 w-5 accent-brand-600" />
          Guests can pay at the front desk
        </label>
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
          <span className="mt-1 block text-xs font-normal text-slate-500">So guests know they&apos;re paying the right account.</span>
        </label>
      </fieldset>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-sm font-medium text-slate-700 dark:text-slate-200">
          Cancellation policy
          <textarea rows={3} maxLength={2000} value={s.cancellationPolicy ?? ''} onChange={(e) => set({ cancellationPolicy: e.target.value })} placeholder="e.g. Free cancellation up to 24 hours before arrival." className="input mt-1 w-full" />
        </label>
        <label className="text-sm font-medium text-slate-700 dark:text-slate-200">
          House rules
          <textarea rows={3} maxLength={2000} value={s.houseRules ?? ''} onChange={(e) => set({ houseRules: e.target.value })} placeholder="e.g. No smoking in rooms. Quiet after 10pm." className="input mt-1 w-full" />
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
        {busy ? 'Saving…' : 'Save settings'}
      </button>
    </form>
  );
}

/** Room types, prices and how many of each, plus how bookings work. */
export function RoomsManager({ token, businessId }: { token: string; businessId: string }) {
  const [data, setData] = useState<{ settings: StaySettings; roomTypes: RoomType[] } | null>(null);
  const [error, setError] = useState('');
  const [editing, setEditing] = useState<string | 'new' | null>(null);
  const [removing, setRemoving] = useState<RoomType | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    getStayManagement(businessId)
      .then(setData)
      .catch((e) => setError(errorText(e, 'Could not load your rooms.')));
  }, [businessId]);

  if (!data)
    return error ? (
      <p role="alert" className="error-state">
        {error}
      </p>
    ) : (
      <p className="text-sm text-slate-500">Loading rooms…</p>
    );

  const { settings, roomTypes } = data;
  const totalRooms = roomTypes.filter((r) => r.isActive).reduce((n, r) => n + r.totalRooms, 0);

  async function save(id: string | 'new', input: RoomTypeInput) {
    const saved = id === 'new' ? await createRoomType(businessId, input) : await updateRoomType(businessId, id, input);
    setData((d) =>
      d
        ? {
            ...d,
            roomTypes: id === 'new' ? [...d.roomTypes, saved] : d.roomTypes.map((r) => (r.id === id ? saved : r)),
          }
        : d,
    );
    setEditing(null);
  }

  async function remove() {
    if (!removing) return;
    setBusy(true);
    try {
      const res = await deleteRoomType(businessId, removing.id);
      setData((d) =>
        d
          ? {
              ...d,
              roomTypes: res.deleted
                ? d.roomTypes.filter((r) => r.id !== removing.id)
                : d.roomTypes.map((r) => (r.id === removing.id ? { ...r, isActive: false } : r)),
            }
          : d,
      );
      setRemoving(null);
    } catch (e) {
      setError(errorText(e, 'Could not remove the room.'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <section className="flex flex-col gap-4 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="font-display text-lg font-bold text-slate-950 dark:text-slate-50">Rooms &amp; rates</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              {roomTypes.length
                ? `${totalRooms} ${totalRooms === 1 ? 'room' : 'rooms'} across ${roomTypes.filter((r) => r.isActive).length} types that guests can book.`
                : 'Add each kind of room you have. Guests see live availability and book straight from your page.'}
            </p>
          </div>
          {editing === null && (
            <button type="button" onClick={() => setEditing('new')} className="btn-primary min-h-11 gap-1.5">
              <PlusIcon aria-hidden className="h-4 w-4" /> Add a room type
            </button>
          )}
        </div>
        {error && (
          <p role="alert" className="error-state">
            {error}
          </p>
        )}
        {editing === 'new' && (
          <RoomEditor token={token} initial={blank} currency={settings.currency} onSave={(i) => save('new', i)} onCancel={() => setEditing(null)} />
        )}
        <ul className="flex flex-col gap-3">
          {roomTypes.map((room) =>
            editing === room.id ? (
              <li key={room.id}>
                <RoomEditor token={token} initial={toDraft(room)} currency={settings.currency} onSave={(i) => save(room.id, i)} onCancel={() => setEditing(null)} />
              </li>
            ) : (
              <li key={room.id} className={`flex gap-3 rounded-2xl border border-slate-200 p-3 dark:border-slate-700 ${room.isActive ? '' : 'opacity-60'}`}>
                <SafeImage
                  src={room.images[0] ? resolveThumbUrl(room.images[0]) : null}
                  alt=""
                  className="h-20 w-20 shrink-0 rounded-xl object-cover"
                  fallback={
                    <div aria-hidden className="flex h-20 w-20 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-3xl dark:bg-slate-800">
                      🛏️
                    </div>
                  }
                />
                <div className="flex min-w-0 flex-1 flex-col gap-1">
                  <p className="flex flex-wrap items-center gap-2 font-semibold text-slate-950 dark:text-slate-50">
                    {room.name}
                    {!room.isActive && (
                      <span className="flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                        <EyeSlashIcon aria-hidden className="h-3.5 w-3.5" /> Hidden
                      </span>
                    )}
                  </p>
                  <p className="text-sm text-slate-600 dark:text-slate-300">
                    {formatMoney(room.pricePerNight, settings.currency)} / night · {room.totalRooms}{' '}
                    {room.totalRooms === 1 ? 'room' : 'rooms'} · sleeps {room.maxGuests}
                  </p>
                  {room.amenities.length > 0 && (
                    <p className="truncate text-xs text-slate-500 dark:text-slate-400">{room.amenities.join(' · ')}</p>
                  )}
                </div>
                <div className="flex shrink-0 flex-col gap-1">
                  <button type="button" onClick={() => setEditing(room.id)} aria-label={`Edit ${room.name}`} className="flex h-10 w-10 items-center justify-center rounded-full hover:bg-slate-100 dark:hover:bg-slate-800">
                    <PencilSquareIcon aria-hidden className="h-5 w-5" />
                  </button>
                  <button type="button" onClick={() => setRemoving(room)} aria-label={`Remove ${room.name}`} className="flex h-10 w-10 items-center justify-center rounded-full text-red-700 hover:bg-red-50 dark:text-red-300 dark:hover:bg-red-950/40">
                    <TrashIcon aria-hidden className="h-5 w-5" />
                  </button>
                </div>
              </li>
            ),
          )}
        </ul>
      </section>

      <SettingsForm businessId={businessId} settings={settings} onSaved={(s) => setData((d) => (d ? { ...d, settings: s } : d))} />

      <ConfirmDialog
        open={Boolean(removing)}
        title={`Remove ${removing?.name ?? 'this room'}?`}
        description="Guests won't be able to book it. If it has bookings, it's hidden instead so their history stays."
        confirmLabel="Remove"
        cancelLabel="Keep it"
        loadingLabel="Removing…"
        isLoading={busy}
        onConfirm={() => void remove()}
        onCancel={() => setRemoving(null)}
      />
    </div>
  );
}
