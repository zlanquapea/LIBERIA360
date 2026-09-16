"use client";

import Link from "next/link";
import { ChartBarIcon } from "@heroicons/react/24/solid";
import { useAuth } from "@/hooks/useAuth";

export function CreatorDashboardShortcut({
  ownerUserId,
}: {
  ownerUserId: string | null | undefined;
}) {
  const { user, ready } = useAuth();

  if (!ready || !ownerUserId || user?.id !== ownerUserId) return null;

  return (
    <Link
      href="/creators/me"
      className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl border border-brand-200 bg-brand-50 px-4 py-2.5 text-sm font-semibold text-brand-800 hover:border-brand-400 hover:bg-brand-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 dark:border-brand-800 dark:bg-brand-950/30 dark:text-brand-200 dark:hover:bg-brand-950/60"
    >
      <ChartBarIcon
        aria-hidden
        className="h-5 w-5 text-brand-600 dark:text-brand-300"
      />
      Creator dashboard
    </Link>
  );
}
