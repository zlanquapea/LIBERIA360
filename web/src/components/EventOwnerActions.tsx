'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { deleteEvent } from '@/lib/event-api';
import { getFriendlyErrorMessage, isNotFoundError } from '@/lib/errors';
import { ConfirmDialog } from './ConfirmDialog';
import type { Event } from '@/lib/types';

// Self-service edit/cancel for the event's organizer (or an admin),
// embedded in the public detail page — previously the only way to fix or
// remove an event was asking an admin. Editing itself happens on the "My
// Events" account page (same inline-edit pattern as "My Places"), so this
// only needs to surface the entry point plus the cancel action, which acts
// directly on this page.
export function EventOwnerActions({ event }: { event: Event }) {
  const router = useRouter();
  const { user, token } = useAuth();
  const [pendingCancel, setPendingCancel] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!user || !token) return null;
  const canManage = user.id === event.createdBy?.id || user.isAdmin;
  if (!canManage) return null;

  async function confirmCancel() {
    if (!token) return;
    setIsLoading(true);
    setError(null);
    try {
      await deleteEvent(token, event.id);
      router.push('/events');
    } catch (err) {
      if (isNotFoundError(err)) {
        router.push('/events');
        return;
      }
      setError(getFriendlyErrorMessage(err, { context: { action: 'cancel-event', eventId: event.id } }));
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="flex items-center justify-between gap-2 rounded-xl border border-dashed border-slate-300 dark:border-slate-700 px-3 py-2 text-xs text-slate-600 dark:text-slate-300">
      <span>You manage this event.</span>
      <div className="flex shrink-0 gap-3">
        <Link href="/account/my-events" className="font-medium text-brand-700 dark:text-brand-300 hover:underline">
          Edit
        </Link>
        <button
          type="button"
          onClick={() => setPendingCancel(true)}
          className="font-medium text-flag-700 dark:text-flag-300 hover:underline"
        >
          Cancel event
        </button>
      </div>

      <ConfirmDialog
        open={pendingCancel}
        title={`Cancel "${event.name}"?`}
        description="This removes the event listing for everyone. Anyone who was planning around it won't be notified."
        confirmLabel="Cancel Event"
        loadingLabel="Cancelling…"
        isLoading={isLoading}
        error={error}
        onConfirm={confirmCancel}
        onCancel={() => {
          if (isLoading) return;
          setPendingCancel(false);
          setError(null);
        }}
      />
    </div>
  );
}
