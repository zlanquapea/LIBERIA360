'use client';

import { useEffect, useState } from 'react';
import { CheckBadgeIcon } from '@heroicons/react/24/solid';
import {
  getDoctorProfile,
  getMyClinics,
  saveDoctorProfile,
  type DoctorProfile,
  type MyClinic,
} from '@/lib/clinic-api';
import { saveConsultSettings } from '@/lib/consultations-api';
import { formatMoney } from '@/lib/currency';
import { DOCTOR_STATUS_COPY } from './clinic-labels';

/**
 * A doctor's licence details. Only doctors fill this in; everyone else at
 * a clinic can skip it. Changing the licence number sends it back for checking.
 */
export function DoctorProfileForm({ onSaved }: { onSaved?: (p: DoctorProfile) => void }) {
  const [profile, setProfile] = useState<DoctorProfile | null | undefined>(undefined);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ fullName: '', specialty: 'General practice', licenceNumber: '', bio: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    getDoctorProfile()
      .then((p) => {
        setProfile(p);
        if (p) setForm({ fullName: p.fullName, specialty: p.specialty, licenceNumber: p.licenceNumber, bio: p.bio ?? '' });
      })
      .catch(() => setProfile(null));
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const saved = await saveDoctorProfile({ ...form, bio: form.bio || null });
      setProfile(saved);
      setOpen(false);
      onSaved?.(saved);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save your profile.');
    } finally {
      setBusy(false);
    }
  }

  if (profile === undefined) return null;
  const status = profile ? DOCTOR_STATUS_COPY[profile.verificationStatus] : null;

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="font-bold text-slate-950 dark:text-slate-50">
            {profile ? `Dr ${profile.fullName}` : 'Are you a doctor?'}
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {profile
              ? `${profile.specialty} · Licence ${profile.licenceNumber}`
              : 'Add your Liberia Medical and Dental Council licence to write e-prescriptions.'}
          </p>
          {status && (
            <span className={`mt-2 inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ${status.style}`}>
              {profile?.verificationStatus === 'verified' && <CheckBadgeIcon aria-hidden className="h-4 w-4" />}
              {status.label}
            </span>
          )}
          {profile?.verificationStatus === 'rejected' && profile.verificationNotes && (
            <p className="mt-2 text-sm text-red-700 dark:text-red-300">{profile.verificationNotes}</p>
          )}
        </div>
        {!open && (
          <button type="button" onClick={() => setOpen(true)} className="btn-secondary min-h-10">
            {profile ? 'Edit' : 'Add my licence'}
          </button>
        )}
      </div>
      {open && (
        <form onSubmit={submit} className="mt-4 grid gap-3 sm:grid-cols-2">
          <label className="text-sm font-medium text-slate-700 dark:text-slate-200">
            Full name (as on your licence)
            <input required minLength={3} className="input mt-1 w-full" value={form.fullName} onChange={(e) => setForm((f) => ({ ...f, fullName: e.target.value }))} />
          </label>
          <label className="text-sm font-medium text-slate-700 dark:text-slate-200">
            Specialty
            <input required minLength={2} className="input mt-1 w-full" value={form.specialty} onChange={(e) => setForm((f) => ({ ...f, specialty: e.target.value }))} />
          </label>
          <label className="text-sm font-medium text-slate-700 dark:text-slate-200 sm:col-span-2">
            Medical Council licence number
            <input required minLength={3} placeholder="e.g. LMDC-04512" className="input mt-1 w-full" value={form.licenceNumber} onChange={(e) => setForm((f) => ({ ...f, licenceNumber: e.target.value }))} />
          </label>
          <label className="text-sm font-medium text-slate-700 dark:text-slate-200 sm:col-span-2">
            Short bio (optional)
            <textarea rows={2} maxLength={1500} className="input mt-1 w-full" value={form.bio} onChange={(e) => setForm((f) => ({ ...f, bio: e.target.value }))} />
          </label>
          {profile && (
            <p className="text-xs text-slate-500 dark:text-slate-400 sm:col-span-2">
              Changing your name or licence number sends it back for checking.
            </p>
          )}
          {error && (
            <p role="alert" className="error-state sm:col-span-2">
              {error}
            </p>
          )}
          <div className="flex flex-wrap gap-2 sm:col-span-2">
            <button disabled={busy} className="btn-primary min-h-11">
              {busy ? 'Saving…' : 'Save'}
            </button>
            <button type="button" onClick={() => setOpen(false)} className="btn-secondary min-h-11">
              Cancel
            </button>
          </div>
        </form>
      )}
      {profile?.verificationStatus === 'verified' && !open && (
        <ConsultSettings profile={profile} onSaved={(p) => setProfile(p)} />
      )}
    </section>
  );
}

