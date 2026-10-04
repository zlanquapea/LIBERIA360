"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useTranslations } from "next-intl";
import {
  DocumentDuplicateIcon,
  PencilIcon,
  TrashIcon,
  MapPinIcon,
  StarIcon,
  XCircleIcon,
} from "@heroicons/react/24/outline";
import { useAuth } from "@/hooks/useAuth";
import {
  cancelTrip,
  deleteItinerary,
  duplicateItinerary,
  getItinerary,
  getPublicTrip,
  removeItineraryStop,
  renameItinerary,
  requestToJoinTrip,
  setFeaturedTemplate,
  updateItineraryStop,
  updatePartySize,
  updateTripDetails,
} from "@/lib/itinerary-api";
import { getFriendlyErrorMessage, isNotFoundError } from "@/lib/errors";
import {
  formatBudgetBand,
  formatTripDateRange,
  formatTripStatus,
  formatTripVisibility,
} from "@/lib/format";
import { ItineraryStops } from "@/components/ItineraryStops";
import { BrandLoader } from "@/components/BrandLoader";
import { TripPeoplePanel } from "@/components/TripPeoplePanel";
import { AddTripStop } from "@/components/AddTripStop";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { SuccessBanner } from "@/components/SuccessBanner";
import { ShareMenu } from "@/components/ShareMenu";
import {
  TripShareCard,
  tripHasShareableContent,
} from "@/components/TripShareCard";
import { TripMapLoader } from "@/components/TripMapLoader";
import { TripHero } from "@/components/trips/TripHero";
import { TripTimeline } from "@/components/trips/TripTimeline";
import { TripCostSummary } from "@/components/TripCostSummary";
import { TripBudgetPanel } from "@/components/trips/TripBudgetPanel";
import { TripVotingPanel } from "@/components/trips/TripVotingPanel";
import { TripActivityPanel } from "@/components/trips/TripActivityPanel";
import { TripPackingPanel } from "@/components/trips/TripPackingPanel";
import { TripDetailsEditor } from "@/components/trips/TripDetailsEditor";
import { TripPlanChecks } from "@/components/trips/TripPlanChecks";
import { TripShareLink } from "@/components/trips/TripShareLink";
import { OfflinePackControl } from "@/components/trips/OfflinePackControl";
import { tripHasMapPins } from "@/lib/trip-map";
import type {
  ItineraryDetail,
  Place,
  PublicTripDetail,
  TripStatus,
  TripVisibility,
} from "@/lib/types";

// Kept in sync with the same threshold on the trips list page — a trip
// with this many saved stops, or any collaborators at all, gets an extra
// type-to-confirm safeguard on deletion instead of a single click.
const SUBSTANTIAL_STOPS_THRESHOLD = 5;

const STATUS_BADGE_STYLES: Record<TripStatus, string> = {
  upcoming:
    "bg-brand-100 text-brand-800 dark:bg-brand-950/40 dark:text-brand-200",
  ongoing:
    "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300",
  completed:
    "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300",
  cancelled: "bg-flag-500/10 text-flag-700 dark:text-flag-300",
};

const VISIBILITY_BADGE_STYLES: Record<TripVisibility, string> = {
  public: "bg-sky-100 text-sky-700 dark:bg-sky-950/40 dark:text-sky-300",
  private: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300",
};

