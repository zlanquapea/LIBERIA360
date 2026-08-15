'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { AdminGate } from '@/components/AdminGate';
import { useAuth } from '@/hooks/useAuth';
import { createSponsoredPlacement, getAllSponsoredPlacements, revokeSponsoredPlacement } from '@/lib/admin-api';
import { getPlaces } from '@/lib/api';
import { HttpError } from '@/lib/http';
import type { Place, SponsoredPlacement } from '@/lib/types';

const inputClass =
  'rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500';

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function placementState(p: SponsoredPlacement): 'active' | 'upcoming' | 'past' {
  const now = today();
  if (p.startDate > now) return 'upcoming';
  if (p.endDate < now) return 'past';
  return 'active';
}

// Sponsored placements admin ("Featured this week" — Business Plan §8.3) —
// create a time-boxed campaign for a place, revoke one early, and see
// past/active/upcoming at a glance.
export default function AdminSponsoredPlacementsPage() {
  return (
    <AdminGate>
      <SponsoredPlacementsDashboard />
    </AdminGate>
  );
}

function SponsoredPlacementsDashboard() {
  const { token } = useAuth();
  const [placements, setPlacements] = useState<SponsoredPlacement[]>([]);
  const [places, setPlaces] = useState<Place[]>([]);

  function reload() {
    if (!token) return;
    getAllSponsoredPlacements(token).then(setPlacements);
  }

  useEffect(() => {
    reload();
    getPlaces({ limit: 100 }).then((res) => setPlaces(res.data));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  if (!token) return null;

  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-6 px-4 py-6">
      <h1 className="text-xl font-bold text-slate-900">Sponsored Placements</h1>

      <CreatePlacementForm token={token} places={places} onCreated={reload} />

      <section className="flex flex-col gap-3">
        {placements.length === 0 ? (
          <p className="text-sm text-slate-500">No sponsored placements yet.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {placements.map((p) => (
              <PlacementRow key={p.id} token={token} placement={p} onRevoked={reload} />
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}

function CreatePlacementForm({
  token,
  places,
  onCreated,
}: {
  token: string;
  places: Place[];
  onCreated: () => void;
}) {
  const [placeId, setPlaceId] = useState('');
  const [startDate, setStartDate] = useState(today());
  const [endDate, setEndDate] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!placeId && places.length > 0) setPlaceId(places[0].id);
  }, [places, placeId]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await createSponsoredPlacement(token, { placeId, startDate, endDate });
      setEndDate('');
      onCreated();
    } catch (err) {
      setError(err instanceof HttpError ? err.message : 'Something went wrong. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3 rounded-xl border border-slate-200 p-3">
      <h2 className="text-sm font-semibold text-slate-700">New placement</h2>
      <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
        Place
        <select value={placeId} onChange={(e) => setPlaceId(e.target.value)} className={inputClass}>
          {places.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </label>
      <div className="grid grid-cols-2 gap-3">
        <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
          Start date
          <input required type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className={inputClass} />
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
          End date
          <input required type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className={inputClass} />
        </label>
      </div>
      {error && (
        <p role="alert" className="rounded-lg bg-flag-500/10 px-3 py-2 text-sm text-flag-700">
          {error}
        </p>
      )}
      <button
        type="submit"
        disabled={submitting || !placeId}
        className="self-start rounded-full bg-brand-700 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-800 disabled:opacity-60"
      >
        {submitting ? 'Creating…' : 'Create placement'}
      </button>
    </form>
  );
}

function PlacementRow({
  token,
  placement,
  onRevoked,
}: {
  token: string;
  placement: SponsoredPlacement;
  onRevoked: () => void;
}) {
  const [revoking, setRevoking] = useState(false);
  const state = placementState(placement);
  const badgeStyle =
    state === 'active'
      ? 'bg-emerald-100 text-emerald-800'
      : state === 'upcoming'
        ? 'bg-amber-100 text-amber-800'
        : 'bg-slate-100 text-slate-500';

  async function revoke() {
    setRevoking(true);
    try {
      await revokeSponsoredPlacement(token, placement.id);
      onRevoked();
    } finally {
      setRevoking(false);
    }
  }

  return (
    <li className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 p-3">
      <div className="min-w-0">
        <p className="truncate font-medium text-slate-900">{placement.place.name}</p>
        <p className="text-xs text-slate-500">
          {placement.startDate} – {placement.endDate}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${badgeStyle}`}>{state}</span>
        <button
          type="button"
          disabled={revoking}
          onClick={revoke}
          className="rounded-full border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:border-flag-500 hover:text-flag-700 disabled:opacity-60"
        >
          {revoking ? 'Revoking…' : 'Revoke'}
        </button>
      </div>
    </li>
  );
}