/** Fee, clinic and "available now" for online consultations. */
function ConsultSettings({ profile, onSaved }: { profile: DoctorProfile; onSaved: (p: DoctorProfile) => void }) {
  const [clinics, setClinics] = useState<MyClinic[] | null>(null);
  const [editing, setEditing] = useState(false);
  const [fee, setFee] = useState(profile.consultFee?.toString() ?? '');
  const [clinicId, setClinicId] = useState(profile.consultClinicId ?? '');
  const [availableNow, setAvailableNow] = useState(profile.availableNow);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    getMyClinics()
      .then((all) => {
        const usable = all.filter((c) => c.status === 'approved' && c.myRole !== 'front_desk');
        setClinics(usable);
        setClinicId((id) => id || usable[0]?.id || '');
      })
      .catch(() => setClinics([]));
  }, []);

  const offering = profile.consultFee != null;
  const chosen = clinics?.find((c) => c.id === clinicId);
  const takesMoney = Boolean(chosen?.mtnMomoNumber || chosen?.orangeMoneyNumber);

  async function save(next: { consultFee: number | null; availableNow: boolean }) {
    setBusy(true);
    setError('');
    try {
      await saveConsultSettings({ ...next, consultClinicId: next.consultFee == null ? null : clinicId || null });
      onSaved({
        ...profile,
        consultFee: next.consultFee,
        consultClinicId: next.consultFee == null ? null : clinicId,
        availableNow: next.consultFee == null ? false : next.availableNow,
      });
      setEditing(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save.');
    } finally {
      setBusy(false);
    }
  }

  if (!clinics) return null;
  return (
    <div className="mt-4 border-t border-slate-100 pt-4 dark:border-slate-800">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-sm font-bold text-slate-950 dark:text-slate-50">Online consultations</h3>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {offering
              ? `${formatMoney(profile.consultFee!, 'LRD')} per consultation${chosen ? `, paid to ${chosen.name}` : ''}.`
              : 'Patients can book you for a chat or voice-note consultation and pay by mobile money.'}
          </p>
        </div>
        {offering && !editing && (
          <label className="flex min-h-10 cursor-pointer items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-200">
            <input
              type="checkbox"
              role="switch"
              checked={profile.availableNow}
              disabled={busy}
              onChange={(e) => void save({ consultFee: profile.consultFee, availableNow: e.target.checked })}
              className="h-5 w-5 accent-brand-600"
            />
            Available now
          </label>
        )}
      </div>
      {!editing ? (
        <button type="button" onClick={() => setEditing(true)} className="btn-secondary mt-3 min-h-10">
          {offering ? 'Change fee or clinic' : 'Offer online consultations'}
        </button>
      ) : clinics.length === 0 ? (
        <p className="mt-3 text-sm text-slate-600 dark:text-slate-300">
          You need to work at an approved clinic first.
        </p>
      ) : (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void save({ consultFee: Number(fee), availableNow: true });
          }}
          className="mt-3 grid gap-3 sm:grid-cols-2"
        >
          <label className="text-sm font-medium text-slate-700 dark:text-slate-200">
            Fee (LRD)
            <input required type="number" min={0} max={100000} inputMode="numeric" value={fee} onChange={(e) => setFee(e.target.value)} className="input mt-1 w-full" />
          </label>
          <label className="text-sm font-medium text-slate-700 dark:text-slate-200">
            Paid to
            <select value={clinicId} onChange={(e) => setClinicId(e.target.value)} className="input mt-1 w-full">
              {clinics.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
          {chosen && !takesMoney && (
            <p className="text-sm text-amber-800 dark:text-amber-200 sm:col-span-2">
              {chosen.name} hasn&apos;t added an MTN MoMo or Orange Money number yet. A clinic admin can add one in
              the clinic details.
            </p>
          )}
          {error && (
            <p role="alert" className="error-state sm:col-span-2">
              {error}
            </p>
          )}
          <div className="flex flex-wrap gap-2 sm:col-span-2">
            <button disabled={busy || !takesMoney} className="btn-primary min-h-11">
              {busy ? 'Saving…' : 'Save'}
            </button>
            {offering && (
              <button
                type="button"
                disabled={busy}
                onClick={() => void save({ consultFee: null, availableNow: false })}
                className="btn-secondary min-h-11"
              >
                Stop offering
              </button>
            )}
            <button type="button" onClick={() => setEditing(false)} className="btn-secondary min-h-11">
              Cancel
            </button>
          </div>
        </form>
      )}
      {error && !editing && (
        <p role="alert" className="error-state mt-2">
          {error}
        </p>
      )}
    </div>
  );
}
