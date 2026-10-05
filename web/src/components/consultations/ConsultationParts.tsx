'use client';

import Link from 'next/link';
import { useState } from 'react';
import {
  ChatBubbleLeftRightIcon,
  ClipboardDocumentCheckIcon,
  ExclamationTriangleIcon,
} from '@heroicons/react/24/outline';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { OrderStepper } from '@/components/orders/OrderStepper';
import { DoctorChip } from '@/components/prescriptions/DoctorChip';
import { CopyButton } from '@/components/menu/CartSheet';
import { formatMoney } from '@/lib/currency';
import {
  cancelConsultation,
  completeConsultation,
  declineConsultation,
  markConsultationRefunded,
  resendConsultationPayment,
  verifyConsultationPayment,
  type Consultation,
  type ConsultationOutcome,
} from '@/lib/consultations-api';
import {
  CONSULT_PAYMENT_BADGES,
  CONSULT_PAYMENT_LABELS,
  CONSULT_STATUS_LABELS,
  OUTCOME_LABELS,
  consultStatusClass,
  consultSteps,
} from '@/lib/consultations';

type Changed = (c: Consultation) => void;

const when = (iso: string) =>
  new Date(iso).toLocaleString(undefined, { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });

const errorText = (e: unknown, fallback: string) => (e instanceof Error ? e.message : fallback);

function Note({ tone = 'slate', children }: { tone?: 'slate' | 'amber' | 'emerald' | 'red'; children: React.ReactNode }) {
  const styles = {
    slate: 'bg-slate-50 text-slate-700 dark:bg-slate-800/60 dark:text-slate-200',
    amber: 'bg-amber-50 text-amber-900 dark:bg-amber-950/40 dark:text-amber-100',
    emerald: 'bg-emerald-50 text-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-100',
    red: 'bg-red-50 text-red-900 dark:bg-red-950/40 dark:text-red-100',
  };
  return <div className={`rounded-2xl p-3 text-sm ${styles[tone]}`}>{children}</div>;
}

export function ConsultBadges({ c }: { c: Consultation }) {
  const pay = CONSULT_PAYMENT_BADGES[c.paymentStatus];
  // The doctor is the one doing the checking, so say it from their side.
  const asDoctor = c.viewerRole === 'doctor';
  const status = asDoctor && c.status === 'requested' ? 'New request' : CONSULT_STATUS_LABELS[c.status];
  const payment = asDoctor && c.paymentStatus === 'awaiting_verification' ? 'Check payment' : pay.label;
  return (
    <span className="flex flex-wrap gap-1.5">
      <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${consultStatusClass(c.status)}`}>
        {status}
      </span>
      {c.paymentStatus !== 'paid' && (
        <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${pay.style}`}>{payment}</span>
      )}
    </span>
  );
}

