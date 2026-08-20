'use client';

import { useState, type ReactNode } from 'react';
import { Bars3Icon, XMarkIcon } from '@heroicons/react/24/outline';
import { AdminGate } from '@/components/AdminGate';
import { AdminSidebar } from '@/components/AdminSidebar';
import { useAuth } from '@/hooks/useAuth';

// Shared shell for every /admin/* page — sidebar nav + the isAdmin gate,
// both previously duplicated (or, for the sidebar, simply absent) on each
// page individually. Switching sections no longer means navigating back
// to the dashboard home first.
//
// Responsive behavior: the grouped sidebar is tall enough (7 groups, most
// with submenus) that the old "horizontal scroll strip" mobile pattern
// stops working — below lg it's a slide-in drawer instead, opened from a
// small top bar that also carries the role badge so "which tier am I"
// stays visible without opening Team & Access to check.
export default function AdminLayout({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [drawerOpen, setDrawerOpen] = useState(false);

  return (
    <AdminGate>
      <div className="mx-auto flex max-w-7xl flex-col gap-6 px-4 py-6 lg:flex-row lg:items-start">
        <div className="flex items-center justify-between gap-3 lg:hidden">
          <button
            type="button"
            onClick={() => setDrawerOpen(true)}
            className="flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 dark:border-slate-700 dark:text-slate-200"
          >
            <Bars3Icon aria-hidden className="h-5 w-5" />
            Menu
          </button>
          {user && (
            <span
              className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                user.isSuperAdmin
                  ? 'bg-gold-400/20 text-gold-600 dark:text-gold-400'
                  : 'bg-brand-700/10 text-brand-700 dark:text-brand-300'
              }`}
            >
              {user.isSuperAdmin ? 'Super Admin' : 'Admin'}
            </span>
          )}
        </div>

        {drawerOpen && (
          <div className="fixed inset-0 z-40 lg:hidden">
            <button
              type="button"
              aria-label="Close menu"
              onClick={() => setDrawerOpen(false)}
              className="absolute inset-0 bg-slate-950/50"
            />
            <div className="absolute inset-y-0 left-0 flex w-72 max-w-[85vw] flex-col gap-4 overflow-y-auto bg-white p-4 shadow-xl dark:bg-slate-900">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-slate-900 dark:text-slate-50">
                  Admin menu
                </span>
                <button type="button" onClick={() => setDrawerOpen(false)} aria-label="Close">
                  <XMarkIcon aria-hidden className="h-5 w-5 text-slate-500" />
                </button>
              </div>
              <AdminSidebar onNavigate={() => setDrawerOpen(false)} />
            </div>
          </div>
        )}

        <div className="hidden lg:sticky lg:top-20 lg:block lg:shrink-0 lg:self-start">
          <AdminSidebar />
        </div>

        <div className="min-w-0 flex-1">{children}</div>
      </div>
    </AdminGate>
  );
}
