'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { PencilIcon, TrashIcon, MapPinIcon, XCircleIcon } from '@heroicons/react/24/outline';
import { useAuth } from '@/hooks/useAuth';
import {
  cancelTrip,
  deleteItinerary,
  getItinerary,
  getPublicTrip,
  removeItineraryStop,
  renameItinerary,
  requestToJoinTrip,
} from '@/lib/itinerary-api';
import { getFriendlyErrorMessage, isNotFoundError } from '@/lib/errors';
import { formatBudgetBand, formatTripDateRange, formatTripStatus, formatTripVisibility } from '@/lib/format';
import { ItineraryStops } from '@/components/ItineraryStops';
import { BrandLoader } from '@/components/BrandLoader';
import { TripPeoplePanel } from '@/components/TripPeoplePanel';
import { TripChatPanel } from '@/components/TripChatPanel';
import { AddTripStop } from '@/components/AddTripStop';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { SuccessBanner } from '@/components/SuccessBanner';
import { ShareMenu } from '@/components/ShareMenu';
import { TripShareCard, tripHasShareableContent } from '@/components/TripShareCard';
import type { ItineraryDetail, Place, PublicTripDetail, TripStatus, TripVisibility } from '@/lib/types';

// Kept in sync with the same threshold on the trips list page — a trip
// with this many saved stops, or any collaborators at all, gets an extra
// type-to-confirm safeguard on deletion instead of a single click.
const SUBSTANTIAL_STOPS_THRESHOLD = 5;

const STATUS_BADGE_STYLES: Record<TripStatus, string> = {
  upcoming: 'bg-brand-100 text-brand-800 dark:bg-brand-950/40 dark:text-brand-200',
  ongoing: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300',
  completed: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300',
  cancelled: 'bg-flag-500/10 text-flag-700 dark:text-flag-300',
};

const VISIBILITY_BADGE_STYLES: Record<TripVisibility, string> = {
  public: 'bg-sky-100 text-sky-700 dark:bg-sky-950/40 dark:text-sky-300',
  private: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300',
};

