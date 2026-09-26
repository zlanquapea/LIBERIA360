"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { useTranslations } from "next-intl";
import { useAuth } from "@/hooks/useAuth";
import {
  generateTrip,
  previewTrip,
  type CreateTripInput,
} from "@/lib/itinerary-api";
import {
  savePendingTripDraft,
  takePendingTripDraft,
} from "@/lib/pending-trip-draft";
import { HttpError } from "@/lib/http";
import { formatBudgetBand, formatTripDateRange } from "@/lib/format";
import { DestinationAutocomplete } from "./DestinationAutocomplete";
import { BrandLoader } from "./BrandLoader";
import type {
  BudgetBand,
  Place,
  TripPreviewResponse,
  TripVisibility,
} from "@/lib/types";

const BUDGET_BANDS: BudgetBand[] = ["budget", "moderate", "premium"];
const MAX_TRIP_DURATION_DAYS = 14;

// Turns a start/end date pair into an inclusive day count (matches the
// API's own resolveDurationDays) — used only for the instant "X days" hint
// and client-side range check below; the API derives its own authoritative
// durationDays from the same two dates rather than trusting this value.
function durationDaysFromRange(startDate: string, endDate: string): number {
  const start = new Date(startDate);
  const end = new Date(endDate);
  return Math.round((end.getTime() - start.getTime()) / 86_400_000) + 1;
}

