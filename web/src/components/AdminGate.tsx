'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { BrandLoader } from './BrandLoader';

// Shared client-side gate for every /admin page (Tech Spec §7/§8) — mirrors
// the API's AdminGuard, but purely a UX nicety: the real enforcement is
// server-side (every admin/* endpoint 403s a non-admin token regardless of
// what this component renders).
export function AdminGate({ children }: { children: ReactNode }) {
  const { user, ready } = useAuth();

  if (!ready) {
    return (
      <main className="flex min-h-[70vh] flex-col items-center justify-center gap-5 px-4">
        <BrandLoader />
        <p className="text-sm font-medium tracking-wide text-slate-500 dark:text-slate-400">Loading…</p>
      </main>
    );
  }

  if (!user) {
    return (
      <main className="mx-auto flex max-w-sm flex-col gap-4 px-4 py-10 text-center">
        <h1 className="text-xl font-bold text-slate-900 dark:text-slate-50">Admin</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">Log in with an admin account to continue.</p>
        <Link
          href="/login"
          className="mx-auto rounded-full bg-brand-700 px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-800"
        >
          Log in
        </Link>
      </main>
    );
  }

  if (!user.isAdmin) {
    return (
      <main className="mx-auto flex max-w-sm flex-col gap-4 px-4 py-10 text-center">
        <h1 className="text-xl font-bold text-slate-900 dark:text-slate-50">Admin</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">This account doesn&apos;t have admin access.</p>
      </main>
    );
  }

  return <>{children}</>;
}
