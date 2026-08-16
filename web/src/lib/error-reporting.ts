import * as Sentry from '@sentry/browser';

let initialized = false;

// Client-side crash reporting — same "no-op unless configured" shape as
// this app's other optional integrations (PushService/MailService on the
// API): an unset NEXT_PUBLIC_SENTRY_DSN means initErrorReporting() and
// reportError() below are both silent no-ops forever after, nothing else
// needs to check or know.
//
// Deliberately @sentry/browser rather than the full @sentry/nextjs SDK:
// this covers client-side JS errors (the ones a real visitor's browser
// actually throws) via the two error boundaries below and the global
// listeners in ErrorReportingInit, not Next.js server-side rendering
// errors — a smaller, version-stable API surface traded for not pulling in
// a build-time webpack plugin + source-map upload pipeline this project
// has no real Sentry account to verify end-to-end.
export function initErrorReporting(): void {
  if (initialized) return;
  const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;
  if (!dsn) return;
  Sentry.init({ dsn, environment: process.env.NODE_ENV });
  initialized = true;
}

export function reportError(error: unknown, context?: Record<string, unknown>): void {
  if (!initialized) return;
  Sentry.captureException(error, context ? { extra: context } : undefined);
}
