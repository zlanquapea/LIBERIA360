'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useState, type FormEvent } from 'react';
import { HttpError } from '@/lib/http';
import { useAuth } from '@/hooks/useAuth';

// useSearchParams opts this page out of static rendering unless it's
// wrapped in Suspense — the reset link is always `/reset-password?token=…`
// (see MailService.resetPasswordUrl), so there's no useful fallback UI to
// show, but Next still requires the boundary to exist.
export default function ResetPasswordPage() {
  return (
    <Suspense fallback={null}>
      <ResetPasswordForm />
    </Suspense>
  );
}

function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get('token');
  const { resetPassword } = useAuth();
  const [newPassword, setNewPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  if (!token) {
    return (
      <main className="mx-auto flex max-w-sm flex-col gap-4 px-4 py-10 text-center">
        <h1 className="text-xl font-bold text-slate-900">Invalid reset link</h1>
        <p className="text-sm text-slate-500">
          This link is missing its token. Request a new one from the forgot-password page.
        </p>
        <Link href="/forgot-password" className="mx-auto text-sm font-medium text-brand-700 hover:underline">
          Request a new link
        </Link>
      </main>
    );
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await resetPassword(token as string, newPassword);
      setDone(true);
      setTimeout(() => router.push('/login'), 2000);
    } catch (err) {
      if (err instanceof HttpError) {
        // The token can be unknown, expired, or already-used — see
        // AuthService.resetPassword's shared "invalid or expired" message.
        setError(err.status === 429 ? 'Too many attempts. Please wait a minute and try again.' : err.message);
      } else {
        setError('Something went wrong. Please try again.');
      }
    } finally {
      setSubmitting(false);
    }
  }

  if (done) {
    return (
      <main className="mx-auto flex max-w-sm flex-col gap-4 px-4 py-10 text-center">
        <h1 className="text-xl font-bold text-slate-900">Password updated</h1>
        <p className="text-sm text-slate-500">Taking you to the log-in page…</p>
      </main>
    );
  }

  return (
    <main className="mx-auto flex max-w-sm flex-col gap-6 px-4 py-10">
      <div>
        <h1 className="text-xl font-bold text-slate-900">Choose a new password</h1>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
          New password
          <input
            type="password"
            required
            minLength={8}
            autoComplete="new-password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
          />
          <span className="text-xs font-normal text-slate-400">At least 8 characters.</span>
        </label>

        {error && (
          <p role="alert" className="rounded-lg bg-flag-500/10 px-3 py-2 text-sm text-flag-700">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={submitting}
          className="rounded-full bg-brand-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-800 disabled:opacity-60"
        >
          {submitting ? 'Updating…' : 'Update password'}
        </button>
      </form>
    </main>
  );
}
