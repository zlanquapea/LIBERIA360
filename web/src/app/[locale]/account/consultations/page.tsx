'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { ChatBubbleLeftRightIcon } from '@heroicons/react/24/outline';
import { SignedInGate } from '@/components/prescriptions/SignedInGate';
import { ConsultListCard } from '@/components/consultations/ConsultationParts';
import { getMyConsultations, type Consultation } from '@/lib/consultations-api';

function Consultations() {
  const [list, setList] = useState<Consultation[] | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    getMyConsultations()
      .then(setList)
      .catch((e) => setError(e instanceof Error ? e.message : 'Could not load your consultations.'));
  }, []);

  const current = list?.filter((c) => c.status === 'requested' || c.status === 'active') ?? [];
  const past = list?.filter((c) => !current.includes(c)) ?? [];

  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-6 px-4 py-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-brand-700 dark:text-brand-300">Health</p>
          <h1 className="font-display text-2xl font-bold text-slate-950 dark:text-slate-50">My consultations</h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Chats and voice notes with your doctor, and their advice.
          </p>
        </div>
        <Link href="/consult" className="btn-primary min-h-11 gap-1.5">
          <ChatBubbleLeftRightIcon aria-hidden className="h-5 w-5" /> Talk to a doctor
        </Link>
      </div>
      {error && (
        <p role="alert" className="error-state">
          {error}
        </p>
      )}
      {list === null && !error && <p className="text-sm text-slate-500">Loading…</p>}
      {list?.length === 0 && (
        <p className="empty-state">
          No consultations yet. A verified doctor can see you online from home, and send a prescription to the
          pharmacy.
        </p>
      )}
      {current.map((c) => (
        <ConsultListCard key={c.id} c={c} href={`/account/consultations/${c.id}`} />
      ))}
      {past.length > 0 && (
        <section className="flex flex-col gap-3">
          <h2 className="text-lg font-bold text-slate-950 dark:text-slate-50">Earlier</h2>
          {past.map((c) => (
            <ConsultListCard key={c.id} c={c} href={`/account/consultations/${c.id}`} />
          ))}
        </section>
      )}
    </main>
  );
}

export default function MyConsultationsPage() {
  return (
    <SignedInGate title="My consultations" reason="Log in to see your consultations.">
      <Consultations />
    </SignedInGate>
  );
}
