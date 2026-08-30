"use client";

import { useEffect, useRef, useState } from "react";
import { CameraIcon, CheckCircleIcon, ExclamationTriangleIcon, StopIcon } from "@heroicons/react/24/outline";
import { redeemEventTicket } from "@/lib/event-ticket-api";
import { HttpError } from "@/lib/http";

interface BarcodeDetectorLike {
  detect(source: HTMLVideoElement): Promise<Array<{ rawValue?: string }>>;
}

type BarcodeDetectorConstructor = new (options?: { formats?: string[] }) => BarcodeDetectorLike;

function getDetector(): BarcodeDetectorLike | null {
  if (typeof window === "undefined") return null;
  const Detector = (window as Window & { BarcodeDetector?: BarcodeDetectorConstructor }).BarcodeDetector;
  return Detector ? new Detector({ formats: ["qr_code"] }) : null;
}

export function EventTicketScanner({ eventId, token }: { eventId: string; token: string }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animationRef = useRef<number | null>(null);
  const processingRef = useRef(false);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [cameraSupported, setCameraSupported] = useState(true);
  const [manualPayload, setManualPayload] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);

  function stopCamera() {
    if (animationRef.current) cancelAnimationFrame(animationRef.current);
    animationRef.current = null;
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setCameraOpen(false);
    setScanning(false);
  }

  useEffect(() => () => stopCamera(), []);

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

  async function scanLoop(detector: BarcodeDetectorLike) {
    if (!cameraOpen || !videoRef.current || processingRef.current) {
      if (cameraOpen) animationRef.current = requestAnimationFrame(() => void scanLoop(detector));
      return;
    }
    try {
      const codes = await detector.detect(videoRef.current);
      const value = codes[0]?.rawValue;
      if (value) await redeem(value);
    } catch {
      // Camera frames can be unavailable briefly while a phone changes focus.
    }
    if (cameraOpen) animationRef.current = requestAnimationFrame(() => void scanLoop(detector));
  }

  async function startCamera() {
    setError(null);
    setMessage(null);
    const detector = getDetector();
    if (!detector) {
      setCameraSupported(false);
      setError("Camera QR scanning is not supported in this browser. Use the secure manual payload fallback below or open this page in Chrome on Android.");
      return;
    }
    if (!navigator.mediaDevices?.getUserMedia) {
      setError("Camera access is unavailable. Use the manual payload fallback below.");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: "environment" } }, audio: false });
      streamRef.current = stream;
      if (!videoRef.current) return;
      videoRef.current.srcObject = stream;
      await videoRef.current.play();
      setCameraOpen(true);
      setScanning(true);
      animationRef.current = requestAnimationFrame(() => void scanLoop(detector));
    } catch {
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
        {cameraOpen ? <button type="button" onClick={stopCamera} className="flex min-h-11 shrink-0 items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 text-xs font-semibold text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"><StopIcon className="h-4 w-4" aria-hidden /> Stop</button> : <button type="button" onClick={() => void startCamera()} className="flex min-h-11 shrink-0 items-center gap-1.5 rounded-lg bg-brand-700 px-3 text-xs font-semibold text-white hover:bg-brand-800"><CameraIcon className="h-4 w-4" aria-hidden /> Open camera</button>}
      </div>
      {cameraOpen && <div className="relative mt-4 overflow-hidden rounded-xl bg-slate-950"><video ref={videoRef} muted playsInline className="aspect-video w-full object-cover" aria-label="Camera preview for scanning tickets" /><div className="pointer-events-none absolute inset-8 rounded-xl border-2 border-gold-300/90" /><p className="absolute bottom-2 left-0 right-0 text-center text-xs font-medium text-white">{scanning ? "Point the camera at a QR code" : "Starting camera…"}</p></div>}
      {!cameraSupported && <p className="mt-3 text-xs text-slate-600 dark:text-slate-300">Native QR scanning is unavailable on this browser.</p>}
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
