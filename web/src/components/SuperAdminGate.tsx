'use client';

import type { ReactNode } from 'react';
import { useAuth } from '@/hooks/useAuth';

// Same shape as AdminGate, one tier up — for /admin/team, which the API's
// SuperAdminGuard 403s a plain admin out of. This component assumes it's
// already inside an AdminGate (admin/layout.tsx wraps every /admin/*
// route), so it doesn't repeat the not-logged-in / loading states.
export function SuperAdminGate({ children }: { children: ReactNode }) {
  const { user } = useAuth();

  if (!user?.isSuperAdmin) {
    return (
      <div className="flex flex-col gap-2 rounded-xl border border-dashed border-slate-300 px-4 py-8 text-center">
        <p className="font-medium text-slate-700">Super admin access required</p>
        <p className="text-sm text-slate-500">Ask a super admin to grant it if you need to be here.</p>
      </div>
    );
  }

  return <>{children}</>;
}
