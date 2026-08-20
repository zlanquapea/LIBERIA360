'use client';

import { useEffect, useState } from 'react';
import { SuperAdminGate } from '@/components/SuperAdminGate';
import { useAuth } from '@/hooks/useAuth';
import { getUsers } from '@/lib/admin-api';
import type { AuthUser } from '@/lib/types';
import { AdminPageHeader, EmptyState, LoadingState } from '@/components/admin-ui';

const PAGE_SIZE = 20;

// Users & Roles > Users — every account (not just admins; that's
// Administrators/getTeamRoster). Read-only here: role changes stay on
// the Administrators page, which already has the guard rails (can't
// strand the last super admin, etc.) — this page is for finding and
// understanding who's on the platform, not managing access. Super admin
// only, matching GET /admin/users's guard.
export default function AdminUsersPage() {
  return (
    <SuperAdminGate>
      <UsersList />
    </SuperAdminGate>
  );
}

function UsersList() {
  const { token } = useAuth();
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [page, setPage] = useState(1);
  const [result, setResult] = useState<{ data: AuthUser[]; meta: { total: number; totalPages: number } } | null>(
    null,
  );

  useEffect(() => {
    const id = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(id);
  }, [search]);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch]);

  useEffect(() => {
    if (!token) return;
    setResult(null);
    getUsers(token, { page, limit: PAGE_SIZE, search: debouncedSearch || undefined }).then(setResult);
  }, [token, page, debouncedSearch]);

  return (
    <div className="flex flex-col gap-6">
      <AdminPageHeader
        title="Users"
        description={result ? `${result.meta.total} account${result.meta.total === 1 ? '' : 's'}` : undefined}
      />

      <input
        placeholder="Search by name or email…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="w-full max-w-sm rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 dark:border-slate-700"
      />

      {!result ? (
        <LoadingState />
      ) : result.data.length === 0 ? (
        <EmptyState title="No users match." />
      ) : (
        <>
          <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                <tr>
                  <th className="px-4 py-2">Name</th>
                  <th className="px-4 py-2">Email</th>
                  <th className="px-4 py-2">Role</th>
                  <th className="px-4 py-2">Traveler type</th>
                  <th className="px-4 py-2">2FA</th>
                  <th className="px-4 py-2">Joined</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {result.data.map((user) => (
                  <tr key={user.id}>
                    <td className="px-4 py-2.5 font-medium text-slate-900 dark:text-slate-50">{user.name}</td>
                    <td className="px-4 py-2.5 text-slate-500 dark:text-slate-400">{user.email}</td>
                    <td className="px-4 py-2.5 text-slate-500 dark:text-slate-400">
                      {user.isSuperAdmin ? 'Super Admin' : user.isAdmin ? 'Admin' : '—'}
                    </td>
                    <td className="px-4 py-2.5 text-slate-500 dark:text-slate-400">
                      {user.travelerType?.replace(/_/g, ' ') ?? '—'}
                    </td>
                    <td className="px-4 py-2.5 text-slate-500 dark:text-slate-400">{user.twoFactorEnabled ? 'Enabled' : '—'}</td>
                    <td className="px-4 py-2.5 text-slate-500 dark:text-slate-400">
                      {new Date(user.createdAt).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {result.meta.totalPages > 1 && (
            <div className="flex items-center justify-between text-sm">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
                className="rounded-full border border-slate-300 px-3 py-1.5 font-medium text-slate-700 disabled:opacity-40 dark:border-slate-700 dark:text-slate-200"
              >
                ← Previous
              </button>
              <span className="text-slate-500 dark:text-slate-400">
                Page {page} of {result.meta.totalPages}
              </span>
              <button
                type="button"
                disabled={page >= result.meta.totalPages}
                onClick={() => setPage((p) => p + 1)}
                className="rounded-full border border-slate-300 px-3 py-1.5 font-medium text-slate-700 disabled:opacity-40 dark:border-slate-700 dark:text-slate-200"
              >
                Next →
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
