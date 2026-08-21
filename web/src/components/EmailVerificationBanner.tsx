'use client';

import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { HttpError } from '@/lib/http';

// Shown at the top of the account page for any signed-in user whose email
// isn't verified yet — never blocks anything (see User.emailVerified's doc
// comment), just nudges toward a confirmed address in case delivery
// features (booking confirmations, etc.) start relying on one later.
export function EmailVerificationBanner() {
  const { user, resendVerification } = useAuth();
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!user || user.emailVerified) return null;

  async function handleResend() {
    setSending(true);
    setError(null);
    try {
      await resendVerification();
      setSent(true);
    } catch (err) {
      if (err instanceof HttpError && err.status === 429) {
        setError('Too many attempts. Please wait a minute and try again.');
      } else {
        setError('Something went wrong. Please try again.');
      }
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="flex flex-col gap-2 rounded-xl border border-gold-400 bg-amber-50 dark:bg-amber-900/30 p-3 text-sm">
      <p className="font-medium text-slate-900 dark:text-slate-50">Verify your email</p>
      {sent ? (
        <p className="text-xs text-emerald-700 dark:text-emerald-300">Sent — check your inbox for a verification link.</p>
      ) : (
        <>
          <p className="text-xs text-slate-600 dark:text-slate-300">
            We haven&apos;t confirmed <span className="font-medium">{user.email}</span> yet.
          </p>
          {error && <p className="text-xs text-flag-700 dark:text-flag-300">{error}</p>}
          <button
            type="button"
            onClick={handleResend}
            disabled={sending}
            className="self-start rounded-full border border-gold-400 bg-white dark:bg-slate-900 px-3 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:border-gold-600 disabled:opacity-60"
          >
            {sending ? 'Sending…' : 'Resend verification email'}
          </button>
        </>
      )}
    </div>
  );
}
