'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import { PencilIcon, TrashIcon } from '@heroicons/react/24/outline';
import { useAuth } from '@/hooks/useAuth';
import { deleteItinerary, getItinerary, removeItineraryStop, renameItinerary } from '@/lib/itinerary-api';
import { getFriendlyErrorMessage, isNotFoundError } from '@/lib/errors';
import { formatBudgetBand } from '@/lib/format';
import { ItineraryStops } from '@/components/ItineraryStops';
import { TripPeoplePanel } from '@/components/TripPeoplePanel';
import { AddTripStop } from '@/components/AddTripStop';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { SuccessBanner } from '@/components/SuccessBanner';
import type { ItineraryDetail } from '@/lib/types';

// Kept in sync with the same threshold on the trips list page — a trip
// with this many saved stops, or any collaborators at all, gets an extra
// type-to-confirm safeguard on deletion instead of a single click.
const SUBSTANTIAL_STOPS_THRESHOLD = 5;

const NOT_FOUND_MESSAGE = 'This trip is no longer available. It may have already been deleted.';

export default function TripDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { user, token, ready } = useAuth();
  const [itinerary, setItinerary] = useState<ItineraryDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const reload = useCallback(() => {
    if (!token) return;
    getItinerary(token, id)
      .then((result) => setItinerary(result))
      .catch((err) => setLoadError(getFriendlyErrorMessage(err, { notFoundMessage: NOT_FOUND_MESSAGE })));
  }, [token, id]);

  useEffect(() => {
    if (!ready || !token) {
      if (ready) setLoading(false);
      return;
    }
    let cancelled = false;
    getItinerary(token, id)
      .then((result) => {
        if (!cancelled) setItinerary(result);
      })
      .catch((err) => {
        if (!cancelled) {
          setLoadError(
            getFriendlyErrorMessage(err, {
              notFoundMessage: NOT_FOUND_MESSAGE,
              context: { action: 'load-itinerary', itineraryId: id },
            }),
          );
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [ready, token, id]);

  if (!ready || loading) {
    return (
      <main className="mx-auto flex max-w-3xl flex-col gap-4 px-4 py-6">
        <p className="text-sm text-slate-500 dark:text-slate-400">Loading…</p>
      </main>
    );
  }

  if (!user) {
    return (
      <main className="mx-auto flex max-w-sm flex-col gap-4 px-4 py-10 text-center">
        <p className="text-sm text-slate-500 dark:text-slate-400">
          <Link href="/login" className="font-medium text-brand-700 dark:text-brand-300 hover:underline">
            Log in
          </Link>{' '}
          to view this trip.
        </p>
      </main>
    );
  }

  if (loadError || !itinerary) {
    return (
      <main className="mx-auto flex max-w-3xl flex-col gap-4 px-4 py-6">
        <p className="rounded-lg bg-flag-500/10 px-3 py-2 text-sm text-flag-700 dark:text-flag-300">
          {loadError ?? NOT_FOUND_MESSAGE}
        </p>
        <Link href="/trips" className="text-sm font-medium text-brand-700 dark:text-brand-300 hover:underline">
          ← Back to My Trips
        </Link>
      </main>
    );
  }

  const isOwner = itinerary.userId === user.id;
  const isCollaborator = itinerary.collaborators.some((c) => c.id === user.id);
  const canEdit = isOwner || isCollaborator;

  async function handleRename(newTitle: string) {
    if (!token || !itinerary) return;
    const trimmed = newTitle.trim();
    if (!trimmed || trimmed === itinerary.title) return;
    setActionError(null);
    try {
      await renameItinerary(token, itinerary.id, trimmed);
      reload();
    } catch (err) {
      setActionError(
        getFriendlyErrorMessage(err, {
          notFoundMessage: NOT_FOUND_MESSAGE,
          context: { action: 'rename-itinerary', itineraryId: itinerary.id },
        }),
      );
    }
  }

  async function handleDeleteConfirmed() {
    if (!token || !itinerary) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      await deleteItinerary(token, itinerary.id);
      finishDelete('Trip deleted successfully.');
    } catch (err) {
      if (isNotFoundError(err)) {
        // Already gone — that's the outcome the user wanted, just not by
        // this click (another tab, another device, a previous attempt
        // that actually succeeded before the response came back).
        finishDelete('This trip was already deleted.');
      } else {
        setDeleteError(
          getFriendlyErrorMessage(err, { context: { action: 'delete-itinerary', itineraryId: itinerary.id } }),
        );
        setDeleting(false);
      }
    }
  }

  function finishDelete(message: string) {
    setConfirmingDelete(false);
    setDeleting(false);
    setSuccessMessage(message);
    // Give the confirmation a beat to register before navigating away,
    // rather than yanking the user straight back to the list.
    setTimeout(() => router.push('/trips'), 900);
  }

  const collaboratorCount = itinerary.collaborators.length;
  const consequences =
    collaboratorCount > 0
      ? [`${collaboratorCount} ${collaboratorCount === 1 ? 'person' : 'people'} will lose access to this trip.`]
      : undefined;
  const requiresTypedConfirmation = itinerary.stops.length >= SUBSTANTIAL_STOPS_THRESHOLD || collaboratorCount > 0;

  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-6 px-4 py-6">
      <div>
        <div className="flex items-center justify-between gap-3">
          <Link href="/trips" className="text-sm font-medium text-brand-700 dark:text-brand-300 hover:underline">
            ← My Trips
          </Link>
          {isOwner && (
            <button
              type="button"
              onClick={() => setConfirmingDelete(true)}
              className="flex items-center gap-1 rounded-full border border-flag-300 px-3 py-1.5 text-xs font-semibold text-flag-700 hover:bg-flag-500/10 dark:border-flag-600 dark:text-flag-300"
            >
              <TrashIcon aria-hidden className="h-3.5 w-3.5" />
              Delete trip
            </button>
          )}
        </div>

        <TripTitle title={itinerary.title} editable={canEdit} onRename={handleRename} />

        <p className="text-sm text-slate-500 dark:text-slate-400">
          {itinerary.durationDays} day{itinerary.durationDays === 1 ? '' : 's'} · {formatBudgetBand(itinerary.budgetBand)}
          {itinerary.interests.length > 0 && ` · ${itinerary.interests.join(', ')}`}
          {!isOwner && isCollaborator && ' · Shared with you'}
        </p>

        {successMessage && (
          <div className="mt-2">
            <SuccessBanner>{successMessage}</SuccessBanner>
          </div>
        )}
        {actionError && <p className="mt-2 text-xs text-flag-700 dark:text-flag-300">{actionError}</p>}
      </div>

      <TripPeoplePanel
        itineraryId={itinerary.id}
        collaborators={itinerary.collaborators}
        isOwner={isOwner}
        onChange={reload}
      />

      <ItineraryStops
        stops={itinerary.stops}
        onRemove={
          canEdit
            ? async (placeId) => {
                if (!token) return;
                await removeItineraryStop(token, itinerary.id, placeId);
                reload();
              }
            : undefined
        }
      />

      {canEdit && (
        <AddTripStop itineraryId={itinerary.id} durationDays={itinerary.durationDays} onAdded={reload} />
      )}

      <ConfirmDialog
        open={confirmingDelete}
        title={`Delete "${itinerary.title}"?`}
        description="This will permanently delete this trip, including its itinerary, saved plans, and associated trip information."
        consequences={consequences}
        confirmationPhrase={requiresTypedConfirmation ? itinerary.title : undefined}
        confirmLabel="Delete Trip"
        loadingLabel="Deleting trip…"
        isLoading={deleting}
        error={deleteError}
        onConfirm={handleDeleteConfirmed}
        onCancel={() => {
          if (deleting) return;
          setConfirmingDelete(false);
          setDeleteError(null);
        }}
      />
    </main>
  );
}

// Click-to-edit trip title — owner or any collaborator (shared planning
// metadata, same tier as editing a stop's notes). Generated trips default
// to a generic title ("5-Day Liberia Trip"), so this is the only way to
// turn it into something that actually means something to the people
// planning it.
function TripTitle({
  title,
  editable,
  onRename,
}: {
  title: string;
  editable: boolean;
  onRename: (title: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(title);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setDraft(title);
  }, [title]);

  useEffect(() => {
    if (editing) inputRef.current?.select();
  }, [editing]);

  function commit() {
    setEditing(false);
    onRename(draft);
  }

  if (!editable) {
    return <h1 className="mt-1 text-xl font-bold text-slate-900 dark:text-slate-50">{title}</h1>;
  }

  if (editing) {
    return (
      <input
        ref={inputRef}
        type="text"
        value={draft}
        maxLength={200}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            commit();
          } else if (e.key === 'Escape') {
            setDraft(title);
            setEditing(false);
          }
        }}
        className="mt-1 w-full rounded-lg border border-brand-500 bg-transparent px-2 py-0.5 text-xl font-bold text-slate-900 outline-none ring-1 ring-brand-500 dark:text-slate-50"
      />
    );
  }

  return (
    <button
      type="button"
      onClick={() => setEditing(true)}
      className="group mt-1 flex items-center gap-1.5 text-left"
      aria-label={`Rename trip (currently "${title}")`}
    >
      <h1 className="text-xl font-bold text-slate-900 dark:text-slate-50">{title}</h1>
      <PencilIcon
        aria-hidden
        className="h-4 w-4 shrink-0 text-slate-300 opacity-0 transition-opacity group-hover:opacity-100 dark:text-slate-600"
      />
    </button>
  );
}
