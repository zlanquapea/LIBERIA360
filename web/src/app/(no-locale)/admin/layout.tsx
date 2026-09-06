"use client";

import { useState, type ReactNode } from "react";
import { Bars3Icon, XMarkIcon } from "@heroicons/react/24/outline";
import { StarIcon } from "@heroicons/react/24/solid";
import { AdminGate } from "@/components/AdminGate";
import { AdminSidebar } from "@/components/AdminSidebar";
import { useAuth } from "@/hooks/useAuth";

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
      <div className="min-h-[calc(100vh-4rem)] bg-slate-50/70 dark:bg-slate-950/20">
        <div className="mx-auto flex max-w-7xl flex-col gap-5 px-3 py-4 sm:px-6 sm:py-6 lg:flex-row lg:items-start lg:gap-8 lg:px-8 lg:py-8">
          <div className="flex items-center justify-between gap-3 lg:hidden">
            <button
              type="button"
              onClick={() => setDrawerOpen(true)}
              aria-label="Open admin menu"
              aria-expanded={drawerOpen}
              aria-controls="admin-mobile-menu"
              className="inline-flex h-14 w-14 items-center justify-center rounded-2xl border border-slate-200 bg-white text-brand-950 shadow-sm hover:border-brand-300 hover:bg-brand-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-50 dark:hover:bg-slate-800"
            >
              <Bars3Icon aria-hidden className="h-7 w-7" />
            </button>
            {user && (
              <span
                className={`inline-flex items-center gap-2 rounded-full border px-4 py-2.5 text-sm font-bold shadow-sm ${
                  user.isSuperAdmin
                    ? "border-gold-400/50 bg-gold-50 text-gold-700 dark:bg-gold-400/15 dark:text-gold-300"
                    : "border-brand-300/50 bg-brand-700/10 text-brand-700 dark:border-brand-700 dark:text-brand-300"
                }`}
              >
                {user.isSuperAdmin && <StarIcon aria-hidden className="h-4 w-4" />}
                {user.isSuperAdmin ? "Super Admin" : "Admin"}
              </span>
            )}
          </div>

          {drawerOpen && (
            <div className="fixed inset-x-0 bottom-0 top-16 z-40 lg:hidden">
              <button
                type="button"
                aria-label="Close menu"
                onClick={() => setDrawerOpen(false)}
                className="absolute inset-0 bg-slate-950/55"
              />
              <div
                id="admin-mobile-menu"
                className="absolute inset-y-0 left-0 flex w-80 max-w-[88vw] flex-col gap-5 overflow-y-auto bg-white p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] shadow-2xl dark:bg-slate-900"
              >
                <div className="flex items-center justify-between border-b border-slate-200 pb-4 dark:border-slate-800">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-[0.18em] text-brand-700 dark:text-brand-300">
                      Control center
                    </p>
                    <p className="mt-1 text-sm font-semibold text-slate-900 dark:text-slate-50">
                      Admin menu
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setDrawerOpen(false)}
                    aria-label="Close admin menu"
                    className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100 hover:text-slate-900 dark:hover:bg-slate-800 dark:hover:text-slate-50"
                  >
                    <XMarkIcon aria-hidden className="h-5 w-5" />
                  </button>
                </div>
                <AdminSidebar onNavigate={() => setDrawerOpen(false)} />
              </div>
            </div>
          )}

          <div className="hidden lg:sticky lg:top-20 lg:block lg:shrink-0 lg:self-start">
            <div className="w-64 rounded-3xl border border-slate-200 bg-white p-3 shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <div className="mb-3 border-b border-slate-100 px-3 pb-3 dark:border-slate-800">
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-brand-700 dark:text-brand-300">
                  Control center
                </p>
                <p className="mt-1 text-sm font-semibold text-slate-900 dark:text-slate-50">
                  Liberia360 Admin
                </p>
              </div>
              <AdminSidebar />
            </div>
          </div>

          <div className="min-w-0 flex-1">{children}</div>
        </div>
      </div>
    </AdminGate>
  );
}
