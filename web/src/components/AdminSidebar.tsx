'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { ChevronDownIcon } from '@heroicons/react/24/outline';
import { useAuth } from '@/hooks/useAuth';
import { visibleAdminNav, type AdminNavGroup } from '@/lib/admin-nav';

const STORAGE_KEY = 'liberia360:admin-nav-expanded';

function loadExpanded(): Set<string> {
  if (typeof window === 'undefined') return new Set();
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? new Set(JSON.parse(raw)) : new Set();
  } catch {
    return new Set();
  }
}

function groupContainingPath(groups: AdminNavGroup[], pathname: string): string | null {
  for (const group of groups) {
    if (group.items?.some((item) => pathname.startsWith(item.href.split('?')[0]))) {
      return group.id;
    }
  }
  return null;
}

// Collapsible, grouped nav (Tech Spec: "Modern Admin Navigation") — a
// small number of high-level groups, each expandable to reveal its real
// submenus, driven entirely by admin-nav.ts + capabilities.ts so a group
// with nothing this user can do simply isn't rendered. Expand state is
// per-browser (localStorage), and the group containing the current page
// auto-expands on load/navigation so a direct link never lands "hidden"
// inside a collapsed group.
export function AdminSidebar({ onNavigate }: { onNavigate?: () => void } = {}) {
  const pathname = usePathname();
  const { user } = useAuth();
  const groups = visibleAdminNav(user);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  useEffect(() => {
    setExpanded(loadExpanded());
  }, []);

  useEffect(() => {
    const activeGroup = groupContainingPath(groups, pathname);
    if (activeGroup) {
      setExpanded((prev) => (prev.has(activeGroup) ? prev : new Set(prev).add(activeGroup)));
    }
    // Only re-run when the path changes — re-running on every `groups`
    // identity change would fight the user's own collapse/expand clicks.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  function toggle(groupId: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(groupId)) next.delete(groupId);
      else next.add(groupId);
      try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify([...next]));
      } catch {
        // localStorage can throw in private-browsing contexts — expand
        // state just won't persist, nothing else breaks.
      }
      return next;
    });
  }

  return (
    <nav className="flex w-full flex-col gap-1 lg:w-64">
      {groups.map((group) => {
        const Icon = group.icon;

        if (!group.items) {
          const active = pathname === group.href;
          return (
            <Link
              key={group.id}
              href={group.href!}
              onClick={onNavigate}
              aria-current={active ? 'page' : undefined}
              className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                active
                  ? 'bg-brand-700 text-white'
                  : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'
              }`}
            >
              <Icon aria-hidden className="h-5 w-5 shrink-0" />
              {group.label}
            </Link>
          );
        }

        const isExpanded = expanded.has(group.id);
        const groupActive = group.items.some((item) => pathname.startsWith(item.href.split('?')[0]));

        return (
          <div key={group.id} className="flex flex-col">
            <button
              type="button"
              onClick={() => toggle(group.id)}
              aria-expanded={isExpanded}
              className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-semibold transition-colors ${
                groupActive
                  ? 'text-brand-700 dark:text-brand-300'
                  : 'text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800'
              }`}
            >
              <Icon aria-hidden className="h-5 w-5 shrink-0" />
              <span className="flex-1 text-left">{group.label}</span>
              <ChevronDownIcon
                aria-hidden
                className={`h-4 w-4 shrink-0 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
              />
            </button>
            {isExpanded && (
              <div className="ml-4 flex flex-col gap-0.5 border-l border-slate-200 py-1 pl-4 dark:border-slate-800">
                {group.items.map((item) => {
                  const active = pathname.startsWith(item.href.split('?')[0]);
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={onNavigate}
                      aria-current={active ? 'page' : undefined}
                      className={`rounded-lg px-3 py-1.5 text-sm transition-colors ${
                        active
                          ? 'bg-brand-50 font-medium text-brand-700 dark:bg-brand-900/40 dark:text-brand-200'
                          : 'text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800'
                      }`}
                    >
                      {item.label}
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </nav>
  );
}