// "Plan a Trip" (Tech Spec §4.3, redesigned per a Sept 2026 product note:
// "do not automatically populate the days with random destinations — a
// person can plan a 3-day trip at a single location," "the user should
// have control"). Earlier versions of this form generated a full day-by-day
// route the moment it was submitted, scattering catalog places across the
// whole country by interest/budget/proximity alone, with no regard for
// whether the traveler wanted one stop or ten. This version creates just
// the trip's shell — its name, dates, and visibility — and hands the
// traveler straight to the trip page, where they add their own stops one
// at a time (AddTripStop), to whichever day(s) they actually need.
//
// Streamlined further (Sep 2026 UX pass): destination used to be required
// here too, but that's paperwork ahead of the actual planning — the field
// stays (still the fastest way to set one if the traveler has it in mind),
// it just no longer blocks creating the trip. A destination can always be
// picked from the catalog later; see CreateTripDto's doc comment on the
// API side for the full reasoning.
//
// Guest-first (product review readout, Aug 22, 2026): a visitor with no
// account can still fill this whole form and see exactly what they're
// about to create, via the unauthenticated /itineraries/preview endpoint —
// nothing is saved. Only "Log in to save this trip" asks for an account,
// and it hands the exact same inputs to the normal create endpoint
// afterward (see pending-trip-draft.ts), so what they see here is what
// they get.
export function TripPlannerForm() {
  const t = useTranslations("trips");
  const router = useRouter();
  const { user, token, ready } = useAuth();

  const [budgetBand, setBudgetBand] = useState<BudgetBand>("moderate");
  const [title, setTitle] = useState("");
  // Trip identity + visibility (Aug 2026 social-trip spec, Sections 1-3):
  // a name and a deliberate public/private choice are required before a
  // trip can be created or even previewed. Destination is optional (Sep
  // 2026 UX pass — see this component's own doc comment above).
  const [destination, setDestination] = useState<Place | null>(null);
  const [visibility, setVisibility] = useState<TripVisibility>("private");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [partySize, setPartySize] = useState("");
  const [maxParticipants, setMaxParticipants] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<TripPreviewResponse | null>(null);
  const [resuming, setResuming] = useState(false);
  const resumedRef = useRef(false);
  const formRef = useRef<HTMLFormElement>(null);
  const [invalidField, setInvalidField] = useState<string | null>(null);
  function fail(message: string, field: string) {
    setError(message);
    setInvalidField(field);
    formRef.current
      ?.querySelector<HTMLInputElement>(`[name="${field}"]`)
      ?.focus();
  }

  const durationDays =
    startDate && endDate ? durationDaysFromRange(startDate, endDate) : null;

  // Picks back up a guest-built trip the moment login finishes: if this
  // visitor clicked "Log in to save" a minute ago, the draft they were
  // looking at is sitting in sessionStorage, waiting to be handed to the
  // real create endpoint now that there's a token to save it under.
  useEffect(() => {
    if (!ready || !user || !token || resumedRef.current) return;
    const draft = takePendingTripDraft();
    if (!draft) return;
    resumedRef.current = true;
    setStartDate(draft.startDate);
    setEndDate(draft.endDate);
    setBudgetBand(draft.budgetBand);
    setTitle(draft.title);
    setDestination(draft.destination);
    setVisibility(draft.visibility);
    setPartySize(draft.partySize ? String(draft.partySize) : "");
    setMaxParticipants(
      draft.maxParticipants ? String(draft.maxParticipants) : "",
    );
    setPreview(null);
    setResuming(true);
    const { destination: _draftDestination, ...input } = draft;
    generateTrip(token, input)
      .then((itinerary) => router.push(`/trips/${itinerary.id}`))
      .catch((err) => {
        setResuming(false);
        setError(err instanceof HttpError ? err.message : t("savingTripError"));
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, user, token, router]);

  // Shared by both the submit and "log in to save" paths — a trip isn't
  // buildable at all without a name and a valid date range (Sections 1-2
  // of the Aug 2026 spec, plus the Sept 2026 date-range redesign).
  // Destination/party size/join capacity are all optional (see this
  // component's own doc comment).
  function buildInput(): CreateTripInput | null {
    if (!title.trim() || !startDate || !endDate) return null;
    return {
      startDate,
      endDate,
      budgetBand,
      interests: [],
      title: title.trim(),
      destinationPlaceId: destination?.id,
      visibility,
      partySize: partySize ? Number(partySize) : undefined,
      maxParticipants:
        visibility === "public" && maxParticipants
          ? Number(maxParticipants)
          : undefined,
    };
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (submitting) return;
    setError(null);
    setInvalidField(null);
    if (!title.trim()) {
      fail(t("nameYourTrip"), "title");
      return;
    }
    if (!startDate || !endDate) {
      fail(t("chooseDates"), !startDate ? "startDate" : "endDate");
      return;
    }
    if (endDate < startDate) {
      fail(t("endBeforeStart"), "endDate");
      return;
    }
    if ((durationDays ?? 0) > MAX_TRIP_DURATION_DAYS) {
      fail(t("maxDurationError", { max: MAX_TRIP_DURATION_DAYS }), "endDate");
      return;
    }
    for (const [field, value] of [
      ["partySize", partySize],
      ["maxParticipants", visibility === "public" ? maxParticipants : ""],
    ]) {
      if (
        value &&
        (!Number.isInteger(Number(value)) ||
          Number(value) < 1 ||
          Number(value) > 50)
      ) {
        fail(t("planner.partyError"), field);
        return;
      }
    }
    const input = buildInput();
    if (!input) return;
    setSubmitting(true);
    try {
      if (user && token) {
        const itinerary = await generateTrip(token, input);
        router.push(`/trips/${itinerary.id}`);
        return;
      }
      const result = await previewTrip(input);
      setPreview(result);
    } catch (err) {
      setError(err instanceof HttpError ? err.message : t("genericError"));
    } finally {
      setSubmitting(false);
    }
  }

  function handleLoginToSave() {
    const input = buildInput();
    if (!input) return;
    savePendingTripDraft({ ...input, destination });
    router.push("/login?next=/trips/new");
  }

  // The "Plan a Trip" title/subtitle used to live in the page.tsx wrapper
  // (a plain sync Server Component, statically prerenderable per locale).
  // It's rendered here instead — in every branch below — because giving
  // that wrapper its own `await getTranslations()` call turned the whole
  // route dynamic (Next couldn't tell the translated title was locale-only,
  // constant content, and stopped prerendering it per locale at build
  // time). TripPlannerForm is already client-side and already pays for
  // useTranslations, so the header rides along for free without costing
  // the route its static generation.
  const header = (
    <div>
      <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-50">
        {t("planATripTitle")}
      </h1>
      <p className="mt-2 max-w-xl text-sm leading-6 text-slate-500 dark:text-slate-400">
        {t("planATripSubtitle")}
      </p>
    </div>
  );

  if (!ready || resuming) {
    return (
      <>
        {header}
        <div className="flex min-h-[40vh] flex-col items-center justify-center gap-5">
          <BrandLoader />
          <p className="text-sm font-medium tracking-wide text-slate-500 dark:text-slate-400">
            {resuming ? t("savingYourTrip") : t("oneMoment")}
          </p>
        </div>
      </>
    );
  }

  if (preview) {
    return (
      <>
        {header}
        <div className="flex flex-col gap-5">
          <div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-slate-50">
              {preview.title}
            </h2>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              {destination && `${destination.name} · `}
              {formatTripDateRange(preview.startDate, preview.endDate)} ·{" "}
              {t("days", { count: preview.durationDays })} ·{" "}
              {formatBudgetBand(preview.budgetBand)}
            </p>
          </div>

          <p className="rounded-xl border border-dashed border-slate-300 dark:border-slate-700 px-4 py-3 text-sm text-slate-500 dark:text-slate-400">
            {t("previewNotice")}
          </p>

          {error && (
            <p
              id="trip-form-error"
              role="alert"
              className="rounded-lg bg-flag-500/10 px-3 py-2 text-sm text-flag-700 dark:text-flag-300"
            >
              {error}
            </p>
          )}

          <div className="flex flex-col gap-2">
            <button
              type="button"
              onClick={handleLoginToSave}
              className="rounded-full bg-brand-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-800"
            >
              {t("logInToSaveTrip")}
            </button>
            <button
              type="button"
              onClick={() => setPreview(null)}
              className="rounded-full border border-slate-300 dark:border-slate-700 px-4 py-2.5 text-sm font-medium text-slate-700 dark:text-slate-200 hover:border-brand-500"
            >
              {t("planADifferentTrip")}
            </button>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      {header}
      <form
        ref={formRef}
        onSubmit={handleSubmit}
        noValidate
        className="trip-planner grid gap-5 lg:grid-cols-[minmax(0,1fr)_18rem] lg:items-start"
      >
        <div className="flex min-w-0 flex-col gap-5">
          <section
            className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900 sm:p-6"
            aria-labelledby="trip-section-1"
          >
            <div className="mb-5 flex items-start gap-3">
              <span
                aria-hidden
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-50 text-sm font-semibold text-brand-800 dark:bg-brand-950 dark:text-brand-200"
              >
                1
              </span>
              <div>
                <h2
                  id="trip-section-1"
                  className="font-semibold text-slate-900 dark:text-white"
                >
                  {t("planner.detailsHeading")}
                </h2>
                <p className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400">
                  {t("planner.destinationHelp")}
                </p>
              </div>
            </div>
            <div className="flex flex-col gap-5">
              {" "}
              <label className="flex flex-col gap-1 text-sm font-medium text-slate-700 dark:text-slate-200">
                {t("tripName")}
                <input
                  type="text"
                  required
                  maxLength={200}
                  placeholder={t("tripNamePlaceholder")}
                  name="title"
                  aria-invalid={invalidField === "title"}
                  aria-describedby={
                    invalidField === "title" ? "trip-form-error" : undefined
                  }
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="rounded-lg border border-slate-300 dark:border-slate-700 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
                />
              </label>
              <DestinationAutocomplete
                value={destination}
                onChange={setDestination}
                label={t("planner.destinationOptional")}
              />
            </div>
          </section>
          <section
            className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900 sm:p-6"
            aria-labelledby="trip-section-2"
          >
            <div className="mb-5 flex items-start gap-3">
              <span
                aria-hidden
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-50 text-sm font-semibold text-brand-800 dark:bg-brand-950 dark:text-brand-200"
              >
                2
              </span>
              <div>
                <h2
                  id="trip-section-2"
                  className="font-semibold text-slate-900 dark:text-white"
                >
                  {t("planner.datesHeading")}
                </h2>
                <p className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400">
                  {t("planner.datesHelp")}
                </p>
              </div>
            </div>
            <div className="flex flex-col gap-5">
              {" "}
              <fieldset className="flex flex-col gap-1.5">
                <legend className="text-sm font-medium text-slate-700 dark:text-slate-200">
                  {t("whenAreYouGoing")}
                </legend>
                <div className="flex gap-2">
                  <label className="flex flex-1 flex-col gap-1 text-xs font-medium text-slate-500 dark:text-slate-400">
                    {t("startDate")}
                    <input
                      type="date"
                      required
                      name="startDate"
                      aria-invalid={invalidField === "startDate"}
                      aria-describedby={
                        invalidField === "startDate"
                          ? "trip-form-error"
                          : undefined
                      }
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      className="rounded-lg border border-slate-300 dark:border-slate-700 px-3 py-2 text-sm text-slate-900 outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 dark:text-slate-50"
                    />
                  </label>
                  <label className="flex flex-1 flex-col gap-1 text-xs font-medium text-slate-500 dark:text-slate-400">
                    {t("endDate")}
                    <input
                      type="date"
                      required
                      min={startDate || undefined}
                      name="endDate"
                      aria-invalid={invalidField === "endDate"}
                      aria-describedby={
                        invalidField === "endDate"
                          ? "trip-form-error"
                          : undefined
                      }
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                      className="rounded-lg border border-slate-300 dark:border-slate-700 px-3 py-2 text-sm text-slate-900 outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 dark:text-slate-50"
                    />
                  </label>
                </div>
                {durationDays !== null && (
                  <p
                    className={`text-xs ${
                      durationDays < 1 || durationDays > MAX_TRIP_DURATION_DAYS
                        ? "text-flag-700 dark:text-flag-300"
                        : "text-slate-500 dark:text-slate-400"
                    }`}
                  >
                    {durationDays < 1
                      ? t("endBeforeStart")
                      : durationDays > MAX_TRIP_DURATION_DAYS
                        ? t("tooManyDaysHint", {
                            count: durationDays,
                            max: MAX_TRIP_DURATION_DAYS,
                          })
                        : t("days", { count: durationDays })}
                  </p>
                )}
              </fieldset>
              <label className="flex flex-col gap-1 text-sm font-medium text-slate-700 dark:text-slate-200">
                {t("budget")}
                <select
                  value={budgetBand}
                  onChange={(e) => setBudgetBand(e.target.value as BudgetBand)}
                  className="rounded-lg border border-slate-300 dark:border-slate-700 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
                >
                  {BUDGET_BANDS.map((b) => (
                    <option key={b} value={b}>
                      {formatBudgetBand(b)}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </section>
          <section
            className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900 sm:p-6"
            aria-labelledby="trip-section-3"
          >
            <div className="mb-5 flex items-start gap-3">
              <span
                aria-hidden
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-50 text-sm font-semibold text-brand-800 dark:bg-brand-950 dark:text-brand-200"
              >
                3
              </span>
              <div>
                <h2
                  id="trip-section-3"
                  className="font-semibold text-slate-900 dark:text-white"
                >
                  {t("planner.peopleHeading")}
                </h2>
                <p className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400">
                  {t("planner.privacyHelp")}
                </p>
              </div>
            </div>
            <div className="flex flex-col gap-5">
              {" "}
              <label className="flex flex-col gap-1 text-sm font-medium text-slate-700 dark:text-slate-200">
                {t("partySize")}
                <input
                  type="number"
                  min={1}
                  max={50}
                  placeholder={t("partySizePlaceholder")}
                  name="partySize"
                  aria-invalid={invalidField === "partySize"}
                  aria-describedby={
                    invalidField === "partySize" ? "trip-form-error" : undefined
                  }
                  value={partySize}
                  onChange={(e) => setPartySize(e.target.value)}
                  className="w-32 rounded-lg border border-slate-300 dark:border-slate-700 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
                />
              </label>
              <fieldset className="flex flex-col gap-1.5">
                <legend className="text-sm font-medium text-slate-700 dark:text-slate-200">
                  {t("whoCanSee")}
                </legend>
                <div className="flex gap-2">
                  {[
                    {
                      value: "private" as TripVisibility,
                      label: t("visibilityPrivate"),
                      hint: t("visibilityPrivateHint"),
                    },
                    {
                      value: "public" as TripVisibility,
                      label: t("visibilityPublic"),
                      hint: t("visibilityPublicHint"),
                    },
                  ].map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => setVisibility(option.value)}
                      aria-pressed={visibility === option.value}
                      className={`flex-1 rounded-lg border px-3 py-2 text-left text-sm ${
                        visibility === option.value
                          ? "border-brand-600 bg-brand-50 dark:border-brand-400 dark:bg-brand-900/30"
                          : "border-slate-300 dark:border-slate-700 hover:border-brand-500"
                      }`}
                    >
                      <span className="block font-medium text-slate-900 dark:text-slate-50">
                        {option.label}
                      </span>
                      <span className="block text-xs text-slate-500 dark:text-slate-400">
                        {option.hint}
                      </span>
                    </button>
                  ))}
                </div>
                {visibility === "public" && (
                  <label className="flex flex-col gap-1 text-xs font-medium text-slate-500 dark:text-slate-400">
                    {t("maxParticipants")}
                    <input
                      type="number"
                      min={1}
                      max={50}
                      placeholder={t("maxParticipantsPlaceholder")}
                      name="maxParticipants"
                      aria-invalid={invalidField === "maxParticipants"}
                      aria-describedby={
                        invalidField === "maxParticipants"
                          ? "trip-form-error"
                          : undefined
                      }
                      value={maxParticipants}
                      onChange={(e) => setMaxParticipants(e.target.value)}
                      className="w-32 rounded-lg border border-slate-300 dark:border-slate-700 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
                    />
                  </label>
                )}
              </fieldset>
            </div>
          </section>
        </div>
        <aside className="rounded-2xl border border-brand-100 bg-brand-50/60 p-5 dark:border-brand-900 dark:bg-brand-950/40 sm:p-6 lg:sticky lg:top-24">
          <h2 className="mb-4 text-sm font-semibold text-brand-800 dark:text-brand-200">
            {t("planner.summaryHeading")}
          </h2>
          <p className="break-words text-xl font-bold text-slate-900 dark:text-white">
            {title.trim() || t("planner.namePlaceholder")}
          </p>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
            {destination?.name || t("planner.chooseLater")}
          </p>
          <p className="mt-3 text-sm text-slate-600 dark:text-slate-300">
            {startDate &&
            endDate &&
            durationDays !== null &&
            durationDays > 0 &&
            durationDays <= MAX_TRIP_DURATION_DAYS
              ? `${formatTripDateRange(startDate, endDate)} · ${t("days", { count: durationDays })}`
              : t("planner.datesPlaceholder")}
          </p>
          <div className="my-4 flex flex-wrap gap-2 text-xs">
            <span className="rounded-full bg-white px-3 py-1.5 text-slate-700 dark:bg-slate-800 dark:text-slate-200">
              {formatBudgetBand(budgetBand)}
            </span>
            <span className="rounded-full bg-white px-3 py-1.5 text-slate-700 dark:bg-slate-800 dark:text-slate-200">
              {visibility === "public"
                ? t("visibilityPublic")
                : t("visibilityPrivate")}
            </span>
          </div>
          <p className="mb-5 text-xs leading-5 text-slate-500 dark:text-slate-400">
            {t("planner.nextStepHelp")}
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {user ? t("continueUserHint") : t("continueGuestHint")}
          </p>

          {error && (
            <p
              id="trip-form-error"
              role="alert"
              className="rounded-lg bg-flag-500/10 px-3 py-2 text-sm text-flag-700 dark:text-flag-300"
            >
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="mt-4 min-h-12 w-full rounded-xl bg-brand-800 px-4 py-3 text-sm font-semibold text-white hover:bg-brand-900 disabled:opacity-60"
          >
            {submitting
              ? t("oneMoment")
              : user
                ? t("startPlanning")
                : t("continue")}
          </button>
        </aside>
      </form>
    </>
  );
}