/** Who it's with, what it's about, and how far along it is. */
export function ConsultHeader({ c }: { c: Consultation }) {
  const asDoctor = c.viewerRole === 'doctor';
  return (
    <section className="flex flex-col gap-4 rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="flex flex-wrap items-start justify-between gap-3">
        {asDoctor ? (
          <div className="min-w-0">
            <p className="text-xs font-bold uppercase tracking-wide text-slate-400">Patient</p>
            <p className="font-display text-xl font-bold text-slate-950 dark:text-slate-50">
              {c.patientName}
              {c.patientAge != null && <span className="font-normal text-slate-500"> · {c.patientAge} yrs</span>}
            </p>
          </div>
        ) : (
          c.doctor && <DoctorChip doctor={c.doctor} />
        )}
        <ConsultBadges c={c} />
      </div>
      {!['declined', 'cancelled'].includes(c.status) && <OrderStepper steps={consultSteps(c)} />}
      <dl className="grid gap-3 text-sm sm:grid-cols-3">
        <div className="sm:col-span-3">
          <dt className="text-xs font-semibold text-slate-500 dark:text-slate-400">What&apos;s wrong</dt>
          <dd className="whitespace-pre-line text-slate-900 dark:text-slate-100">{c.reason}</dd>
        </div>
        {c.symptomsSince && (
          <div>
            <dt className="text-xs font-semibold text-slate-500 dark:text-slate-400">Since</dt>
            <dd className="text-slate-900 dark:text-slate-100">{c.symptomsSince}</dd>
          </div>
        )}
        <div>
          <dt className="text-xs font-semibold text-slate-500 dark:text-slate-400">Fee</dt>
          <dd className="text-slate-900 dark:text-slate-100">
            {formatMoney(c.fee, 'LRD')} · {CONSULT_PAYMENT_LABELS[c.paymentMethod]}
          </dd>
        </div>
        <div>
          <dt className="text-xs font-semibold text-slate-500 dark:text-slate-400">Booked</dt>
          <dd className="text-slate-900 dark:text-slate-100">{when(c.createdAt)}</dd>
        </div>
        {!asDoctor && c.clinic && (
          <div>
            <dt className="text-xs font-semibold text-slate-500 dark:text-slate-400">Clinic</dt>
            <dd className="text-slate-900 dark:text-slate-100">
              <Link href={`/clinics/${c.clinic.slug}`} className="underline">
                {c.clinic.name}
              </Link>
            </dd>
          </div>
        )}
      </dl>
    </section>
  );
}

