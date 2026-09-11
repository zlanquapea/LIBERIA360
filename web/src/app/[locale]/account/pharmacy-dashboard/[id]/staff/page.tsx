'use client';

import { useEffect, useState } from 'react';
import { usePharmacyDashboard } from '@/components/PharmacyDashboardContext';
import {
  assignPharmacyStaff,
  deactivatePharmacyStaff,
  getPharmacyStaff,
  type PharmacyStaffMember,
} from '@/lib/pharmacy-api';

function StaffForm({ pharmacyId, onChanged }: { pharmacyId: string; onChanged: () => void }) {
  const [email, setEmail] = useState(''),
    [role, setRole] = useState<'manager' | 'pharmacist' | 'employee'>('employee'),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [added, setAdded] = useState(false);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    setAdded(false);
    try {
      await assignPharmacyStaff(pharmacyId, { email, role });
      setEmail('');
      setAdded(true);
      onChanged();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not add staff member.');
    } finally {
      setBusy(false);
    }
  }
  return (
    <form onSubmit={submit} className="flex flex-wrap items-end gap-2">
      <label className="flex-1">
        Colleague&apos;s email
        <input
          required
          type="email"
          className="input mt-1 w-full"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
      </label>
      <label>
        Role
        <select className="input mt-1" value={role} onChange={(e) => setRole(e.target.value as typeof role)}>
          <option value="manager">Manager</option>
          <option value="pharmacist">Pharmacist</option>
          <option value="employee">Employee</option>
        </select>
      </label>
      <button className="btn-secondary min-h-11" disabled={busy}>
        {busy ? 'Adding…' : 'Add staff'}
      </button>
      {added && (
        <p role="status" className="w-full text-sm text-emerald-700">
          Staff member added.
        </p>
      )}
      {error && (
        <p role="alert" className="error-state w-full">
          {error}
        </p>
      )}
    </form>
  );
}

function StaffRoster({
  pharmacyId,
  isManager,
  refreshKey,
  onChanged,
}: {
  pharmacyId: string;
  isManager: boolean;
  refreshKey: number;
  onChanged: () => void;
}) {
  const [members, setMembers] = useState<PharmacyStaffMember[] | null>(null),
    [error, setError] = useState(''),
    [busyUserId, setBusyUserId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    getPharmacyStaff(pharmacyId)
      .then((m) => {
        if (!cancelled) setMembers(m);
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Could not load staff.');
      });
    return () => {
      cancelled = true;
    };
  }, [pharmacyId, refreshKey]);

  async function deactivate(userId: string) {
    if (!confirm("Remove this staff member's access?")) return;
    setBusyUserId(userId);
    setError('');
    try {
      await deactivatePharmacyStaff(pharmacyId, userId);
      onChanged();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not remove staff member.');
    } finally {
      setBusyUserId(null);
    }
  }

  if (error)
    return (
      <p role="alert" className="error-state mt-3">
        {error}
      </p>
    );
  if (!members) return <p className="mt-3 text-sm text-slate-500">Loading staff…</p>;

  return (
    <ul className="mt-3 divide-y divide-slate-200 dark:divide-slate-800">
      {members.map((m) => (
        <li key={m.userId} className="flex items-center justify-between gap-2 py-2 text-sm">
          <span>
            {m.email ?? m.userId} <span className="capitalize text-slate-500">({m.role})</span>
          </span>
          {isManager && (
            <button
              type="button"
              className="btn-secondary min-h-9 text-xs"
              disabled={busyUserId === m.userId}
              onClick={() => deactivate(m.userId)}
            >
              {busyUserId === m.userId ? 'Removing…' : 'Remove'}
            </button>
          )}
        </li>
      ))}
    </ul>
  );
}

export default function PharmacyStaffPage() {
  const { pharmacy, stats } = usePharmacyDashboard();
  const isManager = stats?.role === 'manager';
  const [refreshKey, setRefreshKey] = useState(0);
  const bump = () => setRefreshKey((k) => k + 1);
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <h2 className="text-xl font-bold text-slate-950 dark:text-slate-50">Staff</h2>
      <p className="mb-3 text-sm text-slate-500 dark:text-slate-400">
        Only a pharmacist on staff can decide on a prescription review.
      </p>
      {isManager ? (
        <StaffForm pharmacyId={pharmacy.id} onChanged={bump} />
      ) : (
        <p className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-300">
          Only a manager can add or reassign staff at this pharmacy.
        </p>
      )}
      <StaffRoster pharmacyId={pharmacy.id} isManager={isManager} refreshKey={refreshKey} onChanged={bump} />
    </section>
  );
}
