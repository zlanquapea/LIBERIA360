'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ExclamationTriangleIcon, MapPinIcon } from '@heroicons/react/24/solid';
import { useAuth } from '@/hooks/useAuth';
import { BrandLoader } from '@/components/BrandLoader';
import { ChoiceCard, CopyButton } from '@/components/menu/CartSheet';
import { DoctorChip } from '@/components/prescriptions/DoctorChip';
import {
  getConsultDoctor,
  requestConsultation,
  type ConsultDoctor,
  type ConsultPaymentMethod,
} from '@/lib/consultations-api';
import { RED_FLAGS } from '@/lib/consultations';
import { formatMoney } from '@/lib/currency';

type Step = 'safety' | 'emergency' | 'details' | 'pay';

const METHOD_DOT: Record<ConsultPaymentMethod, string> = {
  mtn_momo: 'bg-yellow-400',
  orange_money: 'bg-orange-500',
};

/** Emergency check → what's wrong → pay → into the consultation. */
export function BookConsultation({ doctorId }: { doctorId: string }) {
  const { user, ready } = useAuth();
  const router = useRouter();
  const [doctor, setDoctor] = useState<ConsultDoctor | null>(null);
  const [loadError, setLoadError] = useState('');
  const [step, setStep] = useState<Step>('safety');
  const [flags, setFlags] = useState<string[]>([]);
  const [forSomeoneElse, setForSomeoneElse] = useState(false);
  const [patientName, setPatientName] = useState('');
  const [patientAge, setPatientAge] = useState('');
  const [reason, setReason] = useState('');
  const [since, setSince] = useState('');
  const [method, setMethod] = useState<ConsultPaymentMethod | null>(null);
  const [reference, setReference] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    getConsultDoctor(doctorId)
      .then((d) => {
        setDoctor(d);
        setMethod(d.paymentMethods[0]?.method ?? null);
      })
      .catch((e) => setLoadError(e instanceof Error ? e.message : 'This doctor is not available.'));
  }, [doctorId]);

  if (!ready || (!doctor && !loadError))
    return (
      <main className="flex min-h-[60vh] items-center justify-center">
        <BrandLoader />
      </main>
    );
  if (loadError || !doctor)
    return (
      <main className="mx-auto max-w-lg px-4 py-12">
        <p role="alert" className="error-state">
          {loadError}
        </p>
        <Link href="/consult" className="mt-4 inline-block font-semibold text-brand-700 underline">
          See other doctors
        </Link>
      </main>
    );
  if (!user)
    return (
      <main className="mx-auto flex max-w-sm flex-col gap-4 px-4 py-16 text-center">
        <h1 className="text-xl font-bold text-slate-900 dark:text-slate-50">Consult Dr {doctor.fullName}</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">Log in to start an online consultation.</p>
        <Link href={`/login?next=${encodeURIComponent(`/consult/${doctorId}`)}`} className="btn-primary mx-auto min-h-11 px-6">
          Log in
        </Link>
      </main>
    );

  const account = doctor.paymentMethods.find((m) => m.method === method);

  async function submit() {
    if (!method) return;
    if (reference.trim().length < 4) {
      setError('Enter the transaction ID from your confirmation SMS.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const c = await requestConsultation({
        doctorId,
        patientName: forSomeoneElse ? patientName.trim() || undefined : undefined,
        patientAge: patientAge ? Number(patientAge) : undefined,
        reason: reason.trim(),
        symptomsSince: since.trim() || undefined,
        redFlags: flags,
        noRedFlagsConfirmed: flags.length === 0,
        paymentMethod: method,
        paymentReference: reference.trim(),
      });
      router.push(`/account/consultations/${c.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not start the consultation.');
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-col gap-5 px-4 py-8">
      <section className="flex items-center justify-between gap-3 rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <DoctorChip doctor={doctor} />
        <span className="shrink-0 font-display text-lg font-bold text-slate-950 dark:text-slate-50">
          {formatMoney(doctor.fee, 'LRD')}
        </span>
      </section>

      {step === 'safety' && (
        <section className="flex flex-col gap-4 rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-red-700 dark:text-red-300">Step 1 · Safety check</p>
            <h1 className="mt-1 font-display text-2xl font-bold text-slate-950 dark:text-slate-50">
              Is any of this happening right now?
            </h1>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
              Tick anything that applies to the person who is sick.
            </p>
          </div>
          <ul className="flex flex-col gap-2">
            {RED_FLAGS.map((f) => {
              const on = flags.includes(f.key);
              return (
                <li key={f.key}>
                  <label
                    className={`flex cursor-pointer items-center gap-3 rounded-2xl border p-3 text-sm font-medium ${
                      on
                        ? 'border-red-400 bg-red-50 text-red-900 dark:border-red-700 dark:bg-red-950/40 dark:text-red-100'
                        : 'border-slate-200 text-slate-800 dark:border-slate-700 dark:text-slate-100'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={on}
                      onChange={(e) =>
                        setFlags((all) => (e.target.checked ? [...all, f.key] : all.filter((k) => k !== f.key)))
                      }
                      className="h-5 w-5 accent-red-600"
                    />
                    {f.label}
                  </label>
                </li>
              );
            })}
          </ul>
          {flags.length > 0 ? (
            <button type="button" onClick={() => setStep('emergency')} className="min-h-12 rounded-full bg-red-600 px-5 font-bold text-white hover:bg-red-700">
              Continue
            </button>
          ) : (
            <button type="button" onClick={() => setStep('details')} className="btn-primary min-h-12">
              None of these. Continue
            </button>
          )}
        </section>
      )}

      {step === 'emergency' && (
        <section role="alert" className="flex flex-col gap-4 rounded-[2rem] border-2 border-red-400 bg-red-50 p-6 text-red-950 dark:border-red-700 dark:bg-red-950/40 dark:text-red-50">
          <ExclamationTriangleIcon aria-hidden className="h-10 w-10 text-red-600" />
          <h1 className="font-display text-2xl font-extrabold">Get emergency care now</h1>
          <p>
            What you ticked needs to be seen in person straight away. An online consultation could lose valuable
            time. Go to the nearest hospital emergency room, or call your local emergency number.
          </p>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Link href="/near-me" className="flex min-h-12 items-center justify-center gap-2 rounded-full bg-red-600 px-5 font-bold text-white hover:bg-red-700">
              <MapPinIcon aria-hidden className="h-5 w-5" /> Find a hospital near me
            </Link>
            <button type="button" onClick={() => setStep('safety')} className="min-h-12 rounded-full px-5 font-semibold underline">
              I ticked something by mistake
            </button>
          </div>
        </section>
      )}

      {step === 'details' && (
        <section className="flex flex-col gap-4 rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-brand-700 dark:text-brand-300">Step 2 · What&apos;s wrong</p>
            <h1 className="mt-1 font-display text-2xl font-bold text-slate-950 dark:text-slate-50">Tell the doctor what&apos;s happening</h1>
          </div>
          <label className="flex items-center gap-3 text-sm font-medium text-slate-700 dark:text-slate-200">
            <input type="checkbox" checked={forSomeoneElse} onChange={(e) => setForSomeoneElse(e.target.checked)} className="h-5 w-5" />
            This is for someone else (a child or relative)
          </label>
          <div className="grid grid-cols-1 gap-3 min-[480px]:grid-cols-[1fr_7rem]">
            {forSomeoneElse && (
              <label className="text-sm font-medium text-slate-700 dark:text-slate-200">
                Their name
                <input value={patientName} onChange={(e) => setPatientName(e.target.value)} className="input mt-1 w-full" />
              </label>
            )}
            <label className={`text-sm font-medium text-slate-700 dark:text-slate-200 ${forSomeoneElse ? '' : 'min-[480px]:col-start-2'}`}>
              Age
              <input type="number" min={0} max={130} inputMode="numeric" value={patientAge} onChange={(e) => setPatientAge(e.target.value)} className="input mt-1 w-full" />
            </label>
          </div>
          <label className="text-sm font-medium text-slate-700 dark:text-slate-200">
            What&apos;s wrong?
            <textarea
              rows={4}
              maxLength={2000}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. Fever every night and body pain. I took paracetamol but it comes back."
              className="input mt-1 w-full"
            />
            <span className="mt-1 block text-xs font-normal text-slate-500">You can also send voice notes once the consultation starts.</span>
          </label>
          <label className="text-sm font-medium text-slate-700 dark:text-slate-200">
            Since when?
            <input value={since} onChange={(e) => setSince(e.target.value)} maxLength={60} placeholder="e.g. 3 days" className="input mt-1 w-full" />
          </label>
          {error && (
            <p role="alert" className="error-state">
              {error}
            </p>
          )}
          <button
            type="button"
            onClick={() => {
              if (reason.trim().length < 10) {
                setError('Tell the doctor a little more (at least a sentence).');
                return;
              }
              setError('');
              setStep('pay');
            }}
            className="btn-primary min-h-12"
          >
            Continue to payment
          </button>
        </section>
      )}

      {step === 'pay' && (
        <section className="flex flex-col gap-4 rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-brand-700 dark:text-brand-300">Step 3 · Pay</p>
            <h1 className="mt-1 font-display text-2xl font-bold text-slate-950 dark:text-slate-50">
              Pay {formatMoney(doctor.fee, 'LRD')} to {doctor.clinic.name}
            </h1>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
              The doctor starts the consultation as soon as the payment arrives. If they can&apos;t take it, you get
              your money back.
            </p>
          </div>
          <fieldset className="flex flex-col gap-2">
            <legend className="sr-only">Payment method</legend>
            {doctor.paymentMethods.map((m) => (
              <ChoiceCard
                key={m.method}
                name="consult-payment"
                checked={method === m.method}
                onSelect={() => setMethod(m.method)}
                icon={<span className={`block h-4 w-4 rounded-full ${METHOD_DOT[m.method]}`} />}
                title={m.label}
                detail="Mobile money"
              />
            ))}
          </fieldset>
          {account?.account && (
            <div className="flex flex-col gap-3 rounded-3xl bg-slate-50 p-4 dark:bg-slate-800/60">
              <p className="text-sm text-slate-700 dark:text-slate-200">
                1. Send <strong>{formatMoney(doctor.fee, 'LRD')}</strong> by {account.label} to
              </p>
              <div className="flex items-center justify-between gap-3 rounded-2xl bg-white px-4 py-3 dark:bg-slate-900">
                <span className="font-mono text-lg font-bold tabular-nums">{account.account}</span>
                <CopyButton value={account.account.replace(/\s/g, '')} label="number" />
              </div>
              <label className="flex flex-col gap-1 text-sm text-slate-700 dark:text-slate-200">
                2. Enter the transaction ID from your confirmation SMS
                <input
                  value={reference}
                  onChange={(e) => setReference(e.target.value)}
                  maxLength={80}
                  placeholder="e.g. MP240115.1234.A56789"
                  className="w-full rounded-2xl border border-slate-300 bg-white p-3 font-mono text-sm outline-none focus:border-brand-600 dark:border-slate-700 dark:bg-slate-900"
                />
              </label>
            </div>
          )}
          {error && (
            <p role="alert" className="error-state">
              {error}
            </p>
          )}
          <div className="flex flex-col gap-2 sm:flex-row-reverse">
            <button type="button" onClick={() => void submit()} disabled={busy || !method} className="btn-primary min-h-12 flex-1">
              {busy ? 'Starting…' : 'Start consultation'}
            </button>
            <button type="button" onClick={() => setStep('details')} className="btn-secondary min-h-12">
              Back
            </button>
          </div>
        </section>
      )}
    </main>
  );
}