/** What the patient needs to know about their payment, and what they can do. */
export function PatientPaymentPanel({ c, onChanged }: { c: Consultation; onChanged: Changed }) {
  const [reference, setReference] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [confirming, setConfirming] = useState(false);
  const doctor = c.doctor ? `Dr ${c.doctor.fullName}` : 'The doctor';

  async function resend(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      onChanged(await resendConsultationPayment(c.id, reference.trim()));
      setReference('');
    } catch (err) {
      setError(errorText(err, 'Could not send it.'));
    } finally {
      setBusy(false);
    }
  }

  async function cancel() {
    setBusy(true);
    setError('');
    try {
      onChanged(await cancelConsultation(c.id));
      setConfirming(false);
    } catch (err) {
      setError(errorText(err, 'Could not cancel.'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      {c.status === 'requested' && c.paymentStatus === 'awaiting_verification' && (
        <Note tone="amber">
          {doctor} is checking your {CONSULT_PAYMENT_LABELS[c.paymentMethod]} payment (transaction{' '}
          <span className="font-mono font-semibold">{c.paymentReference}</span>). You&apos;ll get a notification the
          moment the consultation starts. You can write your first message below now.
        </Note>
      )}
      {c.status === 'requested' && c.paymentStatus === 'failed' && (
        <form onSubmit={resend} className="flex flex-col gap-3 rounded-2xl bg-red-50 p-4 dark:bg-red-950/40">
          <p className="text-sm text-red-900 dark:text-red-100">
            The clinic couldn&apos;t find transaction <span className="font-mono">{c.paymentReference}</span>. Check the
            SMS from {CONSULT_PAYMENT_LABELS[c.paymentMethod]} and send the right transaction ID.
          </p>
          {c.paymentAccount && (
            <p className="flex items-center gap-2 text-sm text-red-900 dark:text-red-100">
              Paid to <span className="font-mono font-semibold">{c.paymentAccount}</span>
              <CopyButton value={c.paymentAccount.replace(/\s/g, '')} label="number" />
            </p>
          )}
          <label className="text-sm font-semibold text-slate-700 dark:text-slate-200">
            Transaction ID
            <input
              required
              minLength={4}
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              className="input mt-1 w-full font-mono"
            />
          </label>
          <button disabled={busy || reference.trim().length < 4} className="btn-primary min-h-11 self-start">
            {busy ? 'Sending…' : 'Send transaction ID'}
          </button>
        </form>
      )}
      {c.paymentStatus === 'refund_due' && (
        <Note tone="amber">
          {c.clinic?.name ?? 'The clinic'} owes you a refund of {formatMoney(c.fee, 'LRD')} to the number you paid
          from. If it hasn&apos;t arrived in a day, call them on {c.clinic?.telephone}.
        </Note>
      )}
      {c.paymentStatus === 'refunded' && <Note tone="emerald">Your {formatMoney(c.fee, 'LRD')} has been refunded.</Note>}
      {error && (
        <p role="alert" className="error-state">
          {error}
        </p>
      )}
      {c.status === 'requested' && (
        <button type="button" onClick={() => setConfirming(true)} className="self-start text-sm font-semibold text-red-700 underline dark:text-red-300">
          Cancel consultation
        </button>
      )}
      <ConfirmDialog
        open={confirming}
        title="Cancel this consultation?"
        description={
          c.paymentStatus === 'failed'
            ? `${doctor} will be told you've cancelled.`
            : `${doctor} will be told, and the clinic will refund your ${formatMoney(c.fee, 'LRD')}.`
        }
        confirmLabel="Cancel consultation"
        cancelLabel="Keep it"
        loadingLabel="Cancelling…"
        isLoading={busy}
        error={error || null}
        onConfirm={() => void cancel()}
        onCancel={() => setConfirming(false)}
      />
    </div>
  );
}

/** The doctor checks the mobile money, then starts or declines. */
export function DoctorPaymentPanel({ c, onChanged }: { c: Consultation; onChanged: Changed }) {
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [declining, setDeclining] = useState(false);
  const [reason, setReason] = useState('');

  async function run(key: string, action: () => Promise<Consultation>) {
    setBusy(key);
    setError('');
    try {
      onChanged(await action());
      setDeclining(false);
    } catch (err) {
      setError(errorText(err, 'Something went wrong.'));
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      {c.status === 'requested' && c.paymentStatus === 'awaiting_verification' && (
        <div className="flex flex-col gap-3 rounded-2xl bg-amber-50 p-4 dark:bg-amber-950/40">
          <p className="text-sm text-amber-900 dark:text-amber-100">
            Check {c.paymentAccount ? <span className="font-mono font-semibold">{c.paymentAccount}</span> : 'the clinic account'}{' '}
            on {CONSULT_PAYMENT_LABELS[c.paymentMethod]} for{' '}
            <span className="font-semibold">{formatMoney(c.fee, 'LRD')}</span>, transaction{' '}
            <span className="font-mono font-semibold">{c.paymentReference}</span>.
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={busy !== null}
              onClick={() => void run('paid', () => verifyConsultationPayment(c.id, true))}
              className="btn-primary min-h-11"
            >
              {busy === 'paid' ? 'Starting…' : 'Payment received, start'}
            </button>
            <button
              type="button"
              disabled={busy !== null}
              onClick={() => void run('missing', () => verifyConsultationPayment(c.id, false))}
              className="btn-secondary min-h-11"
            >
              Not found
            </button>
          </div>
        </div>
      )}
      {c.status === 'requested' && c.paymentStatus === 'failed' && (
        <Note tone="slate">Waiting for the patient to send the right transaction ID.</Note>
      )}
      {c.paymentStatus === 'refund_due' && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-orange-50 p-4 dark:bg-orange-950/40">
          <p className="text-sm text-orange-900 dark:text-orange-100">
            Refund {formatMoney(c.fee, 'LRD')} by {CONSULT_PAYMENT_LABELS[c.paymentMethod]} (transaction{' '}
            <span className="font-mono">{c.paymentReference}</span>).
          </p>
          <button
            type="button"
            disabled={busy !== null}
            onClick={() => void run('refunded', () => markConsultationRefunded(c.id))}
            className="btn-secondary min-h-10"
          >
            {busy === 'refunded' ? 'Saving…' : 'Mark refunded'}
          </button>
        </div>
      )}
      {c.status === 'requested' &&
        (declining ? (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void run('decline', () => declineConsultation(c.id, reason.trim()));
            }}
            className="flex flex-col gap-2 rounded-2xl border border-slate-200 p-4 dark:border-slate-800"
          >
            <label className="text-sm font-semibold text-slate-700 dark:text-slate-200">
              Why can&apos;t you take it? The patient sees this.
              <textarea
                required
                minLength={5}
                rows={2}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="e.g. This needs an examination. Please visit the clinic or the nearest hospital."
                className="input mt-1 w-full"
              />
            </label>
            <div className="flex flex-wrap gap-2">
              <button disabled={busy !== null || reason.trim().length < 5} className="btn-primary min-h-10">
                {busy === 'decline' ? 'Declining…' : 'Decline'}
              </button>
              <button type="button" onClick={() => setDeclining(false)} className="btn-secondary min-h-10">
                Back
              </button>
            </div>
          </form>
        ) : (
          <button type="button" onClick={() => setDeclining(true)} className="self-start text-sm font-semibold text-red-700 underline dark:text-red-300">
            Decline this consultation
          </button>
        ))}
      {error && (
        <p role="alert" className="error-state">
          {error}
        </p>
      )}
    </div>
  );
}

