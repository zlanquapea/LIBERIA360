"use client";

import { useEffect, useRef, useState } from "react";
import { CameraIcon, CheckCircleIcon, ExclamationTriangleIcon, StopIcon } from "@heroicons/react/24/outline";
import { Html5Qrcode } from "html5-qrcode";
import { redeemEventTicket } from "@/lib/event-ticket-api";
import { HttpError } from "@/lib/http";

export function EventTicketScanner({ eventId, token }: { eventId: string; token: string }) {
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const processingRef = useRef(false);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [manualPayload, setManualPayload] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);

  async function stopCamera() {
    const scanner = scannerRef.current;
    scannerRef.current = null;
    if (scanner) {
      try {
        if (scanner.isScanning) await scanner.stop();
      } catch {
        // The camera may already have been stopped by the browser.
      }
      try {
        scanner.clear();
      } catch {
        // Clearing an already-removed reader is safe to ignore.
      }
    }
    setCameraOpen(false);
    setScanning(false);
  }

  useEffect(() => {
    return () => {
      const scanner = scannerRef.current;
      if (!scanner) return;
      if (scanner.isScanning) void scanner.stop().catch(() => undefined);
      try {
        scanner.clear();
      } catch {
        // Cleanup is best effort during unmount.
      }
    };
  }, []);

  async function redeem(payload: string) {
    if (processingRef.current || !payload.trim()) return;
    processingRef.current = true;
    setError(null);
    setMessage(null);
    try {
      const result = await redeemEventTicket(token, eventId, payload.trim());
      setMessage(`${result.eventName}: pass ${result.ticketNumber} accepted at ${new Date(result.redeemedAt).toLocaleTimeString()}.`);
      setManualPayload("");
    } catch (err) {
      setError(err instanceof HttpError ? err.message : "This QR code could not be validated.");
    } finally {
      processingRef.current = false;
    }
  }

  async function startCamera() {
    setError(null);
    setMessage(null);
    setCameraOpen(true);
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    const scanner = new Html5Qrcode("ticket-qr-reader");
    scannerRef.current = scanner;
    try {
      await scanner.start(
        { facingMode: "environment" },
        { fps: 10, qrbox: { width: 250, height: 250 }, aspectRatio: 1 },
        async (decodedText) => {
          if (processingRef.current) return;
          await stopCamera();
          await redeem(decodedText);
        },
        () => {
          // Decode misses are expected while the camera is moving or focusing.
        },
      );
      setScanning(true);
    } catch {
      await stopCamera();
      setError("Camera permission was denied or unavailable. You can still validate by pasting the QR payload below.");
    }
  }

  return (
    <section className="rounded-2xl border border-brand-200 bg-brand-50/70 p-4 dark:border-brand-900/60 dark:bg-brand-950/20">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="flex items-center gap-2 text-sm font-bold text-brand-950 dark:text-brand-50"><CameraIcon className="h-5 w-5" aria-hidden /> Scan event tickets</p>
          <p className="mt-1 text-xs leading-5 text-slate-600 dark:text-slate-300">Each valid ticket is accepted once. Keep the attendee’s QR code private and scan it at the entrance.</p>
        </div>
        {cameraOpen ? <button type="button" onClick={() => void stopCamera()} className="flex min-h-11 shrink-0 items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 text-xs font-semibold text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"><StopIcon className="h-4 w-4" aria-hidden /> Stop</button> : <button type="button" onClick={() => void startCamera()} className="flex min-h-11 shrink-0 items-center gap-1.5 rounded-lg bg-brand-700 px-3 text-xs font-semibold text-white hover:bg-brand-800"><CameraIcon className="h-4 w-4" aria-hidden /> Open camera</button>}
      </div>
      {cameraOpen && <div className="relative mt-4 overflow-hidden rounded-xl bg-slate-950"><div id="ticket-qr-reader" className="min-h-64 w-full" aria-label="Camera preview for scanning tickets" /><div className="pointer-events-none absolute inset-8 rounded-xl border-2 border-gold-300/90" /><p className="absolute bottom-2 left-0 right-0 text-center text-xs font-medium text-white">{scanning ? "Point the camera at a QR code" : "Starting camera…"}</p></div>}
      {message && <p role="status" className="mt-3 flex items-start gap-2 rounded-lg bg-emerald-100 px-3 py-2 text-sm font-medium text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200"><CheckCircleIcon className="mt-0.5 h-5 w-5 shrink-0" aria-hidden />{message}</p>}
      {error && <p role="alert" className="mt-3 flex items-start gap-2 rounded-lg bg-red-100 px-3 py-2 text-sm text-red-800 dark:bg-red-950/40 dark:text-red-200"><ExclamationTriangleIcon className="mt-0.5 h-5 w-5 shrink-0" aria-hidden />{error}</p>}
      <form onSubmit={(event) => { event.preventDefault(); void redeem(manualPayload); }} className="mt-4 flex flex-col gap-2 sm:flex-row">
        <label className="sr-only" htmlFor="ticket-payload">Ticket QR payload</label>
        <input id="ticket-payload" value={manualPayload} onChange={(event) => setManualPayload(event.target.value)} placeholder="Paste a ticket QR payload" className="min-h-11 min-w-0 flex-1 rounded-lg border border-slate-300 bg-white px-3 text-sm outline-none focus:border-brand-600 focus:ring-2 focus:ring-brand-500/30 dark:border-slate-700 dark:bg-slate-900" />
        <button type="submit" disabled={!manualPayload.trim() || processingRef.current} className="min-h-11 rounded-lg border border-brand-700 px-4 text-sm font-semibold text-brand-800 disabled:cursor-not-allowed disabled:opacity-50 dark:text-brand-200">Validate manually</button>
      </form>
    </section>
  );
}
