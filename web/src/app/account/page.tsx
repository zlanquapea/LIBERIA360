'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';

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

      <dl className="flex flex-col divide-y divide-slate-100 rounded-xl border border-slate-200 text-sm">
        <div className="flex justify-between px-4 py-3">
          <dt className="text-slate-500">Home county</dt>
          <dd className="font-medium text-slate-900">{user.homeCounty?.name ?? 'Not set'}</dd>
        </div>
        <div className="flex justify-between px-4 py-3">
          <dt className="text-slate-500">Member since</dt>
          <dd className="font-medium text-slate-900">
            {new Date(user.createdAt).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
          </dd>
        </div>
      </dl>

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
