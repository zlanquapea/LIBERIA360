'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useState, type FormEvent } from 'react';
import { HttpError } from '@/lib/http';
import { useAuth } from '@/hooks/useAuth';
import { safeNext, signupHrefFor } from '@/lib/invite-redirect';

function friendlyError(err: unknown): string {
  if (err instanceof HttpError) {
    // 429 from the login/verify rate limit (see api/src/app.module.ts) —
    // the raw message is written for logs, not a first-time visitor.
    if (err.status === 429) return 'Too many attempts. Please wait a minute and try again.';
    return err.message;
  }
  return 'Something went wrong. Please try again.';
}

// useSearchParams opts this page out of static rendering unless it's
// wrapped in Suspense — same idiom as reset-password/verify-email. The
// `next` param (e.g. `/invite/:token`, from InvitePage's "Log in to
// accept") is what lets a trip invitation land the person back on it
// after logging in instead of the generic /account.
export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = safeNext(searchParams.get('next'));
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  // Set once step 1 (password) succeeds on a 2FA-enabled account — its
  // presence is what switches this page into the code-entry step.
  const [pendingToken, setPendingToken] = useState<string | null>(null);

  async function handlePasswordSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const result = await login(email, password);
      if ('twoFactorRequired' in result) {
        setPendingToken(result.pendingToken);
      } else {
        router.push(next);
      }
    } catch (err) {
      setError(friendlyError(err));
    } finally {
      setSubmitting(false);
    }
  }

  if (pendingToken) {
    return (
      <TwoFactorStep
        pendingToken={pendingToken}
        next={next}
        onBack={() => {
          setPendingToken(null);
          setError(null);
        }}
      />
    );
  }

  return (
    <main className="mx-auto flex max-w-sm flex-col gap-6 px-4 py-10">
      <div>
        <h1 className="text-xl font-bold text-slate-900 dark:text-slate-50">Log in</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">Welcome back to LIBERIA360.</p>
      </div>

      <form onSubmit={handlePasswordSubmit} className="flex flex-col gap-4">
        <label className="flex flex-col gap-1 text-sm font-medium text-slate-700 dark:text-slate-200">
          Email
          <input
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="rounded-lg border border-slate-300 dark:border-slate-700 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
          />
        </label>

        <label className="flex flex-col gap-1 text-sm font-medium text-slate-700 dark:text-slate-200">
          Password
          <input
            type="password"
            required
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="rounded-lg border border-slate-300 dark:border-slate-700 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
          />
        </label>

        <Link href="/forgot-password" className="self-end text-xs font-medium text-brand-700 dark:text-brand-300 hover:underline">
          Forgot your password?
        </Link>

        {error && (
          <p role="alert" className="rounded-lg bg-flag-500/10 px-3 py-2 text-sm text-flag-700 dark:text-flag-300">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={submitting}
          className="rounded-full bg-brand-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-800 disabled:opacity-60"
        >
          {submitting ? 'Logging in…' : 'Log in'}
        </button>
      </form>

      <p className="text-center text-sm text-slate-500 dark:text-slate-400">
        New here?{' '}
        <Link href={signupHrefFor(next)} className="font-medium text-brand-700 dark:text-brand-300 hover:underline">
          Create an account
        </Link>
      </p>
    </main>
  );
}

// Login step 2 — shown once step 1 signals the account has 2FA enabled.
// Accepts either a 6-digit authenticator code or an XXXXX-XXXXX recovery
// code; AuthService tries the TOTP check first, then recovery codes, so
// this input doesn't need to know which kind was typed.
function TwoFactorStep({ pendingToken, next, onBack }: { pendingToken: string; next: string; onBack: () => void }) {
  const router = useRouter();
  const { verifyTwoFactor } = useAuth();
  const [code, setCode] = useState('');
  const [useRecoveryCode, setUseRecoveryCode] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await verifyTwoFactor(pendingToken, code.trim());
      router.push(next);
    } catch (err) {
      setError(friendlyError(err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="mx-auto flex max-w-sm flex-col gap-6 px-4 py-10">
      <div>
        <h1 className="text-xl font-bold text-slate-900 dark:text-slate-50">Enter your code</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          {useRecoveryCode
            ? 'Enter one of your saved recovery codes.'
            : 'Open your authenticator app and enter the 6-digit code.'}
        </p>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <label className="flex flex-col gap-1 text-sm font-medium text-slate-700 dark:text-slate-200">
          {useRecoveryCode ? 'Recovery code' : 'Authentication code'}
          <input
            type="text"
            required
            autoComplete="one-time-code"
            inputMode={useRecoveryCode ? 'text' : 'numeric'}
            placeholder={useRecoveryCode ? 'xxxxx-xxxxx' : '123456'}
            value={code}
            onChange={(e) => setCode(e.target.value)}
            className="rounded-lg border border-slate-300 dark:border-slate-700 px-3 py-2 text-center text-lg tracking-widest outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
          />
        </label>

        {error && (
          <p role="alert" className="rounded-lg bg-flag-500/10 px-3 py-2 text-sm text-flag-700 dark:text-flag-300">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={submitting}
          className="rounded-full bg-brand-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-800 disabled:opacity-60"
        >
          {submitting ? 'Verifying…' : 'Verify'}
        </button>
      </form>

      <div className="flex flex-col items-center gap-2 text-sm">
        <button
          type="button"
          onClick={() => {
            setUseRecoveryCode((v) => !v);
            setCode('');
            setError(null);
          }}
          className="font-medium text-brand-700 dark:text-brand-300 hover:underline"
        >
          {useRecoveryCode ? 'Use your authenticator app instead' : 'Use a recovery code instead'}
        </button>
        <button type="button" onClick={onBack} className="text-slate-500 dark:text-slate-400 hover:underline">
          Back to log in
        </button>
      </div>
    </main>
  );
}
