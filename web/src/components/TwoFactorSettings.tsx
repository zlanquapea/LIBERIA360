'use client';

import Image from 'next/image';
import { useEffect, useState, type FormEvent } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { HttpError } from '@/lib/http';

type Step =
  | { name: 'idle' }
  | { name: 'setup' }
  | { name: 'recoveryCodes'; codes: string[] }
  | { name: 'disable' };

function friendlyError(err: unknown): string {
  if (err instanceof HttpError) {
    if (err.status === 429) return 'Too many attempts. Please wait a minute and try again.';
    return err.message;
  }
  return 'Something went wrong. Please try again.';
}

// Account-page 2FA management — mirrors ProfileEditor's inline-expand
// pattern rather than a separate settings page. Three states worth
// tracking beyond plain on/off: mid-setup (a secret was generated but not
// yet confirmed), and the one-time recovery-code reveal right after
// enabling — the API never returns those codes again after this.
//
// setupTwoFactor/enableTwoFactor/disableTwoFactor are read from *this*
// useAuth() call and threaded down as props, rather than having SetupFlow
// and DisableFlow each call useAuth() themselves — every call is an
// independent hook instance that re-hydrates from localStorage on its own
// mount-time effect, so a freshly-mounted child calling an API in its own
// useEffect can fire before its *own* token has loaded, even though this
// parent's token already has (it had to, to render the buttons below at
// all). Passing the already-hydrated functions down sidesteps that.
export function TwoFactorSettings() {
  const { user, setupTwoFactor, enableTwoFactor, disableTwoFactor } = useAuth();
  const [step, setStep] = useState<Step>({ name: 'idle' });

  if (!user) return null;

  if (step.name === 'setup') {
    return (
      <SetupFlow
        setupTwoFactor={setupTwoFactor}
        enableTwoFactor={enableTwoFactor}
        onEnabled={(codes) => setStep({ name: 'recoveryCodes', codes })}
        onCancel={() => setStep({ name: 'idle' })}
      />
    );
  }

  if (step.name === 'recoveryCodes') {
    return <RecoveryCodesReveal codes={step.codes} onDone={() => setStep({ name: 'idle' })} />;
  }

  if (step.name === 'disable') {
    return (
      <DisableFlow
        disableTwoFactor={disableTwoFactor}
        onDisabled={() => setStep({ name: 'idle' })}
        onCancel={() => setStep({ name: 'idle' })}
      />
    );
  }

  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 dark:border-slate-800 p-3">
      <div>
        <p className="text-sm font-medium text-slate-900 dark:text-slate-50">Two-factor authentication</p>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          {user.twoFactorEnabled ? 'On — an authenticator code is required at login.' : 'Off'}
        </p>
      </div>
      {user.twoFactorEnabled ? (
        <button
          type="button"
          onClick={() => setStep({ name: 'disable' })}
          className="shrink-0 rounded-full border border-slate-300 dark:border-slate-700 px-3 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-200 hover:border-flag-500 hover:text-flag-700"
        >
          Turn off
        </button>
      ) : (
        <button
          type="button"
          onClick={() => setStep({ name: 'setup' })}
          className="shrink-0 rounded-full bg-brand-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-800"
        >
          Turn on
        </button>
      )}
    </div>
  );
}