// The interactive trip detail experience — member view (rename, delete,
// stops, people panel, chat) or the public/restricted view for a
// non-member — behind a real backend call needing `id` at hand, so this
// stays client-side (member vs. public vs. private-restricted can only be
// told apart once we know whether the viewer is signed in and a member).
// The route's page.tsx wraps this to add per-trip <head> metadata, which
// Next.js only generates from a Server Component.
export function TripDetailClient({ id }: { id: string }) {
  const t = useTranslations('trips');
  const tCommon = useTranslations('common');
  const notFoundMessage = t('notFoundMessage');
  const router = useRouter();
  const { user, token, ready } = useAuth();

  const [itinerary, setItinerary] = useState<ItineraryDetail | null>(null);
  const [publicTrip, setPublicTrip] = useState<PublicTripDetail | null>(null);
  const [restricted, setRestricted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const [confirmingCancel, setConfirmingCancel] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [cancelError, setCancelError] = useState<string | null>(null);

  const [joinRequestState, setJoinRequestState] = useState<'idle' | 'sending' | 'sent'>('idle');
  const [joinRequestError, setJoinRequestError] = useState<string | null>(null);

  // A member reload (after renaming, adding a stop, a collaborator
  // change, …) only ever needs the fully-guarded member endpoint — it
  // never has to re-run the public-trip fallback dance below, since a
  // trip that just loaded as a member is still one.
  const reload = useCallback(() => {
    if (!token) return;
    getItinerary(token, id)
      .then((result) => setItinerary(result))
      .catch((err) => setLoadError(getFriendlyErrorMessage(err, { notFoundMessage })));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, id]);

  useEffect(() => {
    if (!ready) return;
    let cancelled = false;

    function loadPublic() {
      return getPublicTrip(id)
        .then((result) => {
          if (cancelled) return;
          if ('visibility' in result) {
            // RestrictedTripPreview — a real trip, but private, and this
            // viewer isn't on it (Section 15 of the Aug 2026 spec).
            setRestricted(true);
          } else {
            setPublicTrip(result);
          }
        })
        .catch((err) => {
          if (!cancelled) {
            setLoadError(
              getFriendlyErrorMessage(err, {
                notFoundMessage,
                context: { action: 'load-public-trip', itineraryId: id },
              }),
            );
          }
        });
    }

    const finish = () => {
      if (!cancelled) setLoading(false);
    };

    if (token) {
      getItinerary(token, id)
        .then((result) => {
          if (!cancelled) setItinerary(result);
        })
        .catch((err) => {
          if (cancelled) return;
          // Not a member (or the trip doesn't exist) — getItinerary 404s
          // for both by design, so fall back to the always-unauthenticated
          // public endpoint to tell the two apart.
          if (isNotFoundError(err)) return loadPublic();
          setLoadError(
            getFriendlyErrorMessage(err, {
              notFoundMessage,
              context: { action: 'load-itinerary', itineraryId: id },
            }),
          );
        })
        .finally(finish);
    } else {
      loadPublic().finally(finish);
    }

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, token, id]);

  if (!ready || loading) {
    return (
      <main className="flex min-h-[70vh] flex-col items-center justify-center gap-5 px-4">
        <BrandLoader />
        <p className="text-sm font-medium tracking-wide text-slate-500 dark:text-slate-400">{tCommon('loading')}</p>
      </main>
    );
  }

  if (restricted) {
    return (
      <main className="mx-auto flex max-w-sm flex-col gap-3 px-4 py-10 text-center">
        <p className="text-lg font-bold text-slate-900 dark:text-slate-50">{t('privateTripTitle')}</p>
        <p className="text-sm text-slate-500 dark:text-slate-400">{t('privateTripDescription')}</p>
        <Link href="/trips" className="text-sm font-medium text-brand-700 dark:text-brand-300 hover:underline">
          ← {t('backToMyTrips')}
        </Link>
      </main>
    );
  }

  if (loadError || (!itinerary && !publicTrip)) {
    return (
      <main className="mx-auto flex max-w-3xl flex-col gap-4 px-4 py-6">
        <p className="rounded-lg bg-flag-500/10 px-3 py-2 text-sm text-flag-700 dark:text-flag-300">
          {loadError ?? notFoundMessage}
        </p>
        <Link href="/trips" className="text-sm font-medium text-brand-700 dark:text-brand-300 hover:underline">
          ← {t('backToMyTrips')}
        </Link>
      </main>
    );
  }

  if (itinerary) {
    return (
      <MemberTripView
        itinerary={itinerary}
        user={user}
        token={token}
        router={router}
        reload={reload}
        actionError={actionError}
        setActionError={setActionError}
        successMessage={successMessage}
        setSuccessMessage={setSuccessMessage}
        confirmingDelete={confirmingDelete}
        setConfirmingDelete={setConfirmingDelete}
        deleting={deleting}
        setDeleting={setDeleting}
        deleteError={deleteError}
        setDeleteError={setDeleteError}
        confirmingCancel={confirmingCancel}
        setConfirmingCancel={setConfirmingCancel}
        cancelling={cancelling}
        setCancelling={setCancelling}
        cancelError={cancelError}
        setCancelError={setCancelError}
      />
    );
  }

  // Non-member view — a public trip a stranger (signed in or not) can
  // browse and ask to join (Sections 5-6, 8, 17). `publicTrip` is
  // guaranteed set here (the loadError/not-found case returned above).
  const trip = publicTrip as PublicTripDetail;
  const isAdmin = user?.id === trip.admin?.id;

  async function handleRequestToJoin() {
    if (!token) return;
    setJoinRequestState('sending');
    setJoinRequestError(null);
    try {
      await requestToJoinTrip(token, trip.id);
      setJoinRequestState('sent');
    } catch (err) {
      setJoinRequestState('idle');
      setJoinRequestError(getFriendlyErrorMessage(err, { context: { action: 'request-to-join', itineraryId: trip.id } }));
    }
  }

  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-6 px-4 py-6">
      <div>
        <Link href="/trips/community" className="text-sm font-medium text-brand-700 dark:text-brand-300 hover:underline">
          ← {t('backToCommunityTrips')}
        </Link>

        <div className="mt-1 flex flex-wrap items-center gap-2">
          <h1 className="text-xl font-bold text-slate-900 dark:text-slate-50">{trip.title}</h1>
          <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${VISIBILITY_BADGE_STYLES.public}`}>{t('visibilityPublic')}</span>
          <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${STATUS_BADGE_STYLES[trip.status]}`}>
            {formatTripStatus(trip.status)}
          </span>
        </div>

        <TripMeta trip={trip} />

        {trip.description && <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">{trip.description}</p>}

        <div className="mt-3 flex flex-wrap items-center gap-3">
          <div className="h-10 w-10">
            <ShareMenu placeName={trip.title} contentType="trip" />
          </div>
          {tripHasShareableContent(trip) && (
            <div className="h-10 w-10">
              <TripShareCard trip={trip} />
            </div>
          )}
          {!isAdmin && trip.status !== 'cancelled' && (
            <>
              {!user ? (
                <Link
                  href={`/login?next=/trips/${trip.id}`}
                  className="rounded-full bg-brand-700 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-800"
                >
                  {t('logInToJoin')}
                </Link>
              ) : joinRequestState === 'sent' ? (
                <p className="text-sm font-medium text-emerald-700 dark:text-emerald-300">{t('requestSent')}</p>
              ) : (
                <button
                  type="button"
                  disabled={joinRequestState === 'sending'}
                  onClick={handleRequestToJoin}
                  className="rounded-full bg-brand-700 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-800 disabled:opacity-60"
                >
                  {joinRequestState === 'sending' ? t('sendingRequest') : t('requestToJoin')}
                </button>
              )}
            </>
          )}
        </div>
        {joinRequestError && <p className="mt-2 text-xs text-flag-700 dark:text-flag-300">{joinRequestError}</p>}
      </div>

      <p className="text-sm text-slate-500 dark:text-slate-400">
        {t('goingCount', { count: trip.participantCount })}
        {trip.admin && ` · ${t('organizedBy', { name: trip.admin.name })}`}
      </p>

      <ItineraryStops stops={trip.stops} />
    </main>
  );
}

