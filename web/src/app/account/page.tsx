'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState, type FormEvent } from 'react';
import { StarIcon } from '@heroicons/react/24/solid';
import { useAuth } from '@/hooks/useAuth';
import { PushNotificationToggle } from '@/components/PushNotificationToggle';
import { TwoFactorSettings } from '@/components/TwoFactorSettings';
import { AccountSecurity } from '@/components/AccountSecurity';
import { EmailVerificationBanner } from '@/components/EmailVerificationBanner';
import { CountySelect, InterestChips, TravelerTypeSelect } from '@/components/ProfileFields';
import { getCategories, getCounties } from '@/lib/api';
import { formatTravelerType } from '@/lib/format';
import { HttpError } from '@/lib/http';
import type { AuthUser, Category, County, TravelerType } from '@/lib/types';

// Account screen — shows the signed-in profile, or prompts to log in.
// No server-side gate: auth state lives in localStorage (see auth-storage.ts),
// so this page always renders client-side and redirects itself once ready.
export default function AccountPage() {
  const router = useRouter();
  const { user, ready, logout } = useAuth();

  if (!ready) {
    return (
      <main className="mx-auto flex max-w-sm flex-col gap-4 px-4 py-10">
        <p className="text-sm text-slate-500 dark:text-slate-400">Loading…</p>
      </main>
    );
  }

  if (!user) {
    return (
      <main className="mx-auto flex max-w-sm flex-col gap-4 px-4 py-10 text-center">
        <h1 className="text-xl font-bold text-slate-900 dark:text-slate-50">You&apos;re not logged in</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">Log in to save trips, write reviews, and claim your business.</p>
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
          <h1 className="text-lg font-bold text-slate-900 dark:text-slate-50">{user.name}</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">{user.email}</p>
        </div>
      </div>

      <EmailVerificationBanner />

      <dl className="flex flex-col divide-y divide-slate-100 dark:divide-slate-800 rounded-xl border border-slate-200 dark:border-slate-800 text-sm">
        <div className="flex justify-between px-4 py-3">
          <dt className="text-slate-500 dark:text-slate-400">Home county</dt>
          <dd className="font-medium text-slate-900 dark:text-slate-50">{user.homeCounty?.name ?? 'Not set'}</dd>
        </div>
        <div className="flex justify-between px-4 py-3">
          <dt className="text-slate-500 dark:text-slate-400">Traveler type</dt>
          <dd className="font-medium text-slate-900 dark:text-slate-50">
            {user.travelerType ? formatTravelerType(user.travelerType) : 'Not set'}
          </dd>
        </div>
        <div className="flex flex-col gap-1.5 px-4 py-3">
          <dt className="text-slate-500 dark:text-slate-400">Interests</dt>
          <dd>
            {user.interests.length === 0 ? (
              <span className="font-medium text-slate-900 dark:text-slate-50">Not set</span>
            ) : (
              <span className="text-slate-700 dark:text-slate-200">{user.interests.join(', ')}</span>
            )}
          </dd>
        </div>
        <div className="flex justify-between px-4 py-3">
          <dt className="text-slate-500 dark:text-slate-400">Member since</dt>
          <dd className="font-medium text-slate-900 dark:text-slate-50">
            {new Date(user.createdAt).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
          </dd>
        </div>
      </dl>

      <ProfileEditor user={user} />

      <TwoFactorSettings />

      <AccountSecurity />

      <PushNotificationToggle />

      <Link
        href="/trips"
        className="rounded-full border border-slate-300 dark:border-slate-700 px-4 py-2.5 text-center text-sm font-medium text-slate-700 dark:text-slate-200 hover:border-brand-500 hover:text-brand-700 dark:hover:text-brand-300"
      >
        My Trips
      </Link>

      <Link
        href="/account/bookings"
        className="rounded-full border border-slate-300 dark:border-slate-700 px-4 py-2.5 text-center text-sm font-medium text-slate-700 dark:text-slate-200 hover:border-brand-500 hover:text-brand-700 dark:hover:text-brand-300"
      >
        My Bookings
      </Link>

      <Link
        href="/account/my-places"
        className="rounded-full border border-slate-300 dark:border-slate-700 px-4 py-2.5 text-center text-sm font-medium text-slate-700 dark:text-slate-200 hover:border-brand-500 hover:text-brand-700 dark:hover:text-brand-300"
      >
        My Places
      </Link>

      <Link
        href="/account/my-events"
        className="rounded-full border border-slate-300 dark:border-slate-700 px-4 py-2.5 text-center text-sm font-medium text-slate-700 dark:text-slate-200 hover:border-brand-500 hover:text-brand-700 dark:hover:text-brand-300"
      >
        My Events
      </Link>

      <Link
        href="/places/submit"
        className="rounded-full border border-dashed border-brand-400 px-4 py-2.5 text-center text-sm font-medium text-brand-700 dark:border-brand-600 dark:text-brand-300 hover:border-solid hover:bg-brand-50 dark:hover:bg-brand-950/30"
      >
        + Add a place
      </Link>

      <Link
        href="/account/analytics"
        className="rounded-full border border-slate-300 dark:border-slate-700 px-4 py-2.5 text-center text-sm font-medium text-slate-700 dark:text-slate-200 hover:border-brand-500 hover:text-brand-700 dark:hover:text-brand-300"
      >
        Place Dashboard
      </Link>

      <Link
        href="/creators/me"
        className="rounded-full border border-slate-300 dark:border-slate-700 px-4 py-2.5 text-center text-sm font-medium text-slate-700 dark:text-slate-200 hover:border-brand-500 hover:text-brand-700 dark:hover:text-brand-300"
      >
        Manage creator profile
      </Link>

      {user.isAdmin && (
        <Link
          href="/admin"
          className="flex items-center justify-center gap-1.5 rounded-full border-2 border-gold-400 px-4 py-2.5 text-center text-sm font-medium text-slate-700 dark:text-slate-200 transition-colors hover:border-gold-600"
        >
          <StarIcon aria-hidden className="h-4 w-4 text-gold-500" />
          Admin dashboard
        </Link>
      )}

      <button
        type="button"
        onClick={handleLogout}
        className="rounded-full border border-slate-300 dark:border-slate-700 px-4 py-2.5 text-sm font-medium text-slate-700 dark:text-slate-200 hover:border-flag-500 hover:text-flag-700 dark:hover:text-flag-300"
      >
        Log out
      </button>
    </main>
  );
}

// Traveler type, interests, and home county weren't editable after signup
// at all before this — the account page's only lever was "log out." A
// compact inline editor keeps that fixed without a whole separate settings
// page. Home county in particular (UpdateProfileDto.homeCountyId) was
// already accepted by the API with nowhere in the UI to ever set it — the
// "Home county" row above just read "Not set" forever.
//
// `user` comes in as a prop rather than a second `useAuth()` call here on
// purpose: useAuth's `user`/`ready` state is local to each call site and
// only syncs from localStorage in a useEffect, so a second call inside
// this component would start out null on its very first render — the one
// render whose values these useState initializers actually capture — even
// though AccountPage's own `useAuth()` call already has the real user by
// the time it mounts ProfileEditor at all (it gates on `!user` above).
// Concretely reproduced this while testing homeCountyId: the field
// defaulted to "Prefer not to say" for a user who did have one set, and
// hitting Save with the editor otherwise untouched would have silently
// wiped their real interests/traveler type/home county back to empty.
function ProfileEditor({ user }: { user: AuthUser }) {
  const { updateProfile } = useAuth();
  const [open, setOpen] = useState(false);
  const [travelerType, setTravelerType] = useState<TravelerType | ''>(user.travelerType ?? '');
  const [interests, setInterests] = useState<string[]>(user.interests ?? []);
  const [homeCountyId, setHomeCountyId] = useState(user.homeCounty?.id ?? '');
  const [categories, setCategories] = useState<Category[]>([]);
  const [counties, setCounties] = useState<County[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (open && categories.length === 0) {
      getCategories().then(setCategories);
    }
    if (open && counties.length === 0) {
      getCounties().then(setCounties);
    }
  }, [open, categories.length, counties.length]);

  function toggleInterest(slug: string) {
    setInterests((prev) => (prev.includes(slug) ? prev.filter((s) => s !== slug) : [...prev, slug]));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    setSuccess(false);
    try {
      await updateProfile({
        travelerType: travelerType || undefined,
        interests,
        homeCountyId: homeCountyId || undefined,
      });
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
          className="self-start text-sm font-medium text-brand-700 dark:text-brand-300 hover:underline"
        >
          Edit traveler type &amp; interests
        </button>
        {success && <p className="text-xs text-emerald-700 dark:text-emerald-300">Saved.</p>}
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3 rounded-xl border border-slate-200 dark:border-slate-800 p-3">
      <label className="flex flex-col gap-1 text-sm font-medium text-slate-700 dark:text-slate-200">
        Traveler type
        <TravelerTypeSelect value={travelerType} onChange={setTravelerType} />
      </label>
      {counties.length > 0 && (
        <label className="flex flex-col gap-1 text-sm font-medium text-slate-700 dark:text-slate-200">
          Home county
          <CountySelect value={homeCountyId} onChange={setHomeCountyId} counties={counties} />
        </label>
      )}
      {categories.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <p className="text-sm font-medium text-slate-700 dark:text-slate-200">Interests</p>
          <InterestChips categories={categories} selected={interests} onToggle={toggleInterest} />
        </div>
      )}
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
          {submitting ? 'Saving…' : 'Save'}
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