function SetupFlow({
  setupTwoFactor,
  enableTwoFactor,
  onEnabled,
  onCancel,
}: {
  setupTwoFactor: ReturnType<typeof useAuth>['setupTwoFactor'];
  enableTwoFactor: ReturnType<typeof useAuth>['enableTwoFactor'];
  onEnabled: (codes: string[]) => void;
  onCancel: () => void;
}) {
  const [loading, setLoading] = useState(true);
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string | null>(null);
  const [secret, setSecret] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setupTwoFactor()
      .then((result) => {
        if (cancelled) return;
        setQrCodeDataUrl(result.qrCodeDataUrl);
        setSecret(result.secret);
      })
      .catch((err) => {
        if (!cancelled) setError(friendlyError(err));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // Runs once when the setup step is entered — re-running on every
    // render would mint a fresh (and immediately-invalidating) secret.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const recoveryCodes = await enableTwoFactor(code.trim());
      onEnabled(recoveryCodes);
    } catch (err) {
      setError(friendlyError(err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-slate-200 dark:border-slate-800 p-3">
      <p className="text-sm font-medium text-slate-900 dark:text-slate-50">Set up two-factor authentication</p>

      {loading && <p className="text-sm text-slate-500 dark:text-slate-400">Generating your QR code…</p>}

      {qrCodeDataUrl && (
        <>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Scan this with an authenticator app (Google Authenticator, Authy, 1Password, …), then enter the 6-digit
            code it shows.
          </p>
          <Image
            src={qrCodeDataUrl}
            alt="Scan this QR code with your authenticator app"
            width={180}
            height={180}
            unoptimized
            className="self-center rounded-lg border border-slate-200 dark:border-slate-800"
          />
          {secret && (
            <p className="break-all rounded-lg bg-slate-50 dark:bg-slate-800 px-3 py-2 text-center text-xs text-slate-500 dark:text-slate-400">
              Can&apos;t scan it? Enter this code manually: <span className="font-mono">{secret}</span>
            </p>
          )}

          <form onSubmit={handleSubmit} className="flex flex-col gap-3">
            <label className="flex flex-col gap-1 text-sm font-medium text-slate-700 dark:text-slate-200">
              6-digit code
              <input
                type="text"
                required
                autoComplete="one-time-code"
                inputMode="numeric"
                placeholder="123456"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                className="rounded-lg border border-slate-300 dark:border-slate-700 px-3 py-2 text-center text-lg tracking-widest outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
              />
            </label>

            {error && (
              <p role="alert" className="rounded-lg bg-flag-500/10 px-3 py-2 text-sm text-flag-700">
                {error}
              </p>
            )}

            <div className="flex gap-2">
              <button
                type="submit"
                disabled={submitting}
                className="rounded-full bg-brand-700 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-800 disabled:opacity-60"
              >
                {submitting ? 'Enabling…' : 'Enable'}
              </button>
              <button
                type="button"
                onClick={onCancel}
                className="rounded-full border border-slate-300 dark:border-slate-700 px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-200 hover:border-slate-400 dark:hover:border-slate-500"
              >
                Cancel
              </button>
            </div>
          </form>
        </>
      )}

      {!loading && !qrCodeDataUrl && (
        <>
          {error && (
            <p role="alert" className="rounded-lg bg-flag-500/10 px-3 py-2 text-sm text-flag-700">
              {error}
            </p>
          )}
          <button
            type="button"
            onClick={onCancel}
            className="self-start rounded-full border border-slate-300 dark:border-slate-700 px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-200 hover:border-slate-400 dark:hover:border-slate-500"
          >
            Close
          </button>
        </>
      )}
    </div>
  );
}

function RecoveryCodesReveal({ codes, onDone }: { codes: string[]; onDone: () => void }) {
  return (
    <div className="flex flex-col gap-3 rounded-xl border border-gold-400 bg-amber-50 dark:bg-amber-900/30 p-3">
      <p className="text-sm font-semibold text-slate-900 dark:text-slate-50">Two-factor authentication is on</p>
      <p className="text-xs text-slate-600 dark:text-slate-300">
        Save these recovery codes somewhere safe — each one lets you log in once if you lose access to your
        authenticator app. They won&apos;t be shown again.
      </p>
      <ul className="grid grid-cols-2 gap-1.5 font-mono text-xs text-slate-800 dark:text-slate-100">
        {codes.map((c) => (
          <li key={c} className="rounded bg-white dark:bg-slate-900 px-2 py-1 text-center">
            {c}
          </li>
        ))}
      </ul>
      <button
        type="button"
        onClick={onDone}
        className="self-start rounded-full bg-brand-700 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-800"
      >
        I&apos;ve saved these
      </button>
    </div>
  );
}

function DisableFlow({
  disableTwoFactor,
  onDisabled,
  onCancel,
}: {
  disableTwoFactor: ReturnType<typeof useAuth>['disableTwoFactor'];
  onDisabled: () => void;
  onCancel: () => void;
}) {
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await disableTwoFactor(password);
      onDisabled();
    } catch (err) {
      setError(friendlyError(err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3 rounded-xl border border-slate-200 dark:border-slate-800 p-3">
      <p className="text-sm font-medium text-slate-900 dark:text-slate-50">Turn off two-factor authentication</p>
      <label className="flex flex-col gap-1 text-sm font-medium text-slate-700 dark:text-slate-200">
        Confirm your password
        <input
          type="password"
          required
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="rounded-lg border border-slate-300 dark:border-slate-700 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
        />
      </label>

      {error && (
        <p role="alert" className="rounded-lg bg-flag-500/10 px-3 py-2 text-sm text-flag-700">
          {error}
        </p>
      )}

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={submitting}
          className="rounded-full bg-flag-600 px-4 py-2 text-sm font-semibold text-white hover:bg-flag-700 disabled:opacity-60"
        >
          {submitting ? 'Turning off…' : 'Turn off'}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-full border border-slate-300 dark:border-slate-700 px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-200 hover:border-slate-400 dark:hover:border-slate-500"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