// Shared destination + dates block — used by both the member and public
// trip views. Destination is always a real catalog Place now (Section 2
// of the Aug 2026 spec), so it's always a tap-through to that place's own
// page — where its map and "get directions" link already live — rather
// than duplicating that UI here.
function TripMeta({
  trip,
}: {
  trip: { destination: Place | null; startDate: string | null; endDate: string | null };
}) {
  const dateRange = formatTripDateRange(trip.startDate, trip.endDate);
  return (
    <p className="mt-1 flex flex-wrap items-center gap-x-1.5 text-sm text-slate-500 dark:text-slate-400">
      {trip.destination && (
        <Link
          href={`/places/${trip.destination.slug}`}
          className="inline-flex items-center gap-1 font-medium text-brand-700 hover:underline dark:text-brand-300"
        >
          <MapPinIcon aria-hidden className="h-3.5 w-3.5" />
          {trip.destination.name}
        </Link>
      )}
      {trip.destination && dateRange && <span aria-hidden>·</span>}
      {dateRange && <span>{dateRange}</span>}
    </p>
  );
}

// The full member/collaborator/owner experience — everything the old
// page did (rename, delete, stops, people panel) plus the new social
// fields and the owner-only Cancel Trip action.
function MemberTripView({
  itinerary,
  user,
  token,
  router,
  reload,
  actionError,
  setActionError,
  successMessage,
  setSuccessMessage,
  confirmingDelete,
  setConfirmingDelete,
  deleting,
  setDeleting,
  deleteError,
  setDeleteError,
  confirmingCancel,
  setConfirmingCancel,
  cancelling,
  setCancelling,
  cancelError,
  setCancelError,
}: {
  itinerary: ItineraryDetail;
  user: { id: string } | null;
  token: string | null;
  router: ReturnType<typeof useRouter>;
  reload: () => void;
  actionError: string | null;
  setActionError: (v: string | null) => void;
  successMessage: string | null;
  setSuccessMessage: (v: string | null) => void;
  confirmingDelete: boolean;
  setConfirmingDelete: (v: boolean) => void;
  deleting: boolean;
  setDeleting: (v: boolean) => void;
  deleteError: string | null;
  setDeleteError: (v: string | null) => void;
  confirmingCancel: boolean;
  setConfirmingCancel: (v: boolean) => void;
  cancelling: boolean;
  setCancelling: (v: boolean) => void;
  cancelError: string | null;
  setCancelError: (v: string | null) => void;
}) {
  const t = useTranslations('trips');
  const isOwner = itinerary.userId === user?.id;
  const isCollaborator = itinerary.collaborators.some((c) => c.id === user?.id);
  const canEdit = isOwner || isCollaborator;

  async function handleRename(newTitle: string) {
    if (!token) return;
    const trimmed = newTitle.trim();
    if (!trimmed || trimmed === itinerary.title) return;
    setActionError(null);
    try {
      await renameItinerary(token, itinerary.id, trimmed);
      reload();
    } catch (err) {
      setActionError(
        getFriendlyErrorMessage(err, {
          notFoundMessage: t('notFoundMessage'),
          context: { action: 'rename-itinerary', itineraryId: itinerary.id },
        }),
      );
    }
  }

  async function handleDeleteConfirmed() {
    if (!token) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      await deleteItinerary(token, itinerary.id);
      finishDelete(t('tripDeletedSuccessful'));
    } catch (err) {
      if (isNotFoundError(err)) {
        finishDelete(t('tripAlreadyDeleted'));
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
    setTimeout(() => router.push('/trips'), 900);
  }

  async function handleCancelConfirmed() {
    if (!token) return;
    setCancelling(true);
    setCancelError(null);
    try {
      await cancelTrip(token, itinerary.id);
      setConfirmingCancel(false);
      setCancelling(false);
      setSuccessMessage(t('tripCancelled'));
      reload();
    } catch (err) {
      setCancelError(getFriendlyErrorMessage(err, { context: { action: 'cancel-trip', itineraryId: itinerary.id } }));
      setCancelling(false);
    }
  }

  const collaboratorCount = itinerary.collaborators.length;
  const consequences =
    collaboratorCount > 0 ? [t('collaboratorsWillLoseAccess', { count: collaboratorCount })] : undefined;
  const requiresTypedConfirmation = itinerary.stops.length >= SUBSTANTIAL_STOPS_THRESHOLD || collaboratorCount > 0;

  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-6 px-4 py-6">
      <div>
        <div className="flex items-center justify-between gap-3">
          <Link href="/trips" className="text-sm font-medium text-brand-700 dark:text-brand-300 hover:underline">
            ← {t('myTrips')}
          </Link>
          <div className="flex items-center gap-2">
            {isOwner && itinerary.status !== 'cancelled' && itinerary.status !== 'completed' && (
              <button
                type="button"
                onClick={() => setConfirmingCancel(true)}
                className="flex items-center gap-1 rounded-full border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:border-flag-400 hover:text-flag-700 dark:border-slate-700 dark:text-slate-300"
              >
                <XCircleIcon aria-hidden className="h-3.5 w-3.5" />
                {t('cancelTrip')}
              </button>
            )}
            {isOwner && (
              <button
                type="button"
                onClick={() => setConfirmingDelete(true)}
                className="flex items-center gap-1 rounded-full border border-flag-300 px-3 py-1.5 text-xs font-semibold text-flag-700 hover:bg-flag-500/10 dark:border-flag-600 dark:text-flag-300"
              >
                <TrashIcon aria-hidden className="h-3.5 w-3.5" />
                {t('deleteTrip')}
              </button>
            )}
          </div>
        </div>

        <div className="mt-1 flex flex-wrap items-center gap-2">
          <TripTitle title={itinerary.title} editable={canEdit} onRename={handleRename} />
          <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${VISIBILITY_BADGE_STYLES[itinerary.visibility]}`}>
            {formatTripVisibility(itinerary.visibility)}
          </span>
          <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${STATUS_BADGE_STYLES[itinerary.status]}`}>
            {formatTripStatus(itinerary.status)}
          </span>
        </div>

        <TripMeta trip={itinerary} />

        <p className="text-sm text-slate-500 dark:text-slate-400">
          {t('days', { count: itinerary.durationDays })} · {formatBudgetBand(itinerary.budgetBand)}
          {itinerary.interests.length > 0 && ` · ${itinerary.interests.join(', ')}`}
          {!isOwner && isCollaborator && ` · ${t('sharedWithYou')}`}
        </p>

        {itinerary.description && <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">{itinerary.description}</p>}

        <div className="mt-3 flex flex-wrap items-center gap-3">
          <div className="h-10 w-10">
            <ShareMenu placeName={itinerary.title} contentType="trip" />
          </div>
          {tripHasShareableContent(itinerary) && (
            <div className="h-10 w-10">
              <TripShareCard trip={itinerary} />
            </div>
          )}
        </div>

        {successMessage && (
          <div className="mt-2">
            <SuccessBanner>{successMessage}</SuccessBanner>
          </div>
        )}
        {actionError && <p className="mt-2 text-xs text-flag-700 dark:text-flag-300">{actionError}</p>}
      </div>

      <TripPeoplePanel
        itineraryId={itinerary.id}
        admin={itinerary.admin}
        collaborators={itinerary.collaborators}
        isOwner={isOwner}
        onChange={reload}
      />

      {/* Every viewer who reaches MemberTripView is already a member —
          getItinerary is member-gated (404s a non-member before this ever
          renders) — so the chat panel needs no extra `canEdit` check here. */}
      <TripChatPanel itineraryId={itinerary.id} />

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
        open={confirmingCancel}
        title={t('cancelTripTitle')}
        description={t('cancelTripDescription')}
        confirmLabel={t('cancelTripConfirm')}
        loadingLabel={t('cancellingTrip')}
        isLoading={cancelling}
        error={cancelError}
        onConfirm={handleCancelConfirmed}
        onCancel={() => {
          if (cancelling) return;
          setConfirmingCancel(false);
          setCancelError(null);
        }}
      />

      <ConfirmDialog
        open={confirmingDelete}
        title={t('deleteTripTitle', { title: itinerary.title })}
        description={t('deleteTripDescription')}
        consequences={consequences}
        confirmationPhrase={requiresTypedConfirmation ? itinerary.title : undefined}
        confirmLabel={t('deleteTripConfirm')}
        loadingLabel={t('deletingTrip')}
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
  const t = useTranslations('trips');
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
    return <h1 className="text-xl font-bold text-slate-900 dark:text-slate-50">{title}</h1>;
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
        className="w-full rounded-lg border border-brand-500 bg-transparent px-2 py-0.5 text-xl font-bold text-slate-900 outline-none ring-1 ring-brand-500 dark:text-slate-50"
      />
    );
  }

  return (
    <button
      type="button"
      onClick={() => setEditing(true)}
      className="group flex items-center gap-1.5 text-left"
      aria-label={t('renameAriaLabel', { title })}
    >
      <h1 className="text-xl font-bold text-slate-900 dark:text-slate-50">{title}</h1>
      <PencilIcon
        aria-hidden
        className="h-4 w-4 shrink-0 text-slate-300 opacity-0 transition-opacity group-hover:opacity-100 dark:text-slate-600"
      />
    </button>
  );
}
