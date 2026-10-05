'use client';

import { useEffect, useState } from 'react';
import { getAttachablePharmacies, type ClinicProfileInput, type MyClinic, type PharmacySummary } from '@/lib/clinic-api';

export function ClinicProfileForm({
  clinic,
  submitLabel,
  onSubmit,
  onCancel,
}: {
  clinic?: MyClinic;
  submitLabel: string;
  onSubmit: (input: ClinicProfileInput) => Promise<void>;
  onCancel?: () => void;
}) {
  const [form, setForm] = useState({
    name: clinic?.name ?? '',
    address: clinic?.address ?? '',
    location: clinic?.location ?? 'Monrovia',
    telephone: clinic?.telephone ?? '',
    about: clinic?.about ?? '',
    licenceNumber: clinic?.licenceNumber ?? '',
    pharmacyId: clinic?.pharmacyId ?? '',
    mtnMomoNumber: clinic?.mtnMomoNumber ?? '',
    orangeMoneyNumber: clinic?.orangeMoneyNumber ?? '',
  });
  const [pharmacies, setPharmacies] = useState<PharmacySummary[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    getAttachablePharmacies().then(setPharmacies).catch(() => setPharmacies([]));
  }, []);

  // Keep the attached pharmacy selectable even if the caller doesn't manage it.
  const options =
    clinic?.pharmacy && !pharmacies.some((p) => p.id === clinic.pharmacy!.id)
      ? [clinic.pharmacy, ...pharmacies]
      : pharmacies;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    setSaved(false);
    try {
      await onSubmit({
        name: form.name,
        address: form.address,
        location: form.location,
        telephone: form.telephone,
        about: form.about || null,
        licenceNumber: form.licenceNumber || undefined,
        pharmacyId: form.pharmacyId || null,
        mtnMomoNumber: form.mtnMomoNumber.trim() || null,
        orangeMoneyNumber: form.orangeMoneyNumber.trim() || null,
      });
      setSaved(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save the clinic.');
    } finally {
      setBusy(false);
    }
  }

  const field = (key: keyof typeof form) => ({
    value: form[key],
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
      setForm((f) => ({ ...f, [key]: e.target.value })),
  });

  return (
    <form onSubmit={submit} className="grid gap-3 sm:grid-cols-2">
      <label className="text-sm font-medium text-slate-700 dark:text-slate-200">
        Clinic name
        <input required minLength={2} className="input mt-1 w-full" {...field('name')} />
      </label>
      <label className="text-sm font-medium text-slate-700 dark:text-slate-200">
        Telephone
        <input required type="tel" inputMode="tel" className="input mt-1 w-full" {...field('telephone')} />
      </label>
      <label className="text-sm font-medium text-slate-700 dark:text-slate-200 sm:col-span-2">
        Address or landmark
        <input required minLength={4} placeholder="e.g. 15th Street, Sinkor, opposite the school" className="input mt-1 w-full" {...field('address')} />
      </label>
      <label className="text-sm font-medium text-slate-700 dark:text-slate-200">
        Town or city
        <input required minLength={2} className="input mt-1 w-full" {...field('location')} />
      </label>
      <label className="text-sm font-medium text-slate-700 dark:text-slate-200">
        Facility licence number
        <input placeholder="Ministry of Health licence" className="input mt-1 w-full" {...field('licenceNumber')} />
      </label>
      <label className="text-sm font-medium text-slate-700 dark:text-slate-200 sm:col-span-2">
        Attached pharmacy
        <select className="input mt-1 w-full" {...field('pharmacyId')}>
          <option value="">None</option>
          {options.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name} · {p.location}
            </option>
          ))}
        </select>
        <span className="mt-1 block text-xs font-normal text-slate-500 dark:text-slate-400">
          Prescriptions can go straight to this pharmacy so they&apos;re packed while the patient walks
          over. You can only attach a pharmacy you manage on LIBERIA360.
        </span>
      </label>
      <fieldset className="grid gap-3 rounded-2xl border border-slate-200 p-4 dark:border-slate-800 sm:col-span-2 sm:grid-cols-2">
        <legend className="px-1 text-sm font-bold text-slate-900 dark:text-slate-50">Online consultation payments</legend>
        <label className="text-sm font-medium text-slate-700 dark:text-slate-200">
          MTN MoMo number
          <input type="tel" inputMode="tel" placeholder="0886 000 000" className="input mt-1 w-full" {...field('mtnMomoNumber')} />
        </label>
        <label className="text-sm font-medium text-slate-700 dark:text-slate-200">
          Orange Money number
          <input type="tel" inputMode="tel" placeholder="0777 000 000" className="input mt-1 w-full" {...field('orangeMoneyNumber')} />
        </label>
        <span className="text-xs text-slate-500 dark:text-slate-400 sm:col-span-2">
          Patients pay consultation fees to these numbers. Your doctors can offer online consultations once at least
          one is set.
        </span>
      </fieldset>
      <label className="text-sm font-medium text-slate-700 dark:text-slate-200 sm:col-span-2">
        About the clinic (optional)
        <textarea rows={3} maxLength={2000} placeholder="Services, opening times, languages spoken" className="input mt-1 w-full" {...field('about')} />
      </label>
      {error && (
        <p role="alert" className="error-state sm:col-span-2">
          {error}
        </p>
      )}
      {saved && clinic && (
        <p role="status" className="text-sm text-emerald-700 sm:col-span-2">
          Saved.
        </p>
      )}
      <div className="flex flex-wrap gap-2 sm:col-span-2">
        <button disabled={busy} className="btn-primary min-h-11">
          {busy ? 'Saving…' : submitLabel}
        </button>
        {onCancel && (
          <button type="button" onClick={onCancel} className="btn-secondary min-h-11">
            Cancel
          </button>
        )}
      </div>
    </form>
  );
}
