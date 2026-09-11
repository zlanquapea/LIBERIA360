'use client';

import { useEffect, useState } from 'react';
import { usePharmacyDashboard } from '@/components/PharmacyDashboardContext';
import {
  getMyPharmacyHours,
  savePharmacyHours,
  savePharmacyProfile,
  type Pharmacy,
  type PharmacyOpeningHoursEntry,
} from '@/lib/pharmacy-api';

const DAY_NAMES = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
];

function ProfileForm({ pharmacy, onSaved }: { pharmacy: Pharmacy; onSaved: (p: Pharmacy) => void }) {
  const [form, setForm] = useState({
    name: pharmacy.name,
    address: pharmacy.address,
    location: pharmacy.location,
    telephone: pharmacy.telephone,
    logoUrl: pharmacy.logoUrl ?? '',
    coverUrl: pharmacy.coverUrl ?? '',
    latitude: pharmacy.latitude != null ? String(pharmacy.latitude) : '',
    longitude: pharmacy.longitude != null ? String(pharmacy.longitude) : '',
    pickupEnabled: pharmacy.pickupEnabled,
    deliveryEnabled: pharmacy.deliveryEnabled,
    deliveryFee: String(pharmacy.deliveryFee),
    // Only present when getMyPharmacies() actually selected it — a
    // pharmacy created via the place-submission auto-claim never had a
    // licence-number field to fill in the first place (see
    // PharmaciesService.autoApproveForPlace's doc comment), so this stays
    // blank for those rather than ever being required.
    licenceNumber: pharmacy.licenceNumber ?? '',
  });
  const [saving, setSaving] = useState(false),
    [error, setError] = useState(''),
    [saved, setSaved] = useState(false);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError('');
    setSaved(false);
    try {
      const updated = await savePharmacyProfile(pharmacy.id, {
        name: form.name,
        address: form.address,
        location: form.location,
        telephone: form.telephone,
        // null (not undefined) for an emptied field: this form always
        // submits every field, pre-populated from the current pharmacy, so
        // there's no "the user didn't touch this" case to preserve here —
        // an empty box means "remove this", and the API only takes that as
        // a clear when it's explicitly null (omitting the key entirely
        // means "leave unchanged", which would just restore the old value).
        logoUrl: form.logoUrl || null,
        coverUrl: form.coverUrl || null,
        latitude: form.latitude === '' ? null : Number(form.latitude),
        longitude: form.longitude === '' ? null : Number(form.longitude),
        pickupEnabled: form.pickupEnabled,
        deliveryEnabled: form.deliveryEnabled,
        deliveryFee: Number(form.deliveryFee),
        licenceNumber: form.licenceNumber || undefined,
      });
      onSaved(updated);
      setSaved(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save changes.');
    } finally {
      setSaving(false);
    }
  }
  return (
    <form onSubmit={submit} className="grid gap-3 sm:grid-cols-2">
      <label>
        Name
        <input
          required
          className="input mt-1 w-full"
          value={form.name}
          onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
        />
      </label>
      <label>
        Telephone
        <input
          required
          className="input mt-1 w-full"
          value={form.telephone}
          onChange={(e) => setForm((f) => ({ ...f, telephone: e.target.value }))}
        />
      </label>
      <label className="sm:col-span-2">
        Address
        <input
          required
          className="input mt-1 w-full"
          value={form.address}
          onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
        />
      </label>
      <label>
        Location / city
        <input
          required
          className="input mt-1 w-full"
          value={form.location}
          onChange={(e) => setForm((f) => ({ ...f, location: e.target.value }))}
        />
      </label>
      <label>
        Delivery fee (L$)
        <input
          required
          type="number"
          min={0}
          step="0.01"
          className="input mt-1 w-full"
          value={form.deliveryFee}
          onChange={(e) => setForm((f) => ({ ...f, deliveryFee: e.target.value }))}
        />
      </label>
      <label>
        Licence number
        <input
          className="input mt-1 w-full"
          value={form.licenceNumber}
          onChange={(e) => setForm((f) => ({ ...f, licenceNumber: e.target.value }))}
        />
      </label>
      <label>
        Logo URL
        <input
          className="input mt-1 w-full"
          value={form.logoUrl}
          onChange={(e) => setForm((f) => ({ ...f, logoUrl: e.target.value }))}
        />
      </label>
      <label>
        Cover image URL
        <input
          className="input mt-1 w-full"
          value={form.coverUrl}
          onChange={(e) => setForm((f) => ({ ...f, coverUrl: e.target.value }))}
        />
      </label>
      <label>
        Latitude
        <input
          type="number"
          step="any"
          placeholder="e.g. 6.3156"
          className="input mt-1 w-full"
          value={form.latitude}
          onChange={(e) => setForm((f) => ({ ...f, latitude: e.target.value }))}
        />
      </label>
      <label>
        Longitude
        <input
          type="number"
          step="any"
          placeholder="e.g. -10.8074"
          className="input mt-1 w-full"
          value={form.longitude}
          onChange={(e) => setForm((f) => ({ ...f, longitude: e.target.value }))}
        />
      </label>
      <p className="text-xs text-slate-500 sm:col-span-2">
        Coordinates place this pharmacy on the marketplace map — without them it stays visible
        in list view only.
      </p>
      <label className="flex items-center gap-2">
        <input
          type="checkbox"
          checked={form.pickupEnabled}
          onChange={(e) => setForm((f) => ({ ...f, pickupEnabled: e.target.checked }))}
        />
        Pickup enabled
      </label>
      <label className="flex items-center gap-2">
        <input
          type="checkbox"
          checked={form.deliveryEnabled}
          onChange={(e) => setForm((f) => ({ ...f, deliveryEnabled: e.target.checked }))}
        />
        Delivery enabled
      </label>
      <button className="btn-primary min-h-11 sm:col-span-2" disabled={saving}>
        {saving ? 'Saving…' : 'Save profile'}
      </button>
      {saved && (
        <p role="status" className="text-sm text-emerald-700 sm:col-span-2">
          Profile updated.
        </p>
      )}
      {error && (
        <p role="alert" className="error-state sm:col-span-2">
          {error}
        </p>
      )}
    </form>
  );
}

