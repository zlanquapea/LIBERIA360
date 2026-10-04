'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { CameraIcon, StopIcon } from '@heroicons/react/24/outline';
import type { Html5Qrcode } from 'html5-qrcode';

/** Pulls the prescription code out of a scanned QR (a /rx/CODE?t=… link) or typed text. */
export function codeFromScan(text: string) {
  const fromUrl = /\/rx\/([0-9A-Za-z-]{6,20})/.exec(text)?.[1];
  return (fromUrl ?? text).toUpperCase().replace(/[^0-9A-Z]/g, '');
}

/** Opens the camera and reports the first QR code it reads. */
export function RxScanner({ onCode }: { onCode: (code: string) => void }) {
  const readerId = useId().replace(/:/g, '');
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState('');

  async function stop() {
    const scanner = scannerRef.current;
    scannerRef.current = null;
    if (scanner) {
      try {
        if (scanner.isScanning) await scanner.stop();
        scanner.clear();
      } catch {
        // Already stopped by the browser.
      }
    }
    setOpen(false);
  }

  useEffect(
    () => () => {
      const scanner = scannerRef.current;
      if (scanner?.isScanning) void scanner.stop().catch(() => undefined);
    },
    [],
  );

  async function start() {
    setError('');
    setOpen(true);
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    const { Html5Qrcode } = await import('html5-qrcode');
    const scanner = new Html5Qrcode(readerId);
    scannerRef.current = scanner;
    try {
      await scanner.start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 240, height: 240 }, aspectRatio: 1 },
        async (text) => {
          await stop();
          onCode(codeFromScan(text));
        },
        () => undefined,
      );
    } catch {
      await stop();
      setError("The camera isn't available. Type the code from the prescription instead.");
    }
  }

  return (
    <div className="flex flex-col gap-2">
      {open ? (
        <button type="button" onClick={() => void stop()} className="btn-secondary min-h-11 gap-1.5 self-start">
          <StopIcon aria-hidden className="h-5 w-5" /> Stop camera
        </button>
      ) : (
        <button type="button" onClick={() => void start()} className="btn-primary min-h-11 gap-1.5 self-start">
          <CameraIcon aria-hidden className="h-5 w-5" /> Scan QR code
        </button>
      )}
      {open && (
        <div className="relative overflow-hidden rounded-2xl bg-slate-950">
          <div id={readerId} className="min-h-64 w-full" aria-label="Camera preview" />
          <div className="pointer-events-none absolute inset-8 rounded-xl border-2 border-gold-300/90" />
        </div>
      )}
      {error && (
        <p role="alert" className="error-state">
          {error}
        </p>
      )}
    </div>
  );
}
