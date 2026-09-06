'use client';

import { useEffect, useRef, useState } from 'react';
import { ArrowDownTrayIcon, PhotoIcon, ShareIcon, XMarkIcon } from '@heroicons/react/24/outline';
import { colorForCategory } from '@/lib/category-colors';
import { formatTripDateRange } from '@/lib/format';
import type { ItineraryStopWithPlace, Place } from '@/lib/types';

// "Make it amazing" pass, item 3/5: the app already lets a trip owner
// share a plain link (ShareMenu, on every trip page) — this adds the
// thing a link can't be: an actual image someone would post to a story
// or send in a chat, styled like a real travel-brand product instead of
// a screenshot of the app's own UI.
//
// Drawn on an offscreen <canvas> rather than composed as a DOM node and
// rasterized with a screenshot library (html2canvas/dom-to-image) — no
// new dependency, and it sidesteps that whole approach's usual failure
// mode (a cross-origin photo tainting the canvas and silently breaking
// the export) by never drawing a real photo onto the canvas at all. The
// per-stop accent dot reuses `colorForCategory` — the same deterministic
// palette every category badge/icon in the app already uses — so the
// card still reads as personalized to *this* trip's mix of places
// without needing any image asset to load, decode, or fail.
//
// UX fix (Sep 6, 2026): this used to draw *only* `trip.stops` — the
// places a traveler adds one at a time after creating the trip — so a
// brand-new trip with no stops yet produced a card reading "0 places · 0
// counties" with an empty list below it, and callers hid the share
// button entirely until a stop existed. But every trip already has a
// `destination` (a real catalog Place, required at creation — see
// TripPlannerForm) before a single stop is ever added; it's the most
// important place on the trip, not an afterthought. The destination is
// now the card's hero — its own accent-colored panel, always drawn — and
// `stops` are the supporting "also visiting" list underneath, so a card
// is shareable the moment a trip exists, exactly like it should be.
//
// 1080x1920 (9:16) — the aspect ratio Instagram/WhatsApp stories and most
// phone lock screens actually use, drawn at native resolution so the
// exported PNG stays crisp when posted, not just the on-screen preview.
const CARD_WIDTH = 1080;
const CARD_HEIGHT = 1920;
const MAX_STOPS_SHOWN = 5;

// A trip has something worth a card the moment it has a destination or a
// stop — used by both call sites in TripDetailClient to decide whether to
// render the share button at all (older trips predating the destination
// field, and the itinerary-preview response, can have neither).
export function tripHasShareableContent(trip: {
  destination: Place | null;
  stops: ItineraryStopWithPlace[];
}): boolean {
  return Boolean(trip.destination) || trip.stops.length > 0;
}

function wrapLines(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const words = text.split(' ');
  const lines: string[] = [];
  let current = '';
  for (const word of words) {
    const attempt = current ? `${current} ${word}` : word;
    if (ctx.measureText(attempt).width > maxWidth && current) {
      lines.push(current);
      current = word;
    } else {
      current = attempt;
    }
  }
  if (current) lines.push(current);
  return lines;
}

// Canvas has no built-in rounded-rect fill on every engine this PNG might
// eventually be regenerated on, so a tiny manual path keeps this
// independent of `ctx.roundRect` support.
function roundRectPath(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
) {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + width, y, x + width, y + height, radius);
  ctx.arcTo(x + width, y + height, x, y + height, radius);
  ctx.arcTo(x, y + height, x, y, radius);
  ctx.arcTo(x, y, x + width, y, radius);
  ctx.closePath();
}

function hexToRgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function drawCard(
  canvas: HTMLCanvasElement,
  trip: {
    title: string;
    startDate: string | null;
    endDate: string | null;
    destination: Place | null;
    stops: ItineraryStopWithPlace[];
  },
) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const w = CARD_WIDTH;
  const h = CARD_HEIGHT;
  const pad = 88;

  // Background — the same navy gradient + soft glow-blob language as the
  // home page hero, so a card someone downloads still reads as this app's
  // own brand rather than a generic template.
  const bg = ctx.createLinearGradient(0, 0, w, h);
  bg.addColorStop(0, '#16307a');
  bg.addColorStop(0.55, '#0e2361');
  bg.addColorStop(1, '#050b24');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, w, h);

  const glow1 = ctx.createRadialGradient(w - 120, 160, 20, w - 120, 160, 340);
  glow1.addColorStop(0, 'rgba(255,198,61,0.28)');
  glow1.addColorStop(1, 'rgba(255,198,61,0)');
  ctx.fillStyle = glow1;
  ctx.fillRect(0, 0, w, h);

  const glow2 = ctx.createRadialGradient(90, h - 260, 20, 90, h - 260, 380);
  glow2.addColorStop(0, 'rgba(58,160,30,0.22)');
  glow2.addColorStop(1, 'rgba(58,160,30,0)');
  ctx.fillStyle = glow2;
  ctx.fillRect(0, 0, w, h);

  const FONT = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.textBaseline = 'alphabetic';

  // Eyebrow / wordmark
  ctx.fillStyle = '#ffc63d';
  ctx.font = `800 30px ${FONT}`;
  ctx.fillText('LIBERIA360', pad, 150);
  ctx.fillStyle = 'rgba(255,255,255,0.65)';
  ctx.font = `600 26px ${FONT}`;
  ctx.fillText('MY LIBERIA EXPERIENCE', pad, 195);

  // Title (wrapped, up to 3 lines)
  ctx.fillStyle = '#ffffff';
  ctx.font = `800 76px ${FONT}`;
  const titleLines = wrapLines(ctx, trip.title, w - pad * 2).slice(0, 3);
  let cursorY = 320;
  for (const line of titleLines) {
    ctx.fillText(line, pad, cursorY);
    cursorY += 86;
  }

  // Date range
  const dateRange = formatTripDateRange(trip.startDate, trip.endDate);
  if (dateRange) {
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.font = `500 40px ${FONT}`;
    cursorY += 26;
    ctx.fillText(dateRange, pad, cursorY);
  }

  // Destination hero panel — the trip's anchor place, always drawn when
  // one exists (it's required at creation, so this is the normal case).
  // Styled like a ticket-stub stub-strip: a solid accent spine in the
  // destination's category color, with the same tinted panel treatment
  // used elsewhere in the app for "this belongs to that category."
  const destination = trip.destination;
  if (destination) {
    const accent = colorForCategory(destination.category.slug);
    const chipX = pad;
    const chipW = w - pad * 2;
    const chipY = cursorY + 44;
    const innerX = chipX + 56;
    const innerW = chipW - 56 - 44;

    ctx.font = `800 56px ${FONT}`;
    const nameLines = wrapLines(ctx, destination.name, innerW).slice(0, 2);
    const chipH = 66 + nameLines.length * 62 + 58 + 44;

    roundRectPath(ctx, chipX, chipY, chipW, chipH, 28);
    ctx.fillStyle = hexToRgba(accent, 0.24);
    ctx.fill();
    roundRectPath(ctx, chipX, chipY, 14, chipH, 7);
    ctx.fillStyle = accent;
    ctx.fill();

    let destY = chipY + 60;
    ctx.fillStyle = 'rgba(255,255,255,0.72)';
    ctx.font = `800 26px ${FONT}`;
    ctx.fillText('DESTINATION', innerX, destY);

    destY += 58;
    ctx.fillStyle = '#ffffff';
    ctx.font = `800 56px ${FONT}`;
    for (const line of nameLines) {
      ctx.fillText(line, innerX, destY);
      destY += 62;
    }

    ctx.fillStyle = 'rgba(255,255,255,0.78)';
    ctx.font = `600 34px ${FONT}`;
    ctx.fillText(`${destination.county.name} County`, innerX, destY + 6);

    cursorY = chipY + chipH;
  }

  // "Also visiting" — stops the traveler added beyond the destination
  // itself (never the destination a second time, in case it was also
  // added as a stop for its own day).
  const extraStops = destination
    ? trip.stops.filter((stop) => stop.place.id !== destination.id)
    : trip.stops;

  if (extraStops.length > 0) {
    const counties = new Set<string>();
    if (destination) counties.add(destination.county.name);
    for (const stop of extraStops) counties.add(stop.place.county.name);
    const totalPlaces = (destination ? 1 : 0) + extraStops.length;

    ctx.fillStyle = '#ffc63d';
    ctx.font = `700 36px ${FONT}`;
    cursorY += 78;
    ctx.fillText(
      `${totalPlaces} place${totalPlaces === 1 ? '' : 's'} · ${counties.size} count${counties.size === 1 ? 'y' : 'ies'}`,
      pad,
      cursorY,
    );

    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    ctx.font = `600 28px ${FONT}`;
    cursorY += 48;
    ctx.fillText('ALSO VISITING', pad, cursorY);

    let rowY = cursorY + 78;
    const rowHeight = 104;
    const shown = extraStops.slice(0, MAX_STOPS_SHOWN);
    for (const stop of shown) {
      ctx.fillStyle = colorForCategory(stop.place.category.slug);
      ctx.beginPath();
      ctx.arc(pad + 16, rowY - 14, 16, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#ffffff';
      ctx.font = `700 40px ${FONT}`;
      const name = wrapLines(ctx, stop.place.name, w - pad * 2 - 60)[0];
      ctx.fillText(name, pad + 56, rowY);

      ctx.fillStyle = 'rgba(255,255,255,0.6)';
      ctx.font = `500 28px ${FONT}`;
      ctx.fillText(stop.place.county.name, pad + 56, rowY + 38);

      rowY += rowHeight;
    }
    if (extraStops.length > MAX_STOPS_SHOWN) {
      ctx.fillStyle = 'rgba(255,255,255,0.6)';
      ctx.font = `600 30px ${FONT}`;
      ctx.fillText(`+ ${extraStops.length - MAX_STOPS_SHOWN} more`, pad + 56, rowY);
    }
  }

  // Footer
  ctx.fillStyle = 'rgba(255,255,255,0.55)';
  ctx.font = `500 32px ${FONT}`;
  ctx.fillText('Plan your own experience — search, explore, and share what matters.', pad, h - 100);
  ctx.fillStyle = '#ffc63d';
  ctx.font = `800 34px ${FONT}`;
  ctx.fillText('LIBERIA360', pad, h - 56);
}

