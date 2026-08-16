'use client';

import { useEffect } from 'react';
import { initErrorReporting, reportError } from '@/lib/error-reporting';

// Mounted once in the root layout, same pattern as ServiceWorkerRegister —
// a side-effect-only component, no UI. Initializes error reporting (a
// no-op if NEXT_PUBLIC_SENTRY_DSN isn't set) and wires the two error
// sources React's error boundaries below (error.tsx/global-error.tsx)
// don't see: an error thrown outside any component's render (a stray
// window.onerror) and an unhandled Promise rejection (a `.catch()` nobody
// wrote).
export function ErrorReportingInit() {
  useEffect(() => {
    initErrorReporting();

    function onError(event: ErrorEvent) {
      reportError(event.error ?? event.message);
    }
    function onUnhandledRejection(event: PromiseRejectionEvent) {
      reportError(event.reason);
    }

    window.addEventListener('error', onError);
    window.addEventListener('unhandledrejection', onUnhandledRejection);
    return () => {
      window.removeEventListener('error', onError);
      window.removeEventListener('unhandledrejection', onUnhandledRejection);
    };
  }, []);

  return null;
}