// The interactive trip detail experience — member view (rename, delete,
// stops, people panel, chat) or the public/restricted view for a
// non-member — behind a real backend call needing `id` at hand, so this
// stays client-side (member vs. public vs. private-restricted can only be
// told apart once we know whether the viewer is signed in and a member).
// The route's page.tsx wraps this to add per-trip <head> metadata, which
// Next.js only generates from a Server Component.
export function TripDetailClient({ id }: { id: string }) {
  const t = useTranslations("trips");
  const tCommon = useTranslations("common");
  const tTrip = useTranslations("tripPage");
  const notFoundMessage = t("notFoundMessage");
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

  const [joinRequestState, setJoinRequestState] = useState<
    "idle" | "sending" | "sent"
  >("idle");
  const [joinRequestError, setJoinRequestError] = useState<string | null>(null);

  // A member reload (after renaming, adding a stop, a collaborator
  // change, …) only ever needs the fully-guarded member endpoint — it
  // never has to re-run the public-trip fallback dance below, since a
  // trip that just loaded as a member is still one.
  const reload = useCallback(() => {
    if (!token) return;
    getItinerary(token, id)
      .then((result) => setItinerary(result))
      .catch((err) =>
        setLoadError(getFriendlyErrorMessage(err, { notFoundMessage })),
      );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, id]);

  useEffect(() => {
    if (!ready) return;
    let cancelled = false;

    function loadPublic() {
      return getPublicTrip(id)
        .then((result) => {
          if (cancelled) return;
          if ("visibility" in result) {
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
                context: { action: "load-public-trip", itineraryId: id },
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
              context: { action: "load-itinerary", itineraryId: id },
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
        <p className="text-sm font-medium tracking-wide text-slate-500 dark:text-slate-400">
          {tCommon("loading")}
        </p>
      </main>
    );
  }

  if (restricted) {
    return (
      <main className="mx-auto flex max-w-sm flex-col gap-3 px-4 py-10 text-center">
        <p className="text-lg font-bold text-slate-900 dark:text-slate-50">
          {t("privateTripTitle")}
        </p>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          {t("privateTripDescription")}
        </p>
        <Link
          href="/trips"
          className="text-sm font-medium text-brand-700 dark:text-brand-300 hover:underline"
        >
          ← {t("backToMyTrips")}
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
        <Link
          href="/trips"
          className="text-sm font-medium text-brand-700 dark:text-brand-300 hover:underline"
        >
          ← {t("backToMyTrips")}
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
  // Only meaningful when the owner set a cap — see Itinerary.
  // maxParticipants's doc comment on the API side.
  const isFull =
    trip.maxParticipants != null &&
    trip.participantCount >= trip.maxParticipants;

  async function handleRequestToJoin() {
    if (!token) return;
    setJoinRequestState("sending");
    setJoinRequestError(null);
    try {
      await requestToJoinTrip(token, trip.id);
      setJoinRequestState("sent");
    } catch (err) {
      setJoinRequestState("idle");
      setJoinRequestError(
        getFriendlyErrorMessage(err, {
          context: { action: "request-to-join", itineraryId: trip.id },
        }),
      );
    }
  }

  const joinAction =
    !isAdmin && trip.status !== "cancelled" ? (
      isFull ? (
        <p className="rounded-full bg-slate-200 px-5 py-3 text-sm font-bold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
          {t("tripFull")}
        </p>
      ) : !user ? (
        <Link
          href={`/login?next=/trips/${trip.id}`}
          className="inline-flex min-h-12 items-center justify-center rounded-full bg-brand-700 px-6 text-base font-bold text-white hover:bg-brand-800"
        >
          {t("logInToJoin")}
        </Link>
      ) : joinRequestState === "sent" ? (
        <p className="rounded-full bg-emerald-100 px-5 py-3 text-sm font-bold text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200">
          {t("requestSent")}
        </p>
      ) : (
        <button
          type="button"
          disabled={joinRequestState === "sending"}
          onClick={handleRequestToJoin}
          className="inline-flex min-h-12 items-center justify-center rounded-full bg-brand-700 px-6 text-base font-bold text-white hover:bg-brand-800 disabled:opacity-60"
        >
          {joinRequestState === "sending"
            ? t("sendingRequest")
            : t("requestToJoin")}
        </button>
      )
    ) : null;

  return (
    <main className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-6 sm:px-6 lg:px-10">
      <Link
        href="/trips/community"
        className="w-fit text-sm font-semibold text-brand-700 hover:underline dark:text-brand-300"
      >
        ← {t("backToCommunityTrips")}
      </Link>

      <TripHero
        trip={trip}
        actions={
          <>
            {joinAction}
            <div className="h-10 w-10">
              <ShareMenu placeName={trip.title} contentType="trip" />
            </div>
            {tripHasShareableContent(trip) && (
              <div className="h-10 w-10">
                <TripShareCard trip={trip} />
              </div>
            )}
          </>
        }
      />
      {joinRequestError && (
        <p role="alert" className="text-sm text-flag-700 dark:text-flag-300">
          {joinRequestError}
        </p>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-start">
        <section
          aria-labelledby="trip-plan"
          className="flex min-w-0 flex-col gap-5 rounded-[2rem] border border-slate-200 bg-white p-5 shadow-card sm:p-7 dark:border-slate-800 dark:bg-slate-900"
        >
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-brand-700 dark:text-brand-300">
              {tTrip("planEyebrow")}
            </p>
            <h2
              id="trip-plan"
              className="mt-1 font-display text-2xl font-bold text-slate-950 dark:text-slate-50"
            >
              {tTrip("planTitle")}
            </h2>
            {trip.description && (
              <p className="mt-3 whitespace-pre-line leading-7 text-slate-700 dark:text-slate-200">
                {trip.description}
              </p>
            )}
          </div>
          <TripTimeline stops={trip.stops} startDate={trip.startDate} />
        </section>

        <aside className="flex flex-col gap-4 lg:sticky lg:top-24">
          {tripHasMapPins(trip.stops) && (
            <div className="h-64 overflow-hidden rounded-[2rem] border border-slate-200 shadow-card dark:border-slate-800">
              <TripMapLoader stops={trip.stops} />
            </div>
          )}
          <div className="rounded-2xl bg-white shadow-card dark:bg-slate-900">
            <TripCostSummary stops={trip.stops} />
          </div>
          <div className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-card dark:border-slate-800 dark:bg-slate-900">
            <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">
              {tTrip("whoGoing")}
            </p>
            <p className="mt-1 font-display text-2xl font-black text-slate-950 dark:text-white">
              {t("goingCount", { count: trip.participantCount })}
            </p>
            {trip.admin && (
              <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                {t("organizedBy", { name: trip.admin.name })}
              </p>
            )}
          </div>
        </aside>
      </div>
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
  trip: {
    destination: Place | null;
    startDate: string | null;
    endDate: string | null;
  };
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
  user: { id: string; isAdmin: boolean } | null;
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
  const t = useTranslations("trips");
  const isOwner = itinerary.userId === user?.id;
  const isCollaborator = itinerary.collaborators.some((c) => c.id === user?.id);
  // Viewers see everything but can't change the plan.
  const canEdit = isOwner || (isCollaborator && itinerary.myRole !== "viewer");
  const [duplicating, setDuplicating] = useState(false);
  const canFeature = isOwner && Boolean(user?.isAdmin);
  const [showFeatureForm, setShowFeatureForm] = useState(false);
  const [featuredCategoryInput, setFeaturedCategoryInput] = useState(
    itinerary.featuredCategory ?? "",
  );
  const [featuring, setFeaturing] = useState(false);
  const [featureError, setFeatureError] = useState<string | null>(null);

  // Admin-only, and only on a trip the acting admin themself owns (see
  // ItinerariesService.setFeaturedTemplate) — curates this trip as a
  // clonable "Trip Ideas" starting point.
  async function handleSetFeatured(next: boolean) {
    if (!token) return;
    setFeaturing(true);
    setFeatureError(null);
    try {
      await setFeaturedTemplate(token, itinerary.id, {
        isFeaturedTemplate: next,
        featuredCategory: next
          ? featuredCategoryInput.trim() || undefined
          : undefined,
      });
      setShowFeatureForm(false);
      reload();
    } catch (err) {
      setFeatureError(
        getFriendlyErrorMessage(err, {
          context: {
            action: "set-featured-template",
            itineraryId: itinerary.id,
          },
        }),
      );
    } finally {
      setFeaturing(false);
    }
  }

  // Owner or any collaborator, same tier as renameTrip — the copy always
  // belongs to whoever clicks this, not the original owner (see the API's
  // duplicateItinerary doc comment).
  async function handleDuplicate() {
    if (!token) return;
    setDuplicating(true);
    setActionError(null);
    try {
      const copy = await duplicateItinerary(token, itinerary.id);
      router.push(`/trips/${copy.id}`);
    } catch (err) {
      setActionError(
        getFriendlyErrorMessage(err, {
          context: { action: "duplicate-itinerary", itineraryId: itinerary.id },
        }),
      );
      setDuplicating(false);
    }
  }

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
          notFoundMessage: t("notFoundMessage"),
          context: { action: "rename-itinerary", itineraryId: itinerary.id },
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
      finishDelete(t("tripDeletedSuccessful"));
    } catch (err) {
      if (isNotFoundError(err)) {
        finishDelete(t("tripAlreadyDeleted"));
      } else {
        setDeleteError(
          getFriendlyErrorMessage(err, {
            context: { action: "delete-itinerary", itineraryId: itinerary.id },
          }),
        );
        setDeleting(false);
      }
    }
  }

  function finishDelete(message: string) {
    setConfirmingDelete(false);
    setDeleting(false);
    setSuccessMessage(message);
    setTimeout(() => router.push("/trips"), 900);
  }

  async function handleCancelConfirmed() {
    if (!token) return;
    setCancelling(true);
    setCancelError(null);
    try {
      await cancelTrip(token, itinerary.id);
      setConfirmingCancel(false);
      setCancelling(false);
      setSuccessMessage(t("tripCancelled"));
      reload();
    } catch (err) {
      setCancelError(
        getFriendlyErrorMessage(err, {
          context: { action: "cancel-trip", itineraryId: itinerary.id },
        }),
      );
      setCancelling(false);
    }
  }

  const collaboratorCount = itinerary.collaborators.length;
  const consequences =
    collaboratorCount > 0
      ? [t("collaboratorsWillLoseAccess", { count: collaboratorCount })]
      : undefined;
  const requiresTypedConfirmation =
    itinerary.stops.length >= SUBSTANTIAL_STOPS_THRESHOLD ||
    collaboratorCount > 0;

  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-6 px-4 py-6">
      <div>
        <div className="flex items-center justify-between gap-3">
          <Link
            href="/trips"
            className="text-sm font-medium text-brand-700 dark:text-brand-300 hover:underline"
          >
            ← {t("myTrips")}
          </Link>
          <div className="flex items-center gap-2">
            {canEdit && (
              <button
                type="button"
                disabled={duplicating}
                onClick={handleDuplicate}
                className="flex items-center gap-1 rounded-full border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:border-brand-400 hover:text-brand-700 disabled:opacity-60 dark:border-slate-700 dark:text-slate-300"
              >
                <DocumentDuplicateIcon aria-hidden className="h-3.5 w-3.5" />
                {duplicating ? t("duplicating") : t("duplicateTrip")}
              </button>
            )}
            {isOwner &&
              itinerary.status !== "cancelled" &&
              itinerary.status !== "completed" && (
                <button
                  type="button"
                  onClick={() => setConfirmingCancel(true)}
                  className="flex items-center gap-1 rounded-full border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:border-flag-400 hover:text-flag-700 dark:border-slate-700 dark:text-slate-300"
                >
                  <XCircleIcon aria-hidden className="h-3.5 w-3.5" />
                  {t("cancelTrip")}
                </button>
              )}
            {isOwner && (
              <button
                type="button"
                onClick={() => setConfirmingDelete(true)}
                className="flex items-center gap-1 rounded-full border border-flag-300 px-3 py-1.5 text-xs font-semibold text-flag-700 hover:bg-flag-500/10 dark:border-flag-600 dark:text-flag-300"
              >
                <TrashIcon aria-hidden className="h-3.5 w-3.5" />
                {t("deleteTrip")}
              </button>
            )}
            {canFeature &&
              (itinerary.isFeaturedTemplate ? (
                <button
                  type="button"
                  disabled={featuring}
                  onClick={() => handleSetFeatured(false)}
                  className="flex items-center gap-1 rounded-full border border-gold-400 bg-gold-50 px-3 py-1.5 text-xs font-semibold text-gold-800 hover:bg-gold-100 disabled:opacity-60 dark:border-gold-700 dark:bg-gold-900/20 dark:text-gold-300"
                >
                  <StarIcon aria-hidden className="h-3.5 w-3.5" />
                  {featuring
                    ? t("savingFeatured")
                    : t("unfeatureStarterItinerary")}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setShowFeatureForm((v) => !v)}
                  className="flex items-center gap-1 rounded-full border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:border-gold-400 hover:text-gold-700 dark:border-slate-700 dark:text-slate-300"
                >
                  <StarIcon aria-hidden className="h-3.5 w-3.5" />
                  {t("featureAsStarterItinerary")}
                </button>
              ))}
          </div>
        </div>

        {canFeature && featureError && !showFeatureForm && (
          <p
            role="alert"
            className="mt-2 text-xs text-flag-700 dark:text-flag-300"
          >
            {featureError}
          </p>
        )}

        {canFeature && showFeatureForm && !itinerary.isFeaturedTemplate && (
          <div className="mt-2 flex flex-wrap items-center gap-2 rounded-xl border border-gold-200 bg-gold-50/60 p-3 dark:border-gold-800 dark:bg-gold-900/10">
            <input
              value={featuredCategoryInput}
              onChange={(e) => setFeaturedCategoryInput(e.target.value)}
              placeholder={t("featuredCategoryLabel")}
              maxLength={60}
              className="input flex-1"
            />
            <button
              type="button"
              disabled={featuring}
              onClick={() => handleSetFeatured(true)}
              className="rounded-full bg-brand-700 px-4 py-2 text-xs font-semibold text-white hover:bg-brand-800 disabled:opacity-60"
            >
              {featuring ? t("savingFeatured") : t("featureAsStarterItinerary")}
            </button>
            {featureError && (
              <p
                role="alert"
                className="w-full text-xs text-flag-700 dark:text-flag-300"
              >
                {featureError}
              </p>
            )}
          </div>
        )}

        <div className="mt-1 flex flex-wrap items-center gap-2">
          <TripTitle
            title={itinerary.title}
            editable={canEdit}
            onRename={handleRename}
          />
          <span
            className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${VISIBILITY_BADGE_STYLES[itinerary.visibility]}`}
          >
            {formatTripVisibility(itinerary.visibility)}
          </span>
          <span
            className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${STATUS_BADGE_STYLES[itinerary.status]}`}
          >
            {formatTripStatus(itinerary.status)}
          </span>
        </div>

        <TripMeta trip={itinerary} />

        {!isOwner && isCollaborator && itinerary.myRole === "viewer" && (
          <p className="mb-2 rounded-xl bg-slate-100 px-3 py-2 text-sm text-slate-700 dark:bg-slate-800 dark:text-slate-200">
            {t("viewOnlyNotice", {
              name: itinerary.admin?.name ?? t("theOrganizer"),
            })}
          </p>
        )}

        <p className="text-sm text-slate-500 dark:text-slate-400">
          {t("days", { count: itinerary.durationDays })} ·{" "}
          {formatBudgetBand(itinerary.budgetBand)}
          {itinerary.interests.length > 0 &&
            ` · ${itinerary.interests.join(", ")}`}
          {!isOwner && isCollaborator && ` · ${t("sharedWithYou")}`}
          {" · "}
          <TripPartySize
            partySize={itinerary.partySize}
            editable={canEdit}
            onSave={async (partySize) => {
              if (!token) return;
              await updatePartySize(token, itinerary.id, partySize);
              reload();
            }}
          />
        </p>

        {itinerary.description && (
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
            {itinerary.description}
          </p>
        )}

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
        {actionError && (
          <p className="mt-2 text-xs text-flag-700 dark:text-flag-300">
            {actionError}
          </p>
        )}
      </div>

      <TripWorkspaceNav />

      <TripWorkspaceSection
        id="trip-overview"
        eyebrow="01 · Overview"
        title="Your trip at a glance"
        description="Review the plan, route, travel setup, and offline access before you go."
      >
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(18rem,0.8fr)]">
          <TripDetailsEditor
            value={{
              startingLocation: itinerary.startingLocation,
              transportMode: itinerary.transportMode,
              pace: itinerary.pace,
              budgetBand: itinerary.budgetBand,
            }}
            editable={canEdit}
            onSave={async (input) => {
              if (!token) return;
              await updateTripDetails(token, itinerary.id, input);
              reload();
            }}
          />
          <TripCostSummary stops={itinerary.stops} />
        </div>
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(18rem,0.8fr)]">
          <TripPlanChecks
            stops={itinerary.stops}
            durationDays={itinerary.durationDays}
            transportMode={itinerary.transportMode}
            pace={itinerary.pace}
            startDate={itinerary.startDate}
            endDate={itinerary.endDate}
          />
          <OfflinePackControl trip={itinerary} />
        </div>
        {tripHasMapPins(itinerary.stops) && (
          <div className="h-64 overflow-hidden rounded-2xl border border-slate-200 shadow-sm dark:border-slate-800 sm:h-80">
            <TripMapLoader stops={itinerary.stops} />
          </div>
        )}
      </TripWorkspaceSection>

      <TripWorkspaceSection
        id="trip-plan"
        eyebrow="02 · Plan"
        title="Build the itinerary together"
        description="Add places, events, or rentals, arrange them by day, and let the group vote on what belongs."
      >
        <ItineraryStops
          stops={itinerary.stops}
          durationDays={itinerary.durationDays}
          onReorder={
            canEdit
              ? async (itemId, position) => {
                  if (!token) return;
                  await updateItineraryStop(token, itinerary.id, itemId, {
                    position,
                  });
                  reload();
                }
              : undefined
          }
          onRemove={
            canEdit
              ? async (itemId) => {
                  if (!token) return;
                  await removeItineraryStop(token, itinerary.id, itemId);
                  reload();
                }
              : undefined
          }
          onMove={
            canEdit
              ? async (itemId, day) => {
                  if (!token) return;
                  await updateItineraryStop(token, itinerary.id, itemId, {
                    day,
                  });
                  reload();
                }
              : undefined
          }
        />
        {canEdit && (
          <AddTripStop
            itineraryId={itinerary.id}
            durationDays={itinerary.durationDays}
            onAdded={reload}
          />
        )}
        <TripVotingPanel
          key={`votes-${itinerary.id}-${user?.id}`}
          tripId={itinerary.id}
          durationDays={itinerary.durationDays}
          onAdded={reload}
        />
      </TripWorkspaceSection>

      <TripWorkspaceSection
        id="trip-tools"
        eyebrow="03 · Trip tools"
        title="Stay organized"
        description="Keep spending and packing in one place, with private lists for each traveler."
      >
        <div className="grid gap-4 xl:grid-cols-2">
          <TripBudgetPanel
            key={`${itinerary.id}-${user?.id}`}
            tripId={itinerary.id}
          />
          <TripPackingPanel
            key={`${itinerary.id}-${user?.id}`}
            tripId={itinerary.id}
          />
        </div>
      </TripWorkspaceSection>

      <TripWorkspaceSection
        id="trip-collaboration"
        eyebrow="04 · Collaboration"
        title="Keep everyone in sync"
        description="See what changed, manage people, share a view-only link, or open the trip conversation."
      >
        <TripActivityPanel
          key={`activity-${itinerary.id}-${user?.id}`}
          tripId={itinerary.id}
        />
        <div className="grid gap-4 lg:grid-cols-2">
          <TripPeoplePanel
            itineraryId={itinerary.id}
            admin={itinerary.admin}
            collaborators={itinerary.collaborators}
            collaboratorRoles={itinerary.collaboratorRoles}
            isOwner={isOwner}
            onChange={reload}
          />
          <div className="flex flex-col gap-4">
            <TripShareLink
              itineraryId={itinerary.id}
              shareToken={itinerary.shareToken}
              isOwner={isOwner}
              token={token}
              onChange={reload}
            />
            <Link
              href={`/messages/context?type=trip&id=${itinerary.id}`}
              className="flex min-h-12 items-center justify-center rounded-2xl bg-brand-700 px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-800"
            >
              Open trip conversation in Messages
            </Link>
          </div>
        </div>
      </TripWorkspaceSection>

      <ConfirmDialog
        open={confirmingCancel}
        title={t("cancelTripTitle")}
        description={t("cancelTripDescription")}
        confirmLabel={t("cancelTripConfirm")}
        loadingLabel={t("cancellingTrip")}
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
        title={t("deleteTripTitle", { title: itinerary.title })}
        description={t("deleteTripDescription")}
        consequences={consequences}
        confirmationPhrase={
          requiresTypedConfirmation ? itinerary.title : undefined
        }
        confirmLabel={t("deleteTripConfirm")}
        loadingLabel={t("deletingTrip")}
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

function TripWorkspaceNav() {
  const links = [
    ["trip-overview", "Overview"],
    ["trip-plan", "Plan"],
    ["trip-tools", "Tools"],
    ["trip-collaboration", "People & updates"],
  ] as const;
  return (
    <nav
      aria-label="Trip sections"
      className="sticky top-2 z-10 -mx-1 overflow-x-auto rounded-2xl border border-slate-200/80 bg-white/95 p-1 shadow-sm backdrop-blur dark:border-slate-800/80 dark:bg-slate-950/95"
    >
      <div className="flex min-w-max gap-1">
        {links.map(([id, label], index) => (
          <a
            key={id}
            href={`#${id}`}
            className="rounded-xl px-3 py-2 text-xs font-semibold text-slate-600 transition hover:bg-brand-50 hover:text-brand-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 dark:text-slate-300 dark:hover:bg-brand-950/40 dark:hover:text-brand-200 sm:px-4 sm:text-sm"
          >
            <span className="me-1 text-[10px] text-brand-700 dark:text-brand-300">
              0{index + 1}
            </span>
            {label}
          </a>
        ))}
      </div>
    </nav>
  );
}

function TripWorkspaceSection({
  id,
  eyebrow,
  title,
  description,
  children,
}: {
  id: string;
  eyebrow: string;
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-20 space-y-4">
      <div className="px-1">
        <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-brand-700 dark:text-brand-300">
          {eyebrow}
        </p>
        <h2 className="mt-1 font-display text-2xl font-black tracking-tight text-slate-950 dark:text-white">
          {title}
        </h2>
        <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-500 dark:text-slate-400">
          {description}
        </p>
      </div>
      {children}
    </section>
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
  const t = useTranslations("trips");
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
    return (
      <h1 className="text-xl font-bold text-slate-900 dark:text-slate-50">
        {title}
      </h1>
    );
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
          if (e.key === "Enter") {
            e.preventDefault();
            commit();
          } else if (e.key === "Escape") {
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
      aria-label={t("renameAriaLabel", { title })}
    >
      <h1 className="text-xl font-bold text-slate-900 dark:text-slate-50">
        {title}
      </h1>
      <PencilIcon
        aria-hidden
        className="h-4 w-4 shrink-0 text-slate-300 opacity-0 transition-opacity group-hover:opacity-100 dark:text-slate-600"
      />
    </button>
  );
}

// Traveler headcount (Sep 2026 UX pass) — click-to-edit, same interaction
// shape as TripTitle above (owner or any collaborator; purely informational,
// see Itinerary.partySize's own doc comment on the API side). A trip with
// no party size set yet shows a plain "Add traveler count" prompt instead
// of a number.
function TripPartySize({
  partySize,
  editable,
  onSave,
}: {
  partySize: number | null;
  editable: boolean;
  onSave: (partySize: number) => void;
}) {
  const t = useTranslations("trips");
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(partySize ? String(partySize) : "");

  useEffect(() => {
    setDraft(partySize ? String(partySize) : "");
  }, [partySize]);

  function commit() {
    setEditing(false);
    const value = Number(draft);
    if (
      draft &&
      Number.isInteger(value) &&
      value >= 1 &&
      value <= 50 &&
      value !== partySize
    ) {
      onSave(value);
    }
  }

  if (!editable && partySize == null) return null;

  if (!editable) {
    return <span>{t("travelerCount", { count: partySize! })}</span>;
  }

  if (editing) {
    return (
      <input
        type="number"
        min={1}
        max={50}
        autoFocus
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            commit();
          } else if (e.key === "Escape") {
            setDraft(partySize ? String(partySize) : "");
            setEditing(false);
          }
        }}
        className="w-16 rounded-lg border border-brand-500 bg-transparent px-1.5 py-0.5 text-sm outline-none ring-1 ring-brand-500"
      />
    );
  }

  return (
    <button
      type="button"
      onClick={() => setEditing(true)}
      className="hover:underline"
    >
      {partySize == null
        ? t("addTravelerCount")
        : t("travelerCount", { count: partySize })}
    </button>
  );
}