export function TripShareCard({
  trip,
}: {
  trip: {
    title: string;
    startDate: string | null;
    endDate: string | null;
    destination: Place | null;
    stops: ItineraryStopWithPlace[];
  };
}) {
  const [open, setOpen] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [canShareFile, setCanShareFile] = useState(false);

  useEffect(() => {
    if (!open) return;
    const canvas = canvasRef.current;
    if (canvas) drawCard(canvas, trip);
  }, [open, trip]);

  useEffect(() => {
    setCanShareFile(
      typeof navigator !== 'undefined' &&
        typeof navigator.share === 'function' &&
        typeof navigator.canShare === 'function' &&
        navigator.canShare({ files: [new File([], 'trip.png', { type: 'image/png' })] }),
    );
  }, []);

  async function download() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.toBlob((blob) => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${trip.title.replace(/[^a-z0-9]+/gi, '-').toLowerCase() || 'liberia360-trip'}.png`;
      a.click();
      URL.revokeObjectURL(url);
    }, 'image/png');
  }

  async function shareFile() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.toBlob(async (blob) => {
      if (!blob) return;
      const file = new File([blob], 'liberia360-trip.png', { type: 'image/png' });
      try {
        await navigator.share({ files: [file], title: trip.title, text: `My ${trip.title} experience on LIBERIA360` });
      } catch {
        // Cancelling the native share sheet is not an error to surface.
      }
    }, 'image/png');
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex h-12 w-12 min-w-0 items-center justify-center rounded-full bg-brand-700 text-white shadow-sm transition-colors hover:bg-brand-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-400"
        aria-label="Share your trip experience"
        title="Share your trip experience"
      >
        <PhotoIcon aria-hidden className="h-6 w-6" />
      </button>

      {open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Shareable trip card"
          className="fixed inset-0 z-[110] flex items-center justify-center bg-black/60 p-4"
          onClick={() => setOpen(false)}
        >
          <div
            className="flex max-h-[90vh] w-full max-w-sm flex-col gap-4 rounded-3xl bg-white p-4 shadow-2xl dark:bg-slate-900"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <p className="font-display text-sm font-bold text-slate-900 dark:text-slate-50">Share your experience</p>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close"
                className="rounded-full p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200"
              >
                <XMarkIcon aria-hidden className="h-5 w-5" />
              </button>
            </div>
            <div className="overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-800">
              <canvas
                ref={canvasRef}
                width={CARD_WIDTH}
                height={CARD_HEIGHT}
                className="block h-auto w-full"
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={download}
                className="flex min-h-11 items-center justify-center gap-1.5 rounded-xl border border-slate-200 px-3 text-sm font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                <ArrowDownTrayIcon aria-hidden className="h-4 w-4" />
                Download
              </button>
              {canShareFile ? (
                <button
                  type="button"
                  onClick={shareFile}
                  className="flex min-h-11 items-center justify-center gap-1.5 rounded-xl bg-brand-700 px-3 text-sm font-semibold text-white hover:bg-brand-800"
                >
                  <ShareIcon aria-hidden className="h-4 w-4" />
                  Share
                </button>
              ) : (
                <p className="flex items-center justify-center text-center text-xs text-slate-400 dark:text-slate-500">
                  Download, then share from your photos
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