function emptyHours(): PharmacyOpeningHoursEntry[] {
  return DAY_NAMES.map((_, dayOfWeek) => ({
    dayOfWeek,
    opensAt: '08:00',
    closesAt: '20:00',
    isClosed: false,
  }));
}

// The only place a pharmacy can ever populate pharmacy_opening_hours —
// without this, directory()'s "Open now" filter (which inner-joins that
// table) can never match this pharmacy, no matter how it was created.
function OpeningHoursSection({ pharmacyId }: { pharmacyId: string }) {
  const [hours, setHours] = useState<PharmacyOpeningHoursEntry[] | null>(null),
    [saving, setSaving] = useState(false),
    [error, setError] = useState(''),
    [saved, setSaved] = useState(false);
  useEffect(() => {
    getMyPharmacyHours(pharmacyId)
      .then((rows) =>
        setHours(
          rows.length
            ? DAY_NAMES.map(
                (_, dayOfWeek) =>
                  rows.find((r) => r.dayOfWeek === dayOfWeek) ?? {
                    dayOfWeek,
                    opensAt: '08:00',
                    closesAt: '20:00',
                    isClosed: false,
                  },
              )
            : emptyHours(),
        ),
      )
      .catch((e) => setError(e instanceof Error ? e.message : 'Load failed'));
  }, [pharmacyId]);
  function updateDay(dayOfWeek: number, patch: Partial<PharmacyOpeningHoursEntry>) {
    setHours((prev) => (prev ?? emptyHours()).map((h) => (h.dayOfWeek === dayOfWeek ? { ...h, ...patch } : h)));
  }
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!hours) return;
    setSaving(true);
    setError('');
    setSaved(false);
    try {
      const updated = await savePharmacyHours(pharmacyId, hours);
      setHours(DAY_NAMES.map((_, dayOfWeek) => updated.find((r) => r.dayOfWeek === dayOfWeek) ?? hours[dayOfWeek]));
      setSaved(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save hours.');
    } finally {
      setSaving(false);
    }
  }
  if (!hours) return <p className="mt-2">Loading hours…</p>;
  return (
    <form onSubmit={submit} className="mt-2 space-y-2">
      {hours.map((h) => (
        <div key={h.dayOfWeek} className="flex flex-wrap items-center gap-2">
          <span className="w-24 text-sm font-medium">{DAY_NAMES[h.dayOfWeek]}</span>
          <label className="flex items-center gap-1 text-sm">
            <input
              type="checkbox"
              checked={h.isClosed}
              onChange={(e) => updateDay(h.dayOfWeek, { isClosed: e.target.checked })}
            />
            Closed
          </label>
          {!h.isClosed && (
            <>
              <input
                type="time"
                className="input"
                value={h.opensAt ?? '08:00'}
                onChange={(e) => updateDay(h.dayOfWeek, { opensAt: e.target.value })}
              />
              <span className="text-sm text-slate-500">to</span>
              <input
                type="time"
                className="input"
                value={h.closesAt ?? '20:00'}
                onChange={(e) => updateDay(h.dayOfWeek, { closesAt: e.target.value })}
              />
            </>
          )}
        </div>
      ))}
      <button disabled={saving} className="btn-primary mt-2 min-h-9">
        {saving ? 'Saving…' : 'Save hours'}
      </button>
      {saved && (
        <p role="status" className="text-sm text-emerald-700">
          Hours saved.
        </p>
      )}
      {error && (
        <p role="alert" className="error-state">
          {error}
        </p>
      )}
    </form>
  );
}

export default function PharmacyProfilePage() {
  const { pharmacy, onPharmacyUpdated } = usePharmacyDashboard();
  return (
    <div className="flex flex-col gap-5">
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <h2 className="text-xl font-bold text-slate-950 dark:text-slate-50">Profile</h2>
        <p className="mb-3 text-sm text-slate-500 dark:text-slate-400">
          Contact info, delivery settings, and storefront images.
        </p>
        <ProfileForm pharmacy={pharmacy} onSaved={onPharmacyUpdated} />
      </section>
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <h2 className="text-xl font-bold text-slate-950 dark:text-slate-50">Opening hours</h2>
        <p className="mb-3 text-sm text-slate-500 dark:text-slate-400">
          Required for this pharmacy to ever appear under the marketplace&apos;s &quot;Open
          now&quot; filter.
        </p>
        <OpeningHoursSection pharmacyId={pharmacy.id} />
      </section>
    </div>
  );
}
