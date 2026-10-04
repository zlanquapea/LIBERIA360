'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import {
  CheckBadgeIcon,
  ExclamationTriangleIcon,
  ShieldExclamationIcon,
} from '@heroicons/react/24/solid';
import { useAuth } from '@/hooks/useAuth';
import { BrandLoader } from '@/components/BrandLoader';
import { verifyPrescription, type EPrescription } from '@/lib/clinic-api';
import { HttpError } from '@/lib/http';
import { EPrescriptionCard } from './EPrescriptionCard';

const date = (iso: string) =>
  new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' });

function verdict(rx: EPrescription) {
  if (rx.status === 'cancelled')
    return { tone: 'red', title: 'Cancelled by the doctor', body: rx.cancelledReason ?? "Don't dispense it." };
  if (rx.expired) return { tone: 'red', title: 'Expired', body: `It was valid until ${date(rx.expiresAt)}.` };
  if (rx.status === 'dispensed')
    return {
      tone: 'amber',
      title: 'Already dispensed',
      body: `Filled${rx.pharmacy ? ` at ${rx.pharmacy.name}` : ''}${rx.dispensedAt ? ` on ${date(rx.dispensedAt)}` : ''}. It can't be used again.`,
    };
  if (rx.status === 'ordered')
    return { tone: 'amber', title: 'Already ordered', body: `The patient ordered it in the app${rx.pharmacy ? ` from ${rx.pharmacy.name}` : ''}.` };
  return {
    tone: 'green',
    title: 'Genuine prescription',
    body: `Written by a doctor whose licence LIBERIA360 has checked. Valid until ${date(rx.expiresAt)}.`,
  };
}

const TONES = {
  green: 'border-emerald-300 bg-emerald-50 text-emerald-950 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-50',
  amber: 'border-amber-300 bg-amber-50 text-amber-950 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-50',
  red: 'border-red-300 bg-red-50 text-red-950 dark:border-red-800 dark:bg-red-950/40 dark:text-red-50',
} as const;

export function RxVerify({ code, token }: { code: string; token: string | null }) {
  const { ready, user } = useAuth();
  const [rx, setRx] = useState<EPrescription | null>(null);
  const [missing, setMissing] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!ready) return;
    verifyPrescription(code, token)
      .then(setRx)
      .catch((e) => {
        if (e instanceof HttpError && e.status === 404) setMissing(true);
        else setError(e instanceof Error ? e.message : 'Could not check this prescription.');
      });
  }, [code, token, ready, user?.id]);

  if (!rx && !missing && !error)
    return (
      <main className="flex min-h-[60vh] items-center justify-center">
        <BrandLoader />
      </main>
    );

  if (missing || error)
    return (
      <main className="mx-auto flex max-w-lg flex-col gap-4 px-4 py-12">
        <div className={`flex items-start gap-3 rounded-3xl border-2 p-5 ${TONES.red}`}>
          <ShieldExclamationIcon aria-hidden className="h-8 w-8 shrink-0" />
          <div>
            <h1 className="text-xl font-bold">{error ? 'Could not check it' : 'Not a valid prescription'}</h1>
            <p className="mt-1 text-sm">
              {error ||
                "We couldn't find a LIBERIA360 prescription for this code. Don't dispense it. Ask the patient to contact their doctor."}
            </p>
          </div>
        </div>
        {!user && !error && (
          <p className="text-sm text-slate-600 dark:text-slate-300">
            Pharmacy staff: <Link href="/login" className="font-semibold text-brand-700 underline">log in</Link> and enter the code at your counter.
          </p>
        )}
      </main>
    );

  const v = verdict(rx!);
  const Icon = v.tone === 'green' ? CheckBadgeIcon : ExclamationTriangleIcon;
  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-5 px-4 py-8">
      <div role="status" className={`flex items-start gap-3 rounded-3xl border-2 p-5 ${TONES[v.tone as keyof typeof TONES]}`}>
        <Icon aria-hidden className="h-9 w-9 shrink-0" />
        <div className="min-w-0">
          <h1 className="text-xl font-bold">{v.title}</h1>
          <p className="mt-1 text-sm">{v.body}</p>
          <p className="mt-2 font-mono text-sm font-bold tracking-widest">{rx!.code}</p>
        </div>
      </div>

      {rx!.myPharmacies && rx!.myPharmacies.length > 0 && v.tone === 'green' && (
        <div className="flex flex-wrap gap-2">
          {rx!.myPharmacies.map((p) => (
            <Link
              key={p.id}
              href={`/account/pharmacy-dashboard/${p.id}/prescriptions?code=${encodeURIComponent(rx!.code)}`}
              className="btn-primary min-h-11"
            >
              Fill at {p.name}
            </Link>
          ))}
        </div>
      )}

      <EPrescriptionCard rx={rx!} showQr={false} />

      {!rx!.full && (
        <p className="text-sm text-slate-600 dark:text-slate-300">
          Are you the pharmacist?{' '}
          {user ? (
            'Open your pharmacy dashboard and enter the code at the counter to see the medicines.'
          ) : (
            <>
              <Link href="/login" className="font-semibold text-brand-700 underline">
                Log in
              </Link>{' '}
              with your pharmacy account to see the medicines.
            </>
          )}
        </p>
      )}
    </main>
  );
}
