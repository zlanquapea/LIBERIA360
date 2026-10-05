'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { ArrowLeftIcon } from '@heroicons/react/24/outline';
import { SignedInGate } from '@/components/prescriptions/SignedInGate';
import { ConsultListCard } from '@/components/consultations/ConsultationParts';
import { getConsultationInbox, type Consultation } from '@/lib/consultations-api';

function Inbox() {
  const [list, setList] = useState<Consultation[] | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    const load = () =>
      getConsultationInbox()
        .then(setList)
        .catch((e) => setError(e instanceof Error ? e.message : 'Could not load consultations.'));
    void load();
    const t = setInterval(() => void load(), 30000);
    return () => clearInterval(t);
  }, []);

  const groups = [
    { title: 'Check payment', items: list?.filter((c) => c.status === 'requested') ?? [] },
    { title: 'In consultation', items: list?.filter((c) => c.status === 'active') ?? [] },
    {
      title: 'Refunds to send',
      items: list?.filter((c) => c.status !== 'requested' && c.paymentStatus === 'refund_due') ?? [],
    },
    {
      title: 'Earlier',
      items:
        list?.filter((c) => !['requested', 'active'].includes(c.status) && c.paymentStatus !== 'refund_due') ?? [],
    },
  ];

  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-6 px-4 py-8">
      <Link href="/account/clinic-dashboard" className="flex items-center gap-1 self-start text-sm font-semibold text-brand-700 dark:text-brand-300">
        <ArrowLeftIcon aria-hidden className="h-4 w-4" /> Clinic dashboard
      </Link>
      <div>
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-brand-700 dark:text-brand-300">Doctor</p>
        <h1 className="font-display text-2xl font-bold text-slate-950 dark:text-slate-50">Online consultations</h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Confirm the payment to start a consultation. Patients with emergency signs are sent to emergency care before
          they can book.
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
          No consultations yet. Set your fee under your doctor profile on the{' '}
          <Link href="/account/clinic-dashboard" className="font-semibold text-brand-700 underline">
            clinic dashboard
          </Link>{' '}
          and switch on &quot;Available now&quot; so patients can find you.
        </p>
      )}
      {groups
        .filter((g) => g.items.length)
        .map((g) => (
          <section key={g.title} className="flex flex-col gap-3">
            <h2 className="text-lg font-bold text-slate-950 dark:text-slate-50">
              {g.title} <span className="text-sm font-normal text-slate-500">({g.items.length})</span>
            </h2>
            {g.items.map((c) => (
              <ConsultListCard key={c.id} c={c} href={`/account/clinic-dashboard/consultations/${c.id}`} />
            ))}
          </section>
        ))}
    </main>
  );
}

export default function ConsultationInboxPage() {
  return (
    <SignedInGate title="Online consultations" reason="Log in to see your consultations.">
      <Inbox />
    </SignedInGate>
  );
}
