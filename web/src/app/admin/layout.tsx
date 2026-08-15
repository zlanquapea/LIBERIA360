'use client';

import type { ReactNode } from 'react';
import { AdminGate } from '@/components/AdminGate';
import { AdminSidebar } from '@/components/AdminSidebar';

// Shared shell for every /admin/* page — sidebar nav + the isAdmin gate,
// both previously duplicated (or, for the sidebar, simply absent) on each
// page individually. Switching sections no longer means navigating back
// to the dashboard home first.
export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <AdminGate>
      <div className="mx-auto flex max-w-5xl flex-col gap-6 px-4 py-6 lg:flex-row lg:items-start">
        <AdminSidebar />
        <div className="min-w-0 flex-1">{children}</div>
      </div>
    </AdminGate>
  );
}
