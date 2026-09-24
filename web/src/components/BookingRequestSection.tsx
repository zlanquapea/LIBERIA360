"use client";

import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";
import { useAuth } from "@/hooks/useAuth";
import { createBooking } from "@/lib/booking-api";
import { getCarListingAvailability } from "@/lib/car-rentals-api";
import {
  recordAnalyticsEvent,
  recordCreatorAnalyticsEvent,
} from "@/lib/analytics-api";
import { HttpError } from "@/lib/http";
import { formatBookingStatus, formatCost } from "@/lib/format";
import type {
  Business,
  CarListing,
  Creator,
  BookingStatus,
  CarListingAvailability,
} from "@/lib/types";

// Day-level overlap check against the advisory availability endpoint —
// mirrors the server's own inclusive-range comparison closely enough for
// a UX warning (the server, via BookingsService.create, remains the sole
// authority; this never blocks submission, just flags it).
function rangesOverlap(
  aStart: string,
  aEnd: string,
  bStart: string,
  bEnd: string,
): boolean {
  return aStart <= bEnd && bStart <= aEnd;
}

// "Request to book" (Tech Spec §3.3). Request-to-book only — no real
// payment capture yet (see Booking.paymentProvider: MTN MoMo is the
// intended provider for Liberia, wired into the schema but not called
// against a live API until credentials exist). Sits under the claimed
// business's contact card on the Destination Profile, or the creator's
// contact card on their public profile — exactly one of business/creator
// (same XOR as CreateBookingInput). Hidden entirely for an unclaimed
// business listing, since there's no one to send the request to.
export function BookingRequestSection({
  business,
  creator,
  carListing,
  prominent = false,
  mode = "inline",
  href,
  returnTo,
  startExpanded = false,
  initialRentalDetails,
}: {
  business?: Business;
  creator?: Creator;
  // Renting a specific vehicle — the third XOR target alongside
  // business/creator. Needs its own return-date requirement, driver
  // option, and pickup-location field the other two targets don't.
  carListing?: CarListing;
  prominent?: boolean;
  // "link" is for a space-constrained context that has nowhere reasonable
  // for the full multi-field form to expand into (e.g. one cell of the
  // Directions/Call/WhatsApp/Book action-tile grid on a place/business
  // profile — the form used to expand in place there and rendered badly,
  // fields wrapping and the whole grid going lopsided, since a grid cell
  // is nowhere near wide enough). Every other state below (login prompt,
  // "you manage this listing", sent confirmation) is short enough to stay
  // inline either way — only the form itself becomes a real link, to the
  // caller-supplied `href` (see /businesses/[slug]/book, which renders
  // this same component in its default "inline" mode with room to spare).
  mode?: "inline" | "link";
  href?: string;
  // Carried into the "log in to request a booking" link as `?next=`, so a
  // guest who has to log in first lands back on the booking flow instead
  // of the generic /account. Only meaningful with mode="link" (the inline
  // form already keeps its own place in the page); omit to fall back to a
  // plain /login.
  returnTo?: string;
  // The page this form itself lives on (i.e. mode="link"'s `href` target)
  // has no "Request to book" button of its own to click through — showing
  // one would just be a second click to reach the thing the visitor
  // already navigated here for. Skips straight to the form.
  startExpanded?: boolean;
  initialRentalDetails?: {
    pickupDate?: string;
    returnDate?: string;
    pickupLocation?: string;
  };
}) {
  const { user, token, ready } = useAuth();
  const targetId = business?.id ?? creator?.id ?? carListing!.id;
  const isOwner = business
    ? user?.id === business.owner?.id
    : creator
      ? user?.id === creator.user?.id
      : user?.id === carListing!.owner?.id;

  const [showForm, setShowForm] = useState(startExpanded);
  const [requestedDate, setRequestedDate] = useState(
    initialRentalDetails?.pickupDate ?? "",
  );
  const [requestedEndDate, setRequestedEndDate] = useState(
    initialRentalDetails?.returnDate ?? "",
  );
  // By-day vs by-hour — only ever relevant for a carListing that opted
  // into hourly rental (pricePerHour set); every other target, and a car
  // listing without pricePerHour, stays on "day" and never shows the
  // toggle at all.
  const [rentalUnit, setRentalUnit] = useState<"day" | "hour">("day");
  const [requestedStartTime, setRequestedStartTime] = useState("");
  const [requestedEndTime, setRequestedEndTime] = useState("");
  const [partySize, setPartySize] = useState("");
  const [withDriver, setWithDriver] = useState(false);
  const [wantsAdditionalDriver, setWantsAdditionalDriver] = useState(false);
  const [pickupLocation, setPickupLocation] = useState(
    initialRentalDetails?.pickupLocation ?? "",
  );
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState<{ status: BookingStatus } | null>(null);
  const [availability, setAvailability] =
    useState<CarListingAvailability | null>(null);

  useEffect(() => {
    if (!carListing) return;
    let cancelled = false;
    getCarListingAvailability(carListing.id)
      .then((data) => {
        if (!cancelled) setAvailability(data);
      })
      .catch(() => {
        // Advisory only — a failed fetch just means no warning is shown.
      });
    return () => {
      cancelled = true;
    };
  }, [carListing]);

  const isHourly = Boolean(
    carListing?.pricePerHour != null && rentalUnit === "hour",
  );

  const additionalDriverFee =
    wantsAdditionalDriver && carListing?.additionalDriverAllowed
      ? (carListing.additionalDriverFee ?? 0)
      : 0;

  // Live estimate shown under the date/time inputs — mirrors
  // BookingsService.create's own hours/days × rate + fees math so a
  // renter sees roughly what they'll be asked to pay before sending the
  // request; null (nothing shown) until the relevant inputs are filled in
  // and valid, same as the server would reject an empty/backwards range.
  let estimatedTotal: number | null = null;
  if (
    isHourly &&
    carListing?.pricePerHour != null &&
    requestedStartTime &&
    requestedEndTime
  ) {
    const [startH, startM] = requestedStartTime.split(":").map(Number);
    const [endH, endM] = requestedEndTime.split(":").map(Number);
    const minutes = endH * 60 + endM - (startH * 60 + startM);
    if (minutes > 0) {
      const hours = Math.ceil(minutes / 60);
      const driverFee =
        withDriver &&
        carListing.withDriverAvailable &&
        carListing.driverFeePerHour != null
          ? hours * carListing.driverFeePerHour
          : 0;
      estimatedTotal =
        hours * carListing.pricePerHour + driverFee + additionalDriverFee;
    }
  } else if (
    carListing &&
    !isHourly &&
    requestedDate &&
    requestedEndDate
  ) {
    const msPerDay = 24 * 60 * 60 * 1000;
    const days = Math.max(
      1,
      Math.round(
        (new Date(requestedEndDate).getTime() -
          new Date(requestedDate).getTime()) /
          msPerDay,
      ),
    );
    const driverFee =
      withDriver &&
      carListing.withDriverAvailable &&
      carListing.driverFeePerDay != null
        ? days * carListing.driverFeePerDay
        : 0;
    estimatedTotal =
      days * carListing.pricePerDay + driverFee + additionalDriverFee;
  }

  // Non-blocking heads-up only — the server (BookingsService.create) is
  // the sole authority on what's actually bookable.
  const overlappingRanges =
    carListing && availability && requestedDate
      ? availability.unavailable.filter((range) =>
          rangesOverlap(
            requestedDate,
            isHourly ? requestedDate : requestedEndDate || requestedDate,
            range.startDate,
            range.endDate,
          ),
        )
      : [];

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!token) return;
    setSubmitting(true);
    setError(null);
    try {
      const booking = await createBooking(token, {
        businessId: business?.id,
        creatorId: creator?.id,
        carListingId: carListing?.id,
        requestedDate,
        requestedEndDate: isHourly ? undefined : requestedEndDate || undefined,
        rentalUnit: isHourly ? "hour" : undefined,
        requestedStartTime: isHourly ? requestedStartTime : undefined,
        requestedEndTime: isHourly ? requestedEndTime : undefined,
        partySize: partySize ? Number(partySize) : undefined,
        withDriver: carListing ? withDriver : undefined,
        wantsAdditionalDriver: carListing ? wantsAdditionalDriver : undefined,
        pickupLocation: carListing
          ? pickupLocation.trim() || undefined
          : undefined,
        notes: notes.trim() || undefined,
      });
      setSent({ status: booking.status });
      setShowForm(false);
      if (business) {
        recordAnalyticsEvent(business.linkedPlaceId, "booking_request");
      } else if (creator) {
        recordCreatorAnalyticsEvent(targetId, "booking_request");
      }
      // No AnalyticsEvent dimension exists for a car listing yet — skip
      // rather than misusing one of the other target ids.
    } catch (err) {
      setError(
        err instanceof HttpError
          ? err.message
          : "Something went wrong. Please try again.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  if (isOwner) {
    return (
      <p className="rounded-xl border border-dashed border-slate-300 dark:border-slate-700 px-4 py-3 text-sm text-slate-500 dark:text-slate-400">
        You manage this listing —{" "}
        <Link
          href="/account/bookings"
          className="font-medium text-brand-700 dark:text-brand-300 hover:underline"
        >
          view incoming requests
        </Link>
        .
      </p>
    );
  }

  if (sent) {
    const isConfirmed = sent.status === "confirmed";
    return (
      <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
        <p className="font-medium">
          {isConfirmed
            ? "Booking confirmed!"
            : `Request sent — ${formatBookingStatus(sent.status).toLowerCase()}.`}
        </p>
        <p className="mt-1">
          {isConfirmed
            ? "Instant Book confirmed this immediately — no need to wait for a response."
            : "You'll hear back with a confirm or decline."}{" "}
          Track it under{" "}
          <Link href="/account/bookings" className="font-medium underline">
            My Bookings
          </Link>
          .
        </p>
      </div>
    );
  }

  if (!ready) return null;

  if (!user) {
    return (
      <p className="rounded-xl border border-dashed border-slate-300 dark:border-slate-700 px-4 py-3 text-sm text-slate-500 dark:text-slate-400">
        <Link
          href={
            returnTo ? `/login?next=${encodeURIComponent(returnTo)}` : "/login"
          }
          className={`inline-flex min-h-11 items-center justify-center rounded-2xl bg-brand-700 px-4 py-2 font-semibold text-white transition-colors hover:bg-brand-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-400 focus-visible:ring-offset-2 ${prominent ? "w-full text-base shadow-sm sm:text-lg" : "text-sm"}`}
        >
          Log in to request a booking
        </Link>
      </p>
    );
  }

  const requestToBookClass = `inline-flex min-h-11 w-full items-center justify-center rounded-2xl bg-brand-700 px-4 py-2 font-semibold text-white transition-colors hover:bg-brand-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-400 focus-visible:ring-offset-2 ${prominent ? "text-base shadow-sm sm:text-lg" : "text-sm"}`;

  if (mode === "link" && href) {
    return (
      <Link href={href} className={requestToBookClass}>
        Request to book
      </Link>
    );
  }

  if (!showForm) {
    return (
      <button
        type="button"
        onClick={() => setShowForm(true)}
        className={requestToBookClass}
      >
        Request to book
      </button>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-col gap-3 rounded-xl border border-slate-200 dark:border-slate-800 p-3"
    >
      {carListing?.pricePerHour != null && (
        <div className="flex gap-1 self-start rounded-full bg-slate-100 p-1 text-sm font-medium dark:bg-slate-800">
          <button
            type="button"
            onClick={() => setRentalUnit("day")}
            className={`rounded-full px-3 py-1 transition-colors ${
              rentalUnit === "day"
                ? "bg-white text-brand-700 shadow-sm dark:bg-slate-900 dark:text-brand-300"
                : "text-slate-600 dark:text-slate-300"
            }`}
          >
            By day
          </button>
          <button
            type="button"
            onClick={() => setRentalUnit("hour")}
            className={`rounded-full px-3 py-1 transition-colors ${
              rentalUnit === "hour"
                ? "bg-white text-brand-700 shadow-sm dark:bg-slate-900 dark:text-brand-300"
                : "text-slate-600 dark:text-slate-300"
            }`}
          >
            By hour
          </button>
        </div>
      )}

      {/* Stacked below `sm` — a native date input's own chrome
          (mm/dd/yyyy plus the calendar icon) doesn't shrink past a
          point, so two side by side in a `grid-cols-2` had nowhere to
          go but overlap/wrap on a real phone. Two columns only once
          there's actually room. */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1 text-sm font-medium text-slate-700 dark:text-slate-200">
          {carListing ? (isHourly ? "Date" : "Pickup date") : "Date"}
          <input
            type="date"
            required
            value={requestedDate}
            onChange={(e) => setRequestedDate(e.target.value)}
            className="rounded-lg border border-slate-300 dark:border-slate-700 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
          />
        </label>
        {!isHourly && (
          <label className="flex flex-col gap-1 text-sm font-medium text-slate-700 dark:text-slate-200">
            {carListing ? "Return date" : "Check-out (optional)"}
            <input
              type="date"
              required={Boolean(carListing)}
              value={requestedEndDate}
              onChange={(e) => setRequestedEndDate(e.target.value)}
              className="rounded-lg border border-slate-300 dark:border-slate-700 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
            />
          </label>
        )}
      </div>

      {isHourly && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className="flex flex-col gap-1 text-sm font-medium text-slate-700 dark:text-slate-200">
            Start time
            <input
              type="time"
              required
              value={requestedStartTime}
              onChange={(e) => setRequestedStartTime(e.target.value)}
              className="rounded-lg border border-slate-300 dark:border-slate-700 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm font-medium text-slate-700 dark:text-slate-200">
            End time
            <input
              type="time"
              required
              value={requestedEndTime}
              onChange={(e) => setRequestedEndTime(e.target.value)}
              className="rounded-lg border border-slate-300 dark:border-slate-700 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
            />
          </label>
        </div>
      )}

      {carListing && overlappingRanges.length > 0 && (
        <p className="rounded-lg bg-gold-500/10 px-3 py-2 text-xs text-gold-800 dark:text-gold-300">
          These dates overlap with an existing request, booking, or an
          owner-blocked period. You can still send this request, but it may
          be declined. Unavailable:{" "}
          {overlappingRanges.map((r) => `${r.startDate}–${r.endDate}`).join(", ")}
        </p>
      )}

      {estimatedTotal != null && (
        <p className="text-sm font-medium text-slate-700 dark:text-slate-200">
          Estimated total: {formatCost(estimatedTotal)}
        </p>
      )}

      {carListing ? (
        <>
          {carListing.withDriverAvailable && (
            <label className="flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-200">
              <input
                type="checkbox"
                checked={withDriver}
                onChange={(e) => setWithDriver(e.target.checked)}
                className="h-4 w-4 rounded border-slate-300 text-brand-700 focus:ring-brand-500 dark:border-slate-700"
              />
              Add a driver
              {isHourly
                ? carListing.driverFeePerHour != null && (
                    <span className="text-slate-500 dark:text-slate-400">
                      (+${carListing.driverFeePerHour.toFixed(2)}/hr)
                    </span>
                  )
                : carListing.driverFeePerDay != null && (
                    <span className="text-slate-500 dark:text-slate-400">
                      (+${carListing.driverFeePerDay.toFixed(2)}/day)
                    </span>
                  )}
            </label>
          )}
          {carListing.additionalDriverAllowed && (
            <label className="flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-200">
              <input
                type="checkbox"
                checked={wantsAdditionalDriver}
                onChange={(e) => setWantsAdditionalDriver(e.target.checked)}
                className="h-4 w-4 rounded border-slate-300 text-brand-700 focus:ring-brand-500 dark:border-slate-700"
              />
              Add an additional driver
              {carListing.additionalDriverFee != null && (
                <span className="text-slate-500 dark:text-slate-400">
                  (+{formatCost(carListing.additionalDriverFee)}, one-time)
                </span>
              )}
            </label>
          )}
          <label className="flex flex-col gap-1 text-sm font-medium text-slate-700 dark:text-slate-200">
            Pickup location (optional)
            <input
              type="text"
              maxLength={200}
              placeholder={
                carListing.pickupLocation ??
                "Where should the car be picked up?"
              }
              value={pickupLocation}
              onChange={(e) => setPickupLocation(e.target.value)}
              className="rounded-lg border border-slate-300 dark:border-slate-700 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
            />
          </label>
          {(carListing.mileageLimitPerDay != null ||
            carListing.securityDeposit != null) && (
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {carListing.mileageLimitPerDay != null &&
                `Mileage limit: ${carListing.mileageLimitPerDay} mi/day. `}
              {carListing.securityDeposit != null &&
                `Security deposit of ${formatCost(carListing.securityDeposit)} is collected separately, not through this request.`}
            </p>
          )}
        </>
      ) : (
        <label className="flex flex-col gap-1 text-sm font-medium text-slate-700 dark:text-slate-200">
          Party size (optional)
          <input
            type="number"
            min={1}
            max={50}
            value={partySize}
            onChange={(e) => setPartySize(e.target.value)}
            className="rounded-lg border border-slate-300 dark:border-slate-700 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
          />
        </label>
      )}

      <label className="flex flex-col gap-1 text-sm font-medium text-slate-700 dark:text-slate-200">
        Leave a message (optional)
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          maxLength={2000}
          rows={3}
          className="rounded-lg border border-slate-300 dark:border-slate-700 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
        />
      </label>

      {error && (
        <p
          role="alert"
          className="rounded-lg bg-flag-500/10 px-3 py-2 text-sm text-flag-700 dark:text-flag-300"
        >
          {error}
        </p>
      )}

      <p className="text-xs text-slate-500 dark:text-slate-400">
        {carListing?.instantBookEnabled
          ? "Instant Book — this will confirm immediately, no waiting for approval. No payment is taken now."
          : "This sends a request rather than an instant booking — you'll get a confirm or decline. No payment is taken now."}
      </p>

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={submitting}
          className="rounded-full bg-brand-700 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-800 disabled:opacity-60"
        >
          {submitting ? "Sending…" : "Send request"}
        </button>
        <button
          type="button"
          onClick={() => setShowForm(false)}
          className="rounded-full border border-slate-300 dark:border-slate-700 px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-200 hover:border-slate-400 dark:hover:border-slate-500"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
