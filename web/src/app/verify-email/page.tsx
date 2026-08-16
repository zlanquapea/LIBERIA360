'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';
import { HttpError } from '@/lib/http';
import { useAuth } from '@/hooks/useAuth';

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={null}>
      <VerifyEmailStatus />
    </Suspense>
  );
}

type Status = 'verifying' | 'success' | 'error';

function VerifyEmailStatus() {
  const searchParams = useSearchParams();
  const token = searchParams.get('token');
  const { verifyEmail } = useAuth();
  const [status, setStatus] = useState<Status>('verifying');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) {
      setStatus('error');
      setError('This link is missing its token.');
      return;
    }
    let cancelled = false;
    verifyEmail(token)
      .then(() => {
        if (!cancelled) setStatus('success');
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err instanceof HttpError ? err.message : 'Something went wrong. Please try again.');
        setStatus('error');
      });
    return () => {
      cancelled = true;
    };
    // Runs once for the token in the URL — re-verifying on every render
    // would just re-hit an endpoint that's already succeeded or failed.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  if (status === 'verifying') {
    return (
      <main className="mx-auto flex max-w-sm flex-col gap-4 px-4 py-10 text-center">
        <p className="text-sm text-slate-500">Verifying your email…</p>
      </main>
    );
  }

  if (status === 'success') {
    return (
      <main className="mx-auto flex max-w-sm flex-col gap-4 px-4 py-10 text-center">
        <h1 className="text-xl font-bold text-slate-900">Email verified</h1>
        <p className="text-sm text-slate-500">Thanks — your email address is confirmed.</p>
        <Link
          href="/account"
          className="mx-auto rounded-full bg-brand-700 px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-800"
        >
          Go to my account
        </Link>
      </main>
    );
  }

  return (
    <main className="mx-auto flex max-w-sm flex-col gap-4 px-4 py-10 text-center">
      <h1 className="text-xl font-bold text-slate-900">Couldn&apos;t verify email</h1>
      <p className="text-sm text-slate-500">
        {error ?? 'This link is invalid or has expired.'} You can request a new one from your account page.
      </p>
      <Link href="/account" className="mx-auto text-sm font-medium text-brand-700 hover:underline">
        Go to my account
      </Link>
    </main>
  );
}
