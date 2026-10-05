'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { ChatBubbleLeftRightIcon, MicrophoneIcon, ShieldCheckIcon } from '@heroicons/react/24/outline';
import { DoctorChip } from '@/components/prescriptions/DoctorChip';
import { getConsultDoctors, type ConsultDoctor } from '@/lib/consultations-api';
import { formatMoney } from '@/lib/currency';

/** Doctors taking online consultations, people online first. */
export function ConsultDirectory() {
  const [doctors, setDoctors] = useState<ConsultDoctor[] | null>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    getConsultDoctors()
      .then(setDoctors)
      .catch((e) => setError(e instanceof Error ? e.message : 'Could not load doctors.'));
  }, []);

  return (
    <main className="mx-auto flex w-full max-w-4xl flex-col gap-6 px-4 py-8 sm:px-6">
      <header className="relative isolate overflow-hidden rounded-[2rem] bg-gradient-to-br from-brand-800 via-brand-900 to-slate-950 p-6 text-white sm:p-10">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-gold-300">Online consultation</p>
        <h1 className="mt-2 max-w-xl font-display text-3xl font-extrabold leading-tight sm:text-4xl">
          Talk to a licensed doctor from your phone.
        </h1>
        <p className="mt-3 max-w-xl text-white/80">
          Explain what&apos;s wrong by chat or voice note. If you need medicine, the doctor sends the prescription
          straight to your phone.
        </p>
        <ul className="mt-5 flex flex-wrap gap-2 text-xs font-semibold">
          <li className="flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1.5 ring-1 ring-inset ring-white/25">
            <ShieldCheckIcon aria-hidden className="h-4 w-4" /> Medical Council licence checked
          </li>
          <li className="flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1.5 ring-1 ring-inset ring-white/25">
            <MicrophoneIcon aria-hidden className="h-4 w-4" /> Voice notes welcome
          </li>
          <li className="flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1.5 ring-1 ring-inset ring-white/25">
            <ChatBubbleLeftRightIcon aria-hidden className="h-4 w-4" /> Pay by MoMo or Orange Money
          </li>
        </ul>
      </header>

      <p className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-900 dark:border-red-900 dark:bg-red-950/30 dark:text-red-100">
        <strong>Emergency?</strong> Chest pain, trouble breathing, heavy bleeding, fits or someone who won&apos;t wake
        up need a hospital now. Don&apos;t wait for an online consultation.
      </p>

      {error && (
        <p role="alert" className="error-state">
          {error}
        </p>
      )}
      {doctors === null && !error && <p className="text-sm text-slate-500">Loading doctors…</p>}
      {doctors?.length === 0 && (
        <p className="empty-state">
          No doctors are taking online consultations yet. Find a{' '}
          <Link href="/clinics" className="font-semibold text-brand-700 underline">
            partner clinic
          </Link>{' '}
          near you.
        </p>
      )}
      <ul className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {doctors?.map((d) => (
          <li key={d.id} className="flex flex-col gap-4 rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-start justify-between gap-3">
              <DoctorChip doctor={d} />
              <span
                className={`flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold ${
                  d.availableNow
                    ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200'
                    : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'
                }`}
              >
                <span aria-hidden className={`h-2 w-2 rounded-full ${d.availableNow ? 'bg-emerald-500' : 'bg-slate-400'}`} />
                {d.availableNow ? 'Online now' : 'Replies later'}
              </span>
            </div>
            <p className="text-sm text-slate-600 dark:text-slate-300">
              {d.clinic.name} · {d.clinic.location}
            </p>
            <div className="mt-auto flex items-center justify-between gap-3">
              <span className="font-display text-xl font-bold text-slate-950 dark:text-slate-50">
                {formatMoney(d.fee, 'LRD')}
                <span className="ms-1 text-xs font-medium text-slate-500">per consultation</span>
              </span>
              <Link href={`/consult/${d.id}`} className="btn-primary min-h-11">
                Consult
              </Link>
            </div>
          </li>
        ))}
      </ul>
    </main>
  );
}
