'use client';

import { useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { ExclamationTriangleIcon } from '@heroicons/react/24/outline';
import { usePharmacyDashboard } from '@/components/PharmacyDashboardContext';
import { EPrescriptionCard } from '@/components/prescriptions/EPrescriptionCard';
import { RxScanner, codeFromScan } from '@/components/prescriptions/RxScanner';
import {
  dispensePrescription,
  getPrescriptionQueue,
  lookupCounterPrescription,
  returnPrescription,
  setCounterStatus,
  type EPrescription,
} from '@/lib/clinic-api';

function CounterActions({
  rx,
  pharmacyId,
  isPharmacist,
  onChanged,
}: {
  rx: EPrescription;
  pharmacyId: string;
  isPharmacist: boolean;
  onChanged: (rx: EPrescription) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const here = rx.pharmacy?.id === pharmacyId;

  async function run(action: () => Promise<EPrescription>) {
    setBusy(true);
    setError('');
    try {
      onChanged(await action());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not update the prescription.');
    } finally {
      setBusy(false);
    }
  }

  if (rx.problem)
    return (
      <p className="flex w-full items-start gap-2 rounded-2xl bg-amber-50 p-3 text-sm font-semibold text-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
        <ExclamationTriangleIcon aria-hidden className="mt-0.5 h-5 w-5 shrink-0" />
        {rx.problem}. Don&apos;t dispense it.
      </p>
    );
  if (rx.status === 'dispensed') return null;

  return (
    <div className="flex w-full flex-col gap-2">
      <div className="flex flex-wrap gap-2">
        {here && rx.status === 'sent' && (
          <button disabled={busy} onClick={() => void run(() => setCounterStatus(pharmacyId, rx.id, 'preparing'))} className="btn-secondary min-h-10">
            Start preparing
          </button>
        )}
        {here && (rx.status === 'sent' || rx.status === 'preparing') && (
          <button disabled={busy} onClick={() => void run(() => setCounterStatus(pharmacyId, rx.id, 'ready'))} className="btn-secondary min-h-10">
            Ready for collection
          </button>
        )}
        <button
          disabled={busy || !isPharmacist}
          onClick={() => {
            if (window.confirm(`Hand over and dispense ${rx.code}? It can't be used again.`))
              void run(() => dispensePrescription(pharmacyId, rx.id));
          }}
          className="btn-primary min-h-10"
        >
          Dispense &amp; hand over
        </button>
        {here && (
          <button
            disabled={busy}
            onClick={() => {
              const reason = window.prompt("Tell the patient why you can't fill it (e.g. out of stock):");
              if (reason !== null) void run(() => returnPrescription(pharmacyId, rx.id, reason));
            }}
            className="btn-secondary min-h-10 text-red-700"
          >
            Can&apos;t fill it
          </button>
        )}
      </div>
      {!isPharmacist && (
        <p className="text-xs text-slate-500 dark:text-slate-400">Only a pharmacist on staff can dispense.</p>
      )}
      {error && (
        <p role="alert" className="error-state">
          {error}
        </p>
      )}
    </div>
  );
}

export default function PharmacyPrescriptionsPage() {
  const { pharmacy, stats } = usePharmacyDashboard();
  const isPharmacist = stats?.role === 'pharmacist';
  const searchParams = useSearchParams();
  const [code, setCode] = useState(searchParams.get('code') ?? '');
  const [found, setFound] = useState<EPrescription | null>(null);
  const [lookupError, setLookupError] = useState('');
  const [queue, setQueue] = useState<EPrescription[] | null>(null);
  const [error, setError] = useState('');

  const loadQueue = useCallback(() => {
    getPrescriptionQueue(pharmacy.id)
      .then(setQueue)
      .catch((e) => setError(e instanceof Error ? e.message : 'Could not load prescriptions.'));
  }, [pharmacy.id]);
  useEffect(loadQueue, [loadQueue]);

  const lookup = useCallback(
    async (raw: string) => {
      const clean = codeFromScan(raw);
      if (clean.length < 6) return;
      setLookupError('');
      setFound(null);
      try {
        setFound(await lookupCounterPrescription(pharmacy.id, clean));
      } catch (e) {
        setLookupError(e instanceof Error ? e.message : 'No prescription with that code.');
      }
    },
    [pharmacy.id],
  );

  useEffect(() => {
    const initial = searchParams.get('code');
    if (initial) void lookup(initial);
  }, [searchParams, lookup]);

  function changed(rx: EPrescription) {
    setFound((f) => (f?.id === rx.id ? rx : f));
    loadQueue();
  }

  const waiting = queue?.filter((rx) => rx.status !== 'dispensed') ?? [];
  const done = queue?.filter((rx) => rx.status === 'dispensed') ?? [];

  return (
    <div className="flex flex-col gap-5">
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <h2 className="text-xl font-bold text-slate-950 dark:text-slate-50">Check a prescription</h2>
        <p className="mb-3 text-sm text-slate-500 dark:text-slate-400">
          Scan the patient&apos;s QR code or type the 8-character code. Each prescription can be dispensed
          once, by any pharmacy.
        </p>
        <div className="flex flex-col gap-3">
          <RxScanner
            onCode={(c) => {
              setCode(c);
              void lookup(c);
            }}
          />
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void lookup(code);
            }}
            className="flex flex-col gap-2 sm:flex-row"
          >
            <label className="sr-only" htmlFor="rx-code">
              Prescription code
            </label>
            <input
              id="rx-code"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="e.g. 4W8Q-EVV5"
              autoCapitalize="characters"
              className="input min-w-0 flex-1 font-mono tracking-widest"
            />
            <button className="btn-secondary min-h-11">Look up</button>
          </form>
          {lookupError && (
            <p role="alert" className="error-state">
              {lookupError}
            </p>
          )}
          {found && (
            <EPrescriptionCard rx={found} showQr={false}>
              <CounterActions rx={found} pharmacyId={pharmacy.id} isPharmacist={isPharmacist} onChanged={changed} />
            </EPrescriptionCard>
          )}
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <h2 className="text-xl font-bold text-slate-950 dark:text-slate-50">Sent to you</h2>
        <p className="mb-3 text-sm text-slate-500 dark:text-slate-400">
          Prescriptions doctors and patients sent here. Pack them now so they&apos;re ready when the patient arrives.
        </p>
        {error && (
          <p role="alert" className="error-state">
            {error}
          </p>
        )}
        {queue === null && !error && <p className="text-sm text-slate-500">Loading…</p>}
        {queue !== null && waiting.length === 0 && <p className="empty-state">Nothing waiting.</p>}
        <div className="flex flex-col gap-4">
          {waiting.map((rx) => (
            <EPrescriptionCard key={rx.id} rx={rx} showQr={false}>
              <CounterActions rx={rx} pharmacyId={pharmacy.id} isPharmacist={isPharmacist} onChanged={changed} />
            </EPrescriptionCard>
          ))}
        </div>
        {done.length > 0 && (
          <details className="mt-4">
            <summary className="cursor-pointer text-sm font-semibold text-slate-600 dark:text-slate-300">
              Dispensed this week ({done.length})
            </summary>
            <ul className="mt-2 divide-y divide-slate-100 text-sm dark:divide-slate-800">
              {done.map((rx) => (
                <li key={rx.id} className="flex flex-wrap justify-between gap-2 py-2">
                  <span className="font-semibold text-slate-800 dark:text-slate-200">{rx.patientName}</span>
                  <span className="text-slate-500">
                    <span className="font-mono">{rx.code}</span> ·{' '}
                    {rx.dispensedAt && new Date(rx.dispensedAt).toLocaleString()}
                  </span>
                </li>
              ))}
            </ul>
          </details>
        )}
      </section>
    </div>
  );
}
