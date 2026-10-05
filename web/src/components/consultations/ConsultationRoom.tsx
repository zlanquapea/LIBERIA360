'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { ArrowLeftIcon, DocumentPlusIcon } from '@heroicons/react/24/outline';
import { BrandLoader } from '@/components/BrandLoader';
import { PrescriptionWriter } from '@/components/prescriptions/PrescriptionWriter';
import { getMyClinic, type MyClinic } from '@/lib/clinic-api';
import { getConsultation, type Consultation } from '@/lib/consultations-api';
import { ConsultationChat } from './ConsultationChat';
import {
  CompleteConsultationForm,
  ConsultHeader,
  ConsultOutcome,
  DoctorPaymentPanel,
  PatientPaymentPanel,
} from './ConsultationParts';

/** One consultation, seen by the patient or by the doctor. */
export function ConsultationRoom({ id, as }: { id: string; as: 'patient' | 'doctor' }) {
  const [c, setC] = useState<Consultation | null>(null);
  const [error, setError] = useState('');
  const [clinic, setClinic] = useState<MyClinic | null>(null);
  const [writing, setWriting] = useState(false);

  const load = useCallback(
    () =>
      getConsultation(id)
        .then(setC)
        .catch((e) => setError(e instanceof Error ? e.message : 'Could not load this consultation.')),
    [id],
  );

  useEffect(() => {
    void load();
  }, [load]);

  // Pick up the doctor starting it (or the patient resending payment) without a refresh.
  const status = c ? `${c.status}:${c.paymentStatus}` : '';
  useEffect(() => {
    if (!status || !['requested', 'active'].some((s) => status.startsWith(s))) return;
    const t = setInterval(() => void load(), 20000);
    return () => clearInterval(t);
  }, [status, load]);

  const clinicId = as === 'doctor' ? c?.clinic?.id : undefined;
  useEffect(() => {
    if (!clinicId) return;
    getMyClinic(clinicId).then(setClinic).catch(() => setClinic(null));
  }, [clinicId]);

  const back =
    as === 'doctor'
      ? { href: '/account/clinic-dashboard/consultations', label: 'Consultations' }
      : { href: '/account/consultations', label: 'My consultations' };

  if (error)
    return (
      <main className="mx-auto flex max-w-3xl flex-col gap-4 px-4 py-8">
        <p role="alert" className="error-state">
          {error}
        </p>
        <Link href={back.href} className="btn-secondary min-h-11 self-start">
          {back.label}
        </Link>
      </main>
    );
  if (!c)
    return (
      <main className="flex min-h-[60vh] items-center justify-center">
        <BrandLoader />
      </main>
    );

  const open = c.status === 'requested' || c.status === 'active';
  const doctorView = c.viewerRole === 'doctor';
  const otherName = doctorView ? c.patientName : c.doctor ? `Dr ${c.doctor.fullName}` : 'the doctor';
  const canPrescribe = doctorView && c.status === 'active' && !c.ePrescriptionId && clinic?.canPrescribe;

  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-5 px-4 py-8">
      <Link href={back.href} className="flex items-center gap-1 self-start text-sm font-semibold text-brand-700 dark:text-brand-300">
        <ArrowLeftIcon aria-hidden className="h-4 w-4" /> {back.label}
      </Link>
      <ConsultHeader c={c} />
      {doctorView ? <DoctorPaymentPanel c={c} onChanged={setC} /> : <PatientPaymentPanel c={c} onChanged={setC} />}
      <ConsultOutcome c={c} />

      {(open || c.status === 'completed') && (
        <div className="flex flex-col gap-2">
          <h2 className="text-lg font-bold text-slate-950 dark:text-slate-50">Conversation</h2>
          <ConsultationChat
            consultationId={c.id}
            open={open}
            otherName={otherName}
            emptyHint={
              !open
                ? 'No messages in this consultation.'
                : doctorView
                ? 'Ask the patient about their symptoms. You can type or send a voice note.'
                : `Tell ${otherName} more: when it started, what you've taken, anything that makes it better or worse. Type or send a voice note.`
            }
          />
        </div>
      )}

      {doctorView && c.status === 'active' && (
        <div className="flex flex-col gap-4">
          {c.ePrescriptionCode && (
            <p className="rounded-2xl bg-emerald-50 p-3 text-sm text-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-100">
              Prescription <span className="font-mono font-semibold">{c.ePrescriptionCode}</span> is in the
              patient&apos;s app.
            </p>
          )}
          {canPrescribe &&
            (writing ? (
              <section className="rounded-[2rem] border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
                <h2 className="mb-4 font-bold text-slate-950 dark:text-slate-50">Prescription for {c.patientName}</h2>
                <PrescriptionWriter
                  clinic={clinic!}
                  consultation={{ id: c.id, patientName: c.patientName, patientAge: c.patientAge }}
                  onIssued={() => {
                    setWriting(false);
                    void load();
                  }}
                />
              </section>
            ) : (
              <button type="button" onClick={() => setWriting(true)} className="btn-secondary min-h-11 gap-1.5 self-start">
                <DocumentPlusIcon aria-hidden className="h-5 w-5" /> Write prescription
              </button>
            ))}
          <CompleteConsultationForm c={c} onChanged={setC} />
        </div>
      )}
    </main>
  );
}
