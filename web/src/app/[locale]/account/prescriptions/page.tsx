'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { BuildingStorefrontIcon, ShoppingBagIcon } from '@heroicons/react/24/outline';
import { SignedInGate } from '@/components/prescriptions/SignedInGate';
import { EPrescriptionCard } from '@/components/prescriptions/EPrescriptionCard';
import { RxTracker } from '@/components/prescriptions/RxTracker';
import {
  getMyPrescriptions,
  getPharmacyOptions,
  sendPrescription,
  type EPrescription,
} from '@/lib/clinic-api';
import { canChoosePharmacy } from '@/lib/prescriptions';

type PharmacyOption = { id: string; name: string; slug: string; location: string };

function FillOptions({
  rx,
  pharmacies,
  onChanged,
}: {
  rx: EPrescription;
  pharmacies: PharmacyOption[];
  onChanged: (rx: EPrescription) => void;
}) {
  const [pharmacyId, setPharmacyId] = useState(rx.pharmacy?.id ?? pharmacies[0]?.id ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const chosen = pharmacies.find((p) => p.id === pharmacyId);

  async function send() {
    if (!pharmacyId) return;
    setBusy(true);
    setError('');
    try {
      onChanged(await sendPrescription(rx.id, pharmacyId));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not send it.');
    } finally {
      setBusy(false);
    }
  }

  if (!pharmacies.length) return null;
  return (
    <div className="flex w-full flex-col gap-3">
      <label className="text-sm font-semibold text-slate-700 dark:text-slate-200">
        Fill it at
        <select value={pharmacyId} onChange={(e) => setPharmacyId(e.target.value)} className="input mt-1 w-full">
          {pharmacies.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name} · {p.location}
            </option>
          ))}
        </select>
      </label>
      <div className="grid gap-2 sm:grid-cols-2">
        <Link
          href={chosen ? `/pharmacies/${chosen.slug}?rx=${rx.id}` : '#'}
          aria-disabled={!chosen}
          className="btn-primary min-h-11 gap-1.5"
        >
          <ShoppingBagIcon aria-hidden className="h-5 w-5" /> Order for pickup or delivery
        </Link>
        <button
          type="button"
          disabled={busy || !pharmacyId || (rx.status === 'sent' && rx.pharmacy?.id === pharmacyId)}
          onClick={() => void send()}
          className="btn-secondary min-h-11 gap-1.5"
        >
          <BuildingStorefrontIcon aria-hidden className="h-5 w-5" />
          {rx.status === 'sent' && rx.pharmacy?.id === pharmacyId ? 'Sent to this counter' : 'Send to the counter'}
        </button>
      </div>
      <p className="text-xs text-slate-500 dark:text-slate-400">
        Ordering lets you pay by mobile money and have it delivered. Sending to the counter asks the pharmacy to
        pack it so you can pay and collect in person.
      </p>
      {error && (
        <p role="alert" className="error-state">
          {error}
        </p>
      )}
    </div>
  );
}

function Prescriptions() {
  const [list, setList] = useState<EPrescription[] | null>(null);
  const [pharmacies, setPharmacies] = useState<PharmacyOption[]>([]);
  const [error, setError] = useState('');

  useEffect(() => {
    getMyPrescriptions()
      .then(setList)
      .catch((e) => setError(e instanceof Error ? e.message : 'Could not load your prescriptions.'));
    getPharmacyOptions().then(setPharmacies).catch(() => setPharmacies([]));
  }, []);

  const replace = (rx: EPrescription) =>
    setList((all) => all?.map((x) => (x.id === rx.id ? { ...x, ...rx } : x)) ?? null);

  const open = list?.filter((rx) => !rx.expired && !['dispensed', 'cancelled'].includes(rx.status)) ?? [];
  const past = list?.filter((rx) => !open.includes(rx)) ?? [];

  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-6 px-4 py-8">
      <div>
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-brand-700 dark:text-brand-300">Health</p>
        <h1 className="font-display text-2xl font-bold text-slate-950 dark:text-slate-50">My prescriptions</h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Prescriptions your doctor sent you. Show the QR code at any pharmacy, or order it here.
        </p>
      </div>
      {error && (
        <p role="alert" className="error-state">
          {error}
        </p>
      )}
      {list === null && !error && <p className="text-sm text-slate-500">Loading…</p>}
      {list?.length === 0 && (
        <p className="empty-state">
          No prescriptions yet. When a doctor at a{' '}
          <Link href="/clinics" className="font-semibold text-brand-700 underline">
            partner clinic
          </Link>{' '}
          writes you one, it appears here. No time to go in?{' '}
          <Link href="/consult" className="font-semibold text-brand-700 underline">
            Talk to a doctor online
          </Link>
          .
        </p>
      )}
      {open.map((rx) => (
        <EPrescriptionCard key={rx.id} rx={rx}>
          <div className="flex w-full flex-col gap-4">
            {['sent', 'preparing', 'ready', 'ordered'].includes(rx.status) && <RxTracker rx={rx} />}
            {rx.status === 'ready' && (
              <p className="rounded-2xl bg-emerald-50 p-3 text-sm font-semibold text-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-100">
                Ready at {rx.pharmacy?.name}. Show this QR code or read out {rx.code} at the counter.
              </p>
            )}
            {rx.status === 'ordered' && (
              <Link href="/account/my-orders" className="btn-secondary min-h-11 self-start">
                Track your order
              </Link>
            )}
            {canChoosePharmacy(rx) && <FillOptions rx={rx} pharmacies={pharmacies} onChanged={replace} />}
          </div>
        </EPrescriptionCard>
      ))}
      {past.length > 0 && (
        <section className="flex flex-col gap-3">
          <h2 className="text-lg font-bold text-slate-950 dark:text-slate-50">Earlier</h2>
          {past.map((rx) => (
            <EPrescriptionCard key={rx.id} rx={rx} showQr={false} />
          ))}
        </section>
      )}
    </main>
  );
}

export default function MyPrescriptionsPage() {
  return (
    <SignedInGate title="My prescriptions" reason="Log in to see prescriptions from your doctor.">
      <Prescriptions />
    </SignedInGate>
  );
}
