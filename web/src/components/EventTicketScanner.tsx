"use client";

import { useEffect, useRef, useState } from "react";
import {
  CameraIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  NoSymbolIcon,
  StopIcon,
  TicketIcon,
} from "@heroicons/react/24/outline";
import { Html5Qrcode } from "html5-qrcode";
import { redeemEventTicket } from "@/lib/event-ticket-api";
import { HttpError } from "@/lib/http";
import type { EventTicketScanResult } from "@/lib/types";

// Visual language per scan outcome — staff should be able to tell these
// apart at a glance, before reading a single word: a clear green "go", a
// firm amber/red "no", never an ambiguous middle state.
const OUTCOME_STYLE: Record<
  EventTicketScanResult["outcome"],
  { shell: string; icon: typeof CheckCircleIcon; heading: string }
> = {
  valid: {
    shell: "border-emerald-300 bg-emerald-50 text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-100",
    icon: CheckCircleIcon,
    heading: "VALID TICKET",
  },
  already_used: {
    shell: "border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100",
    icon: ExclamationTriangleIcon,
    heading: "TICKET ALREADY USED",
  },
  cancelled: {
    shell: "border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100",
    icon: NoSymbolIcon,
    heading: "TICKET CANCELLED",
  },
  wrong_event: {
    shell: "border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100",
    icon: ExclamationTriangleIcon,
    heading: "WRONG EVENT",
  },
  invalid: {
    shell: "border-red-300 bg-red-50 text-red-900 dark:border-red-800 dark:bg-red-950/40 dark:text-red-100",
    icon: ExclamationTriangleIcon,
    heading: "INVALID TICKET",
  },
};

function ScanResultCard({ result }: { result: EventTicketScanResult }) {
  const style = OUTCOME_STYLE[result.outcome];
  const Icon = style.icon;
  return (
    <div
      className={`mt-3 rounded-2xl border-2 p-4 ${style.shell}`}
      role={result.outcome === "valid" ? "status" : "alert"}
    >
      <div className="flex items-center gap-2">
        <Icon aria-hidden className="h-6 w-6 shrink-0" />
        <span className="text-sm font-black uppercase tracking-wide">{style.heading}</span>
      </div>
      {result.ticket && (
        <>
          {/* The ticket type is deliberately the single largest, boldest
              element here — staff enforcing VIP/Regular/Backstage access
              should never have to hunt for it. */}
          <p className="mt-2 text-2xl font-black leading-tight sm:text-3xl">
            {result.ticket.ticketTypeName}
          </p>
          <p className="mt-0.5 text-sm font-semibold opacity-80">{result.ticket.eventName}</p>
          <p className="mt-1 font-mono text-xs opacity-70">Ticket ID: {result.ticket.ticketNumber}</p>
        </>
      )}
      <p className="mt-2 text-sm leading-5">{result.message}</p>
      {result.outcome === "already_used" && result.firstScannedAt && (
        <p className="mt-1 text-xs font-semibold">
          First scanned:{" "}
          {new Date(result.firstScannedAt).toLocaleString(undefined, {
            dateStyle: "long",
            timeStyle: "short",
          })}
        </p>
      )}
      {result.outcome === "valid" && (
        <p className="mt-2 text-sm font-black uppercase tracking-wide">Entry Approved</p>
      )}
    </div>
  );
}

export function EventTicketScanner({ eventId, token }: { eventId: string; token: string }) {
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const processingRef = useRef(false);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [manualPayload, setManualPayload] = useState("");
  const [result, setResult] = useState<EventTicketScanResult | null>(null);
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
    setResult(null);
    try {
      const scanResult = await redeemEventTicket(token, eventId, payload.trim());
      setResult(scanResult);
      setManualPayload("");
    } catch (err) {
      setError(err instanceof HttpError ? err.message : "This QR code could not be validated.");
    } finally {
      processingRef.current = false;
    }
  }

  async function startCamera() {
    setError(null);
    setResult(null);
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
      {result && <ScanResultCard result={result} />}
      {error && <p role="alert" className="mt-3 flex items-start gap-2 rounded-lg bg-red-100 px-3 py-2 text-sm text-red-800 dark:bg-red-950/40 dark:text-red-200"><ExclamationTriangleIcon className="mt-0.5 h-5 w-5 shrink-0" aria-hidden />{error}</p>}
      <form onSubmit={(event) => { event.preventDefault(); void redeem(manualPayload); }} className="mt-4 flex flex-col gap-2 sm:flex-row">
        <label className="sr-only" htmlFor="ticket-payload">Ticket QR payload</label>
        <input id="ticket-payload" value={manualPayload} onChange={(event) => setManualPayload(event.target.value)} placeholder="Paste a ticket QR payload" className="min-h-11 min-w-0 flex-1 rounded-lg border border-slate-300 bg-white px-3 text-sm outline-none focus:border-brand-600 focus:ring-2 focus:ring-brand-500/30 dark:border-slate-700 dark:bg-slate-900" />
        <button type="submit" disabled={!manualPayload.trim() || processingRef.current} className="min-h-11 rounded-lg border border-brand-700 px-4 text-sm font-semibold text-brand-800 disabled:cursor-not-allowed disabled:opacity-50 dark:text-brand-200">Validate manually</button>
      </form>
      <p className="mt-3 flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400"><TicketIcon aria-hidden className="h-3.5 w-3.5" /> Every scan is checked against the server — a ticket’s category and access level are never trusted from the QR code alone.</p>
    </section>
  );
}
