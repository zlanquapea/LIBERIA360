'use client';

import { useEffect, useRef, useState } from 'react';
import { ArrowDownTrayIcon, PhotoIcon, ShareIcon, XMarkIcon } from '@heroicons/react/24/outline';
import { colorForCategory } from '@/lib/category-colors';
import { formatTripDateRange } from '@/lib/format';
import type { ItineraryStopWithPlace } from '@/lib/types';

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
// 1080x1920 (9:16) — the aspect ratio Instagram/WhatsApp stories and most
// phone lock screens actually use, drawn at native resolution so the
// exported PNG stays crisp when posted, not just the on-screen preview.
const CARD_WIDTH = 1080;
const CARD_HEIGHT = 1920;
const MAX_STOPS_SHOWN = 6;

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

function drawCard(
  canvas: HTMLCanvasElement,
  trip: { title: string; startDate: string | null; endDate: string | null; stops: ItineraryStopWithPlace[] },
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
  ctx.fillText('MY LIBERIA TRIP', pad, 195);

  // Title (wrapped, up to 3 lines)
  ctx.fillStyle = '#ffffff';
  ctx.font = `800 76px ${FONT}`;
  const titleLines = wrapLines(ctx, trip.title, w - pad * 2).slice(0, 3);
  let y = 320;
  for (const line of titleLines) {
    ctx.fillText(line, pad, y);
    y += 86;
  }

  // Date range
  const dateRange = formatTripDateRange(trip.startDate, trip.endDate);
  if (dateRange) {
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.font = `500 40px ${FONT}`;
    ctx.fillText(dateRange, pad, y + 30);
    y += 30;
  }

  // Stat line
  const counties = new Set(trip.stops.map((stop) => stop.place.county.name));
  ctx.fillStyle = '#ffc63d';
  ctx.font = `700 38px ${FONT}`;
  const statLine = `${trip.stops.length} place${trip.stops.length === 1 ? '' : 's'} · ${counties.size} count${counties.size === 1 ? 'y' : 'ies'}`;
  ctx.fillText(statLine, pad, y + 90);

  // Place list
  let rowY = y + 190;
  const rowHeight = 108;
  const shown = trip.stops.slice(0, MAX_STOPS_SHOWN);
  for (const stop of shown) {
    ctx.fillStyle = colorForCategory(stop.place.category.slug);
    ctx.beginPath();
    ctx.arc(pad + 16, rowY - 14, 16, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#ffffff';
    ctx.font = `700 42px ${FONT}`;
    const name = wrapLines(ctx, stop.place.name, w - pad * 2 - 60)[0];
    ctx.fillText(name, pad + 56, rowY);

    ctx.fillStyle = 'rgba(255,255,255,0.6)';
    ctx.font = `500 30px ${FONT}`;
    ctx.fillText(stop.place.county.name, pad + 56, rowY + 40);

    rowY += rowHeight;
  }
  if (trip.stops.length > MAX_STOPS_SHOWN) {
    ctx.fillStyle = 'rgba(255,255,255,0.6)';
    ctx.font = `600 32px ${FONT}`;
    ctx.fillText(`+ ${trip.stops.length - MAX_STOPS_SHOWN} more`, pad + 56, rowY);
  }

  // Footer
  ctx.fillStyle = 'rgba(255,255,255,0.55)';
  ctx.font = `500 32px ${FONT}`;
  ctx.fillText('Plan your own trip — search, explore, and save what matters.', pad, h - 100);
  ctx.fillStyle = '#ffc63d';
  ctx.font = `800 34px ${FONT}`;
  ctx.fillText('LIBERIA360', pad, h - 56);
}

export function TripShareCard({
  trip,
}: {
  trip: { title: string; startDate: string | null; endDate: string | null; stops: ItineraryStopWithPlace[] };
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
        await navigator.share({ files: [file], title: trip.title, text: `My ${trip.title} on LIBERIA360` });
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
        aria-label="Create a shareable trip card"
        title="Create a shareable trip card"
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
              <p className="font-display text-sm font-bold text-slate-900 dark:text-slate-50">Your trip card</p>
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
