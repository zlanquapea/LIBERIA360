'use client';

import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { HttpError } from '@/lib/http';

function friendlyError(err: unknown): string {
  if (err instanceof HttpError) {
    if (err.status === 429) return 'Too many attempts. Please wait a minute and try again.';
    return err.message;
  }
  return 'Something went wrong. Please try again.';
}

// Account-page security section: change password, sign out of all other
// devices, and delete account. Mirrors TwoFactorSettings' inline-expand
// pattern (one section, buttons swap in a form) rather than a separate
// settings page.
export function AccountSecurity() {
  const { user } = useAuth();
  if (!user) return null;

  return (
    <div className="flex flex-col gap-3">
      <ChangePasswordSection />
      <LogoutAllDevicesSection />
      <DeleteAccountSection />
    </div>
  );
}

function ChangePasswordSection() {
  const { changePassword } = useAuth();
  const [open, setOpen] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await changePassword(currentPassword, newPassword);
      setCurrentPassword('');
      setNewPassword('');
      setSuccess(true);
      setOpen(false);
    } catch (err) {
      setError(friendlyError(err));
    } finally {
      setSubmitting(false);
    }
  }

  if (!open) {
    return (
      <div className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 dark:border-slate-800 p-3">
        <div>
          <p className="text-sm font-medium text-slate-900 dark:text-slate-50">Password</p>
          {success && <p className="text-xs text-emerald-700 dark:text-emerald-300">Password updated.</p>}
        </div>
        <button
          type="button"
          onClick={() => {
            setOpen(true);
            setSuccess(false);
          }}
          className="shrink-0 rounded-full border border-slate-300 dark:border-slate-700 px-3 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-200 hover:border-brand-500 hover:text-brand-700 dark:hover:text-brand-300"
        >
          Change
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3 rounded-xl border border-slate-200 dark:border-slate-800 p-3">
      <p className="text-sm font-medium text-slate-900 dark:text-slate-50">Change password</p>
      <label className="flex flex-col gap-1 text-sm font-medium text-slate-700 dark:text-slate-200">
        Current password
        <input
          type="password"
          required
          autoComplete="current-password"
          value={currentPassword}
          onChange={(e) => setCurrentPassword(e.target.value)}
          className="rounded-lg border border-slate-300 dark:border-slate-700 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
        />
      </label>
      <label className="flex flex-col gap-1 text-sm font-medium text-slate-700 dark:text-slate-200">
        New password
        <input
          type="password"
          required
          minLength={8}
          autoComplete="new-password"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          className="rounded-lg border border-slate-300 dark:border-slate-700 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
        />
        <span className="text-xs font-normal text-slate-400 dark:text-slate-400">At least 8 characters.</span>
      </label>

      {error && (
        <p role="alert" className="rounded-lg bg-flag-500/10 px-3 py-2 text-sm text-flag-700 dark:text-flag-300">
          {error}
        </p>
      )}

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={submitting}
          className="rounded-full bg-brand-700 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-800 disabled:opacity-60"
        >
          {submitting ? 'Updating…' : 'Update password'}
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="rounded-full border border-slate-300 dark:border-slate-700 px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-200 hover:border-slate-400 dark:hover:border-slate-500"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}

function LogoutAllDevicesSection() {
  const { logoutAllDevices } = useAuth();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function handleClick() {
    setSubmitting(true);
    setError(null);
    try {
      // Returns a fresh token for this session — see
      // AuthService.logoutAllDevices — so this device stays signed in
      // while every other one is signed out.
      await logoutAllDevices();
      setDone(true);
    } catch (err) {
      setError(friendlyError(err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex flex-col gap-2 rounded-xl border border-slate-200 dark:border-slate-800 p-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-slate-900 dark:text-slate-50">Sign out of all other devices</p>
          <p className="text-xs text-slate-500 dark:text-slate-400">This device stays signed in.</p>
        </div>
        <button
          type="button"
          onClick={handleClick}
          disabled={submitting}
          className="shrink-0 rounded-full border border-slate-300 dark:border-slate-700 px-3 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-200 hover:border-brand-500 hover:text-brand-700 dark:hover:text-brand-300 disabled:opacity-60"
        >
          {submitting ? 'Signing out…' : 'Sign out everywhere else'}
        </button>
      </div>
      {done && <p className="text-xs text-emerald-700 dark:text-emerald-300">Done — other devices are signed out.</p>}
      {error && <p className="text-xs text-flag-700 dark:text-flag-300">{error}</p>}
    </div>
  );
}

function DeleteAccountSection() {
  const router = useRouter();
  const { deleteAccount } = useAuth();
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await deleteAccount(password);
      router.push('/');
    } catch (err) {
      setError(friendlyError(err));
    } finally {
      setSubmitting(false);
    }
  }

  if (!open) {
    return (
      <div className="flex items-center justify-between gap-3 rounded-xl border border-flag-200 p-3">
        <div>
          <p className="text-sm font-medium text-slate-900 dark:text-slate-50">Delete account</p>
          <p className="text-xs text-slate-500 dark:text-slate-400">This can&apos;t be undone.</p>
        </div>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="shrink-0 rounded-full border border-flag-500 px-3 py-1.5 text-xs font-medium text-flag-700 dark:text-flag-300 hover:bg-flag-500/10"
        >
          Delete…
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3 rounded-xl border border-flag-500 p-3">
      <p className="text-sm font-medium text-slate-900 dark:text-slate-50">Delete your account</p>
      <p className="text-xs text-slate-600 dark:text-slate-300">
        Your profile, name, and email are removed. Reviews, bookings, and messages you&apos;ve left stay in place so
        other travelers and businesses aren&apos;t left with gaps in their history, but they&apos;ll no longer be
        linked to you.
      </p>
      <label className="flex flex-col gap-1 text-sm font-medium text-slate-700 dark:text-slate-200">
        Confirm your password
        <input
          type="password"
          required
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="rounded-lg border border-slate-300 dark:border-slate-700 px-3 py-2 text-sm outline-none focus:border-flag-500 focus:ring-1 focus:ring-flag-500"
        />
      </label>

      {error && (
        <p role="alert" className="rounded-lg bg-flag-500/10 px-3 py-2 text-sm text-flag-700 dark:text-flag-300">
          {error}
        </p>
      )}

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={submitting}
          className="rounded-full bg-flag-600 px-4 py-2 text-sm font-semibold text-white hover:bg-flag-700 disabled:opacity-60"
        >
          {submitting ? 'Deleting…' : 'Permanently delete my account'}
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="rounded-full border border-slate-300 dark:border-slate-700 px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-200 hover:border-slate-400 dark:hover:border-slate-500"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
