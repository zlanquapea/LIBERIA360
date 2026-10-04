'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { ArrowLeftIcon, ExclamationTriangleIcon } from '@heroicons/react/24/outline';
import { SignedInGate } from '@/components/prescriptions/SignedInGate';
import { ClinicProfileForm } from '@/components/prescriptions/ClinicProfileForm';
import { EPrescriptionCard, RxStatusPill } from '@/components/prescriptions/EPrescriptionCard';
import { PrescriptionWriter } from '@/components/prescriptions/PrescriptionWriter';
import {
  CLINIC_ROLE_LABELS,
  CLINIC_STATUS_STYLES,
  DOCTOR_STATUS_COPY,
} from '@/components/prescriptions/clinic-labels';
import {
  assignClinicStaff,
  cancelPrescription,
  getClinicPrescription,
  getClinicPrescriptions,
  getClinicStaff,
  getMyClinic,
  removeClinicStaff,
  updateClinic,
  type ClinicStaffMember,
  type ClinicStaffRole,
  type EPrescription,
  type MyClinic,
} from '@/lib/clinic-api';

type Tab = 'write' | 'log' | 'profile' | 'staff';

function PrescriptionLog({ clinic }: { clinic: MyClinic }) {
  const [list, setList] = useState<EPrescription[] | null>(null);
  const [open, setOpen] = useState<EPrescription | null>(null);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');

  useEffect(() => {
    getClinicPrescriptions(clinic.id)
      .then(setList)
      .catch((e) => setError(e instanceof Error ? e.message : 'Could not load prescriptions.'));
  }, [clinic.id]);

  async function show(rx: EPrescription) {
    if (open?.id === rx.id) return setOpen(null);
    try {
      setOpen(await getClinicPrescription(clinic.id, rx.id));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not open the prescription.');
    }
  }

  async function cancel(rx: EPrescription) {
    const reason = window.prompt('Why are you cancelling this prescription? The patient and pharmacy will see this.');
    if (!reason || reason.trim().length < 3) return;
    try {
      const updated = await cancelPrescription(clinic.id, rx.id, reason.trim());
      setList((all) => all?.map((x) => (x.id === rx.id ? updated : x)) ?? null);
      setOpen((o) => (o?.id === rx.id ? { ...o, ...updated } : o));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not cancel it.');
    }
  }

  const q = query.trim().toLowerCase();
  const shown = (list ?? []).filter(
    (rx) => !q || rx.patientName.toLowerCase().includes(q) || rx.code.toLowerCase().includes(q),
  );

  return (
    <div className="flex flex-col gap-3">
      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search by patient or code"
        aria-label="Search prescriptions"
        className="input w-full"
      />
      {error && (
        <p role="alert" className="error-state">
          {error}
        </p>
      )}
      {list === null && !error && <p className="text-sm text-slate-500">Loading…</p>}
      {list?.length === 0 && <p className="empty-state">No prescriptions yet.</p>}
      <ul className="flex flex-col gap-2">
        {shown.map((rx) => (
          <li key={rx.id} className="flex flex-col gap-2">
            <button
              type="button"
              onClick={() => void show(rx)}
              aria-expanded={open?.id === rx.id}
              className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-left hover:border-brand-300 dark:border-slate-800 dark:bg-slate-900"
            >
              <span className="min-w-0 flex-1">
                <span className="block truncate font-semibold text-slate-900 dark:text-slate-50">{rx.patientName}</span>
                <span className="block text-xs text-slate-500 dark:text-slate-400">
                  <span className="font-mono">{rx.code}</span> · {new Date(rx.issuedAt).toLocaleDateString()} ·{' '}
                  {rx.itemCount} medicine{rx.itemCount === 1 ? '' : 's'} · Dr {rx.doctor?.fullName}
                  {rx.pharmacy ? ` · ${rx.pharmacy.name}` : ''}
                </span>
              </span>
              <RxStatusPill rx={rx} />
            </button>
            {open?.id === rx.id && (
              <EPrescriptionCard rx={open} printable>
                {['issued', 'sent', 'preparing', 'ready'].includes(open.status) && !open.expired && (
                  <button type="button" onClick={() => void cancel(open)} className="btn-secondary min-h-10 text-red-700">
                    Cancel prescription
                  </button>
                )}
              </EPrescriptionCard>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

function StaffTab({ clinic }: { clinic: MyClinic }) {
  const [staff, setStaff] = useState<ClinicStaffMember[] | null>(null);
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<ClinicStaffRole>('doctor');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const isAdmin = clinic.myRole === 'admin';

  useEffect(() => {
    getClinicStaff(clinic.id)
      .then(setStaff)
      .catch((e) => setError(e instanceof Error ? e.message : 'Could not load staff.'));
  }, [clinic.id]);

  async function run(action: () => Promise<ClinicStaffMember[]>) {
    setBusy(true);
    setError('');
    try {
      setStaff(await action());
      setEmail('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not update staff.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <ul className="divide-y divide-slate-100 rounded-2xl border border-slate-200 dark:divide-slate-800 dark:border-slate-800">
        {staff?.map((m) => (
          <li key={m.userId} className={`flex flex-wrap items-center gap-3 px-4 py-3 ${m.active ? '' : 'opacity-50'}`}>
            <span className="min-w-0 flex-1">
              <span className="block truncate font-semibold text-slate-900 dark:text-slate-50">
                {m.doctor ? `Dr ${m.doctor.fullName}` : m.name}
              </span>
              <span className="block truncate text-xs text-slate-500 dark:text-slate-400">
                {CLINIC_ROLE_LABELS[m.role]} · {m.email}
                {!m.active && ' · removed'}
              </span>
            </span>
            {(m.role === 'doctor' || m.doctor) && (
              <span
                className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                  m.doctor ? DOCTOR_STATUS_COPY[m.doctor.verificationStatus].style : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'
                }`}
              >
                {m.doctor ? DOCTOR_STATUS_COPY[m.doctor.verificationStatus].label : 'No licence added'}
              </span>
            )}
            {isAdmin && m.active && (
              <button type="button" disabled={busy} onClick={() => void run(() => removeClinicStaff(clinic.id, m.userId))} className="text-sm font-semibold text-red-700 hover:underline disabled:opacity-50">
                Remove
              </button>
            )}
          </li>
        ))}
      </ul>
      {isAdmin && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void run(() => assignClinicStaff(clinic.id, email.trim(), role));
          }}
          className="flex flex-col gap-2 rounded-2xl border border-slate-200 p-4 sm:flex-row sm:items-end dark:border-slate-800"
        >
          <label className="min-w-0 flex-1 text-xs font-semibold text-slate-600 dark:text-slate-300">
            Add someone by their LIBERIA360 email
            <input required type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="input mt-1 w-full" />
          </label>
          <label className="text-xs font-semibold text-slate-600 dark:text-slate-300">
            Role
            <select value={role} onChange={(e) => setRole(e.target.value as ClinicStaffRole)} className="input mt-1 w-full">
              <option value="doctor">Doctor</option>
              <option value="front_desk">Front desk</option>
              <option value="admin">Clinic admin</option>
            </select>
          </label>
          <button disabled={busy} className="btn-primary min-h-11">
            Add
          </button>
        </form>
      )}
      <p className="text-xs text-slate-500 dark:text-slate-400">
        Doctors add their own Medical Council licence from Clinics &amp; prescribing. They can prescribe once
        LIBERIA360 has checked it. Front desk staff can see and print prescriptions but not write them.
      </p>
      {error && (
        <p role="alert" className="error-state">
          {error}
        </p>
      )}
    </div>
  );
}

function Workspace() {
  const { id } = useParams<{ id: string }>();
  const [clinic, setClinic] = useState<MyClinic | null>(null);
  const [error, setError] = useState('');
  const [tab, setTab] = useState<Tab>('write');
  const [logKey, setLogKey] = useState(0);

  const load = useCallback(() => {
    getMyClinic(id)
      .then((c) => {
        setClinic(c);
        if (!c.canPrescribe) setTab((t) => (t === 'write' ? 'log' : t));
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Could not load the clinic.'));
  }, [id]);
  useEffect(load, [load]);

  if (error)
    return (
      <main className="mx-auto max-w-3xl px-4 py-8">
        <p role="alert" className="error-state">
          {error}
        </p>
      </main>
    );
  if (!clinic) return <main className="mx-auto max-w-3xl px-4 py-8 text-sm text-slate-500">Loading…</main>;

  const tabs: Array<{ key: Tab; label: string }> = [
    ...(clinic.canPrescribe ? [{ key: 'write' as Tab, label: 'Write prescription' }] : []),
    { key: 'log', label: 'Prescriptions' },
    { key: 'profile', label: 'Clinic profile' },
    { key: 'staff', label: 'Staff' },
  ];

  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-5 px-4 py-8">
      <Link href="/account/clinic-dashboard" className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-500 hover:text-brand-700">
        <ArrowLeftIcon aria-hidden className="h-4 w-4" /> Clinics &amp; prescribing
      </Link>
      <header className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-brand-700 dark:text-brand-300">Clinic</p>
        <h1 className="mt-1 break-words font-display text-2xl font-bold text-slate-950 dark:text-slate-50">{clinic.name}</h1>
        <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
          <span className={`rounded-full px-2.5 py-0.5 font-semibold ${CLINIC_STATUS_STYLES[clinic.status]}`}>
            {clinic.status === 'approved' ? 'Verified clinic' : clinic.status[0].toUpperCase() + clinic.status.slice(1)}
          </span>
          <span className="text-slate-500 dark:text-slate-400">{CLINIC_ROLE_LABELS[clinic.myRole]}</span>
          {clinic.pharmacy && (
            <span className="rounded-full bg-slate-100 px-2.5 py-0.5 font-semibold text-slate-700 dark:bg-slate-800 dark:text-slate-300">
              Pharmacy: {clinic.pharmacy.name}
            </span>
          )}
        </div>
        {clinic.status !== 'approved' && (
          <p className="mt-3 flex items-start gap-2 rounded-2xl bg-amber-50 p-3 text-sm text-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
            <ExclamationTriangleIcon aria-hidden className="mt-0.5 h-5 w-5 shrink-0" />
            {clinic.status === 'pending'
              ? 'LIBERIA360 is checking this clinic. Prescribing opens once it is verified.'
              : clinic.statusNotes ?? 'This clinic is not active. Contact LIBERIA360 support.'}
          </p>
        )}
        {clinic.status === 'approved' && !clinic.canPrescribe && clinic.myRole !== 'front_desk' && (
          <p className="mt-3 text-sm text-slate-600 dark:text-slate-300">
            To write prescriptions, add your Medical Council licence on{' '}
            <Link href="/account/clinic-dashboard" className="font-semibold text-brand-700 underline">
              Clinics &amp; prescribing
            </Link>{' '}
            and wait for it to be checked.
          </p>
        )}
      </header>

      <nav aria-label="Clinic sections" className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
        {tabs.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            aria-current={tab === t.key ? 'page' : undefined}
            className={`shrink-0 rounded-full border px-4 py-2 text-sm font-semibold ${
              tab === t.key
                ? 'border-brand-700 bg-brand-700 text-white'
                : 'border-slate-200 bg-white text-slate-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300'
            }`}
          >
            {t.label}
          </button>
        ))}
      </nav>

      <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        {tab === 'write' && <PrescriptionWriter clinic={clinic} onIssued={() => setLogKey((k) => k + 1)} />}
        {tab === 'log' && <PrescriptionLog key={logKey} clinic={clinic} />}
        {tab === 'profile' &&
          (clinic.myRole === 'admin' ? (
            <ClinicProfileForm
              clinic={clinic}
              submitLabel="Save clinic"
              onSubmit={async (input) => {
                setClinic(await updateClinic(clinic.id, input));
              }}
            />
          ) : (
            <p className="text-sm text-slate-600 dark:text-slate-300">Only a clinic admin can edit the clinic profile.</p>
          ))}
        {tab === 'staff' && <StaffTab clinic={clinic} />}
      </section>
    </main>
  );
}

export default function ClinicWorkspacePage() {
  return (
    <SignedInGate title="Clinic" reason="Log in to open your clinic.">
      <Workspace />
    </SignedInGate>
  );
}
