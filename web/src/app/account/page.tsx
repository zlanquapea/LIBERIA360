'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState, type FormEvent } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { PushNotificationToggle } from '@/components/PushNotificationToggle';
import { TwoFactorSettings } from '@/components/TwoFactorSettings';
import { AccountSecurity } from '@/components/AccountSecurity';
import { EmailVerificationBanner } from '@/components/EmailVerificationBanner';
import { InterestChips, TravelerTypeSelect } from '@/components/ProfileFields';
import { getCategories } from '@/lib/api';
import { formatTravelerType } from '@/lib/format';
import { HttpError } from '@/lib/http';
import type { Category, TravelerType } from '@/lib/types';

// Account screen — shows the signed-in profile, or prompts to log in.
// No server-side gate: auth state lives in localStorage (see auth-storage.ts),
// so this page always renders client-side and redirects itself once ready.
export default function AccountPage() {
  const router = useRouter();
  const { user, ready, logout } = useAuth();

  if (!ready) {
    return (
      <main className="mx-auto flex max-w-sm flex-col gap-4 px-4 py-10">
        <p className="text-sm text-slate-500">Loading…</p>
      </main>
    );
  }

  if (!user) {
    return (
      <main className="mx-auto flex max-w-sm flex-col gap-4 px-4 py-10 text-center">
        <h1 className="text-xl font-bold text-slate-900">You&apos;re not logged in</h1>
        <p className="text-sm text-slate-500">Log in to save trips, write reviews, and claim your business.</p>
        <Link
          href="/login"
          className="mx-auto rounded-full bg-brand-700 px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-800"
        >
          Log in
        </Link>
      </main>
    );
  }

  function handleLogout() {
    logout();
    router.push('/');
  }

  return (
    <main className="mx-auto flex max-w-sm flex-col gap-6 px-4 py-10">
      <div className="flex items-center gap-4">
        <span className="flex h-14 w-14 items-center justify-center rounded-full bg-brand-700 text-xl font-semibold text-white">
          {user.name.trim().charAt(0).toUpperCase() || '?'}
        </span>
        <div>
          <h1 className="text-lg font-bold text-slate-900">{user.name}</h1>
          <p className="text-sm text-slate-500">{user.email}</p>
        </div>
      </div>

      <EmailVerificationBanner />

      <dl className="flex flex-col divide-y divide-slate-100 rounded-xl border border-slate-200 text-sm">
        <div className="flex justify-between px-4 py-3">
          <dt className="text-slate-500">Home county</dt>
          <dd className="font-medium text-slate-900">{user.homeCounty?.name ?? 'Not set'}</dd>
        </div>
        <div className="flex justify-between px-4 py-3">
          <dt className="text-slate-500">Traveler type</dt>
          <dd className="font-medium text-slate-900">
            {user.travelerType ? formatTravelerType(user.travelerType) : 'Not set'}
          </dd>
        </div>
        <div className="flex flex-col gap-1.5 px-4 py-3">
          <dt className="text-slate-500">Interests</dt>
          <dd>
            {user.interests.length === 0 ? (
              <span className="font-medium text-slate-900">Not set</span>
            ) : (
              <span className="text-slate-700">{user.interests.join(', ')}</span>
            )}
          </dd>
        </div>
        <div className="flex justify-between px-4 py-3">
          <dt className="text-slate-500">Member since</dt>
          <dd className="font-medium text-slate-900">
            {new Date(user.createdAt).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
          </dd>
        </div>
      </dl>

      <ProfileEditor />

      <TwoFactorSettings />

      <AccountSecurity />

      <PushNotificationToggle />

      <Link
        href="/trips"
        className="rounded-full border border-slate-300 px-4 py-2.5 text-center text-sm font-medium text-slate-700 hover:border-brand-500 hover:text-brand-700"
      >
        My Trips
      </Link>

      <Link
        href="/account/bookings"
        className="rounded-full border border-slate-300 px-4 py-2.5 text-center text-sm font-medium text-slate-700 hover:border-brand-500 hover:text-brand-700"
      >
        My Bookings
      </Link>

      <Link
        href="/account/analytics"
        className="rounded-full border border-slate-300 px-4 py-2.5 text-center text-sm font-medium text-slate-700 hover:border-brand-500 hover:text-brand-700"
      >
        Business Analytics
      </Link>

      <Link
        href="/creators/me"
        className="rounded-full border border-slate-300 px-4 py-2.5 text-center text-sm font-medium text-slate-700 hover:border-brand-500 hover:text-brand-700"
      >
        Manage creator profile
      </Link>

      {user.isAdmin && (
        <Link
          href="/admin"
          className="rounded-full border-2 border-gold-400 px-4 py-2.5 text-center text-sm font-medium text-slate-700 hover:border-gold-600"
        >
          ⭐ Admin dashboard
        </Link>
      )}

      <button
        type="button"
        onClick={handleLogout}
        className="rounded-full border border-slate-300 px-4 py-2.5 text-sm font-medium text-slate-700 hover:border-flag-500 hover:text-flag-700"
      >
        Log out
      </button>
    </main>
  );
}

// Traveler type and interests weren't editable after signup at all before
// this — the account page's only lever was "log out." A compact inline
// editor keeps that fixed without a whole separate settings page.
function ProfileEditor() {
  const { user, updateProfile } = useAuth();
  const [open, setOpen] = useState(false);
  const [travelerType, setTravelerType] = useState<TravelerType | ''>(user?.travelerType ?? '');
  const [interests, setInterests] = useState<string[]>(user?.interests ?? []);
  const [categories, setCategories] = useState<Category[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (open && categories.length === 0) {
      getCategories().then(setCategories);
    }
  }, [open, categories.length]);

  function toggleInterest(slug: string) {
    setInterests((prev) => (prev.includes(slug) ? prev.filter((s) => s !== slug) : [...prev, slug]));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    setSuccess(false);
    try {
      await updateProfile({ travelerType: travelerType || undefined, interests });
      setSuccess(true);
      setOpen(false);
    } catch (err) {
      setError(err instanceof HttpError ? err.message : 'Something went wrong. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  if (!open) {
    return (
      <div className="flex flex-col gap-1">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="self-start text-sm font-medium text-brand-700 hover:underline"
        >
          Edit traveler type &amp; interests
        </button>
        {success && <p className="text-xs text-emerald-700">Saved.</p>}
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3 rounded-xl border border-slate-200 p-3">
      <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
        Traveler type
        <TravelerTypeSelect value={travelerType} onChange={setTravelerType} />
      </label>
      {categories.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <p className="text-sm font-medium text-slate-700">Interests</p>
          <InterestChips categories={categories} selected={interests} onToggle={toggleInterest} />
        </div>
      )}
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
          {submitting ? 'Saving…' : 'Save'}
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="rounded-full border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:border-slate-400"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
