'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import {
  ArrowRightIcon,
  BuildingOffice2Icon,
  ChatBubbleLeftRightIcon,
  CheckBadgeIcon,
  ChevronRightIcon,
  PlusIcon,
} from '@heroicons/react/24/outline';
import { SignedInGate } from '@/components/prescriptions/SignedInGate';
import { ClinicProfileForm } from '@/components/prescriptions/ClinicProfileForm';
import { DoctorProfileForm } from '@/components/prescriptions/DoctorProfileForm';
import { CLINIC_STATUS_STYLES, CLINIC_ROLE_LABELS } from '@/components/prescriptions/clinic-labels';
import { createClinic, getMyClinics, type MyClinic } from '@/lib/clinic-api';

function ClinicList() {
  const [clinics, setClinics] = useState<MyClinic[] | null>(null);
  const [error, setError] = useState('');
  const [applying, setApplying] = useState(false);
  useEffect(() => {
    getMyClinics()
      .then(setClinics)
      .catch((e) => setError(e instanceof Error ? e.message : 'Could not load your clinics.'));
  }, []);

  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-6 px-4 py-8">
      <div>
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-brand-700 dark:text-brand-300">
          Health workspace
        </p>
        <h1 className="font-display text-2xl font-bold text-slate-950 dark:text-slate-50">Clinics & prescribing</h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Write e-prescriptions your patients can fill at any pharmacy, with a QR code that can only be
          used once.
        </p>
      </div>

      <DoctorProfileForm />

      {clinics && clinics.length > 0 && (
        <Link
          href="/account/clinic-dashboard/consultations"
          className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-brand-300 dark:border-slate-800 dark:bg-slate-900"
        >
          <span className="flex min-w-0 items-center gap-3">
            <ChatBubbleLeftRightIcon aria-hidden className="h-6 w-6 shrink-0 text-brand-600" />
            <span className="min-w-0">
              <span className="block font-bold text-slate-950 dark:text-slate-50">Online consultations</span>
              <span className="block text-sm text-slate-500 dark:text-slate-400">
                Check payments, chat with patients and send prescriptions.
              </span>
            </span>
          </span>
          <ChevronRightIcon aria-hidden className="h-5 w-5 shrink-0 text-slate-400" />
        </Link>
      )}

      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-bold text-slate-950 dark:text-slate-50">Your clinics</h2>
          {!applying && (
            <button type="button" onClick={() => setApplying(true)} className="btn-secondary min-h-10 gap-1.5">
              <PlusIcon aria-hidden className="h-4 w-4" /> Register a clinic
            </button>
          )}
        </div>
        {error && (
          <p role="alert" className="error-state">
            {error}
          </p>
        )}
        {clinics === null && !error && <p className="text-sm text-slate-500">Loading…</p>}
        {clinics?.length === 0 && !applying && (
          <p className="empty-state">
            You&apos;re not on a clinic&apos;s staff yet. Register your clinic, or ask its admin to add you
            by email.
          </p>
        )}
        <ul className="flex flex-col gap-3">
          {clinics?.map((c) => (
            <li key={c.id}>
              <Link
                href={`/account/clinic-dashboard/${c.id}`}
                className="flex items-center gap-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-brand-300 dark:border-slate-800 dark:bg-slate-900"
              >
                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-brand-50 text-brand-700 dark:bg-brand-950/50 dark:text-brand-300">
                  <BuildingOffice2Icon aria-hidden className="h-6 w-6" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-semibold text-slate-900 dark:text-slate-50">{c.name}</span>
                  <span className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                    <span className={`rounded-full px-2 py-0.5 font-semibold ${CLINIC_STATUS_STYLES[c.status]}`}>
                      {c.status === 'approved' ? 'Verified' : c.status[0].toUpperCase() + c.status.slice(1)}
                    </span>
                    {CLINIC_ROLE_LABELS[c.myRole]}
                    {c.canPrescribe && (
                      <span className="inline-flex items-center gap-0.5 text-brand-700 dark:text-brand-300">
                        <CheckBadgeIcon aria-hidden className="h-4 w-4" /> Can prescribe
                      </span>
                    )}
                  </span>
                </span>
                <ArrowRightIcon aria-hidden className="h-5 w-5 shrink-0 text-slate-400" />
              </Link>
            </li>
          ))}
        </ul>
        {applying && (
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <h3 className="font-bold text-slate-950 dark:text-slate-50">Register a clinic</h3>
            <p className="mb-3 text-sm text-slate-500 dark:text-slate-400">
              LIBERIA360 checks your Ministry of Health facility licence before your doctors can
              prescribe.
            </p>
            <ClinicProfileForm
              submitLabel="Submit for verification"
              onCancel={() => setApplying(false)}
              onSubmit={async (input) => {
                const created = await createClinic(input);
                setClinics((list) => [...(list ?? []), created]);
                setApplying(false);
              }}
            />
          </div>
        )}
      </section>
    </main>
  );
}

export default function ClinicDashboardPage() {
  return (
    <SignedInGate title="Clinics & prescribing" reason="Log in to manage a clinic or write prescriptions.">
      <ClinicList />
    </SignedInGate>
  );
}