const OUTCOMES: ConsultationOutcome[] = ['advice', 'prescription', 'visit_clinic', 'emergency'];

/** The doctor's closing note. */
export function CompleteConsultationForm({ c, onChanged }: { c: Consultation; onChanged: Changed }) {
  const [open, setOpen] = useState(false);
  const [outcome, setOutcome] = useState<ConsultationOutcome>(c.ePrescriptionId ? 'prescription' : 'advice');
  const [summary, setSummary] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      onChanged(await completeConsultation(c.id, outcome, summary.trim()));
    } catch (err) {
      setError(errorText(err, 'Could not close the consultation.'));
    } finally {
      setBusy(false);
    }
  }

  if (!open)
    return (
      <button type="button" onClick={() => setOpen(true)} className="btn-secondary min-h-11 gap-1.5">
        <ClipboardDocumentCheckIcon aria-hidden className="h-5 w-5" /> Finish consultation
      </button>
    );
  return (
    <form onSubmit={submit} className="flex flex-col gap-3 rounded-[2rem] border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
      <h2 className="font-bold text-slate-950 dark:text-slate-50">Finish consultation</h2>
      <fieldset className="grid gap-2 sm:grid-cols-2">
        <legend className="mb-1 text-sm font-semibold text-slate-700 dark:text-slate-200">Outcome</legend>
        {OUTCOMES.map((o) => (
          <label
            key={o}
            className={`flex min-h-11 cursor-pointer items-center gap-2 rounded-xl border px-3 text-sm ${
              outcome === o
                ? 'border-brand-600 bg-brand-50 font-semibold text-brand-900 dark:bg-brand-950/40 dark:text-brand-100'
                : 'border-slate-200 text-slate-700 dark:border-slate-700 dark:text-slate-200'
            }`}
          >
            <input type="radio" name="outcome" value={o} checked={outcome === o} onChange={() => setOutcome(o)} className="accent-brand-600" />
            {OUTCOME_LABELS[o]}
          </label>
        ))}
      </fieldset>
      {outcome === 'prescription' && !c.ePrescriptionId && (
        <p className="text-sm text-amber-800 dark:text-amber-200">Write the prescription first, so the patient gets it.</p>
      )}
      <label className="text-sm font-semibold text-slate-700 dark:text-slate-200">
        Advice for the patient
        <textarea
          required
          minLength={10}
          rows={4}
          maxLength={4000}
          value={summary}
          onChange={(e) => setSummary(e.target.value)}
          placeholder="What you think it is, what to do, and when to come in."
          className="input mt-1 w-full"
        />
      </label>
      {error && (
        <p role="alert" className="error-state">
          {error}
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        <button
          disabled={busy || summary.trim().length < 10 || (outcome === 'prescription' && !c.ePrescriptionId)}
          className="btn-primary min-h-11"
        >
          {busy ? 'Saving…' : 'Send and close'}
        </button>
        <button type="button" onClick={() => setOpen(false)} className="btn-secondary min-h-11">
          Not yet
        </button>
      </div>
    </form>
  );
}

/** The doctor's advice once it's over, or why it didn't happen. */
export function ConsultOutcome({ c }: { c: Consultation }) {
  if (c.status === 'declined')
    return (
      <Note tone="red">
        <p className="font-semibold">{c.viewerRole === 'doctor' ? 'You declined this consultation.' : 'The doctor couldn’t take this consultation.'}</p>
        {c.declineReason && <p className="mt-1 whitespace-pre-line">{c.declineReason}</p>}
      </Note>
    );
  if (c.status === 'cancelled') return <Note>This consultation was cancelled.</Note>;
  if (c.status !== 'completed' || !c.outcome) return null;
  const emergency = c.outcome === 'emergency';
  return (
    <section
      className={`flex flex-col gap-3 rounded-[2rem] p-5 ${
        emergency ? 'bg-red-50 dark:bg-red-950/40' : 'bg-emerald-50 dark:bg-emerald-950/40'
      }`}
    >
      <p className={`flex items-center gap-2 font-bold ${emergency ? 'text-red-900 dark:text-red-100' : 'text-emerald-900 dark:text-emerald-100'}`}>
        {emergency ? (
          <ExclamationTriangleIcon aria-hidden className="h-5 w-5" />
        ) : (
          <ClipboardDocumentCheckIcon aria-hidden className="h-5 w-5" />
        )}
        {OUTCOME_LABELS[c.outcome]}
      </p>
      {c.summary && <p className="whitespace-pre-line text-sm text-slate-800 dark:text-slate-100">{c.summary}</p>}
      {c.ePrescriptionCode && (
        <p className="flex flex-wrap items-center gap-2 text-sm text-slate-800 dark:text-slate-100">
          Prescription <span className="font-mono font-semibold">{c.ePrescriptionCode}</span>
          {c.viewerRole === 'patient' && (
            <Link href="/account/prescriptions" className="btn-primary min-h-10">
              Get your medicine
            </Link>
          )}
        </p>
      )}
      {emergency && c.viewerRole === 'patient' && (
        <Link href="/near-me" className="btn-primary min-h-11 self-start bg-red-600 hover:bg-red-700">
          Find the nearest hospital
        </Link>
      )}
      {c.completedAt && <p className="text-xs text-slate-500 dark:text-slate-400">Closed {when(c.completedAt)}</p>}
    </section>
  );
}

/** One row in "My consultations" or the doctor's inbox. */
export function ConsultListCard({ c, href }: { c: Consultation; href: string }) {
  const asDoctor = c.viewerRole === 'doctor';
  return (
    <Link
      href={href}
      className="flex flex-col gap-3 rounded-[2rem] border border-slate-200 bg-white p-4 shadow-sm transition hover:border-brand-300 hover:shadow-md dark:border-slate-800 dark:bg-slate-900"
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        {asDoctor ? (
          <span className="min-w-0">
            <span className="block font-semibold text-slate-950 dark:text-slate-50">
              {c.patientName}
              {c.patientAge != null && <span className="font-normal text-slate-500"> · {c.patientAge} yrs</span>}
            </span>
            <span className="block text-xs text-slate-500 dark:text-slate-400">{when(c.createdAt)}</span>
          </span>
        ) : (
          c.doctor && <DoctorChip doctor={c.doctor} />
        )}
        <ConsultBadges c={c} />
      </div>
      <p className="line-clamp-2 text-sm text-slate-700 dark:text-slate-300">{c.reason}</p>
      <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
        <span>
          {formatMoney(c.fee, 'LRD')}
          {!asDoctor && ` · ${when(c.createdAt)}`}
        </span>
        {c.unreadMessages > 0 && (
          <span className="flex items-center gap-1 rounded-full bg-brand-600 px-2 py-0.5 font-semibold text-white">
            <ChatBubbleLeftRightIcon aria-hidden className="h-3.5 w-3.5" />
            {c.unreadMessages} new
          </span>
        )}
      </div>
    </Link>
  );
}
