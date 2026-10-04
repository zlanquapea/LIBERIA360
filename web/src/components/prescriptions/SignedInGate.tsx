'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { BrandLoader } from '@/components/BrandLoader';

/** Loading and signed-out states shared by the health pages. */
export function SignedInGate({
  title,
  reason,
  children,
}: {
  title: string;
  reason: string;
  children: ReactNode;
}) {
  const { user, ready } = useAuth();
  if (!ready)
    return (
      <main className="flex min-h-[60vh] flex-col items-center justify-center gap-5 px-4">
        <BrandLoader />
      </main>
    );
  if (!user)
    return (
      <main className="mx-auto flex max-w-sm flex-col gap-4 px-4 py-16 text-center">
        <h1 className="text-xl font-bold text-slate-900 dark:text-slate-50">{title}</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">{reason}</p>
        <Link href="/login" className="btn-primary mx-auto min-h-11 px-6">
          Log in
        </Link>
      </main>
    );
  return <>{children}</>;
}
