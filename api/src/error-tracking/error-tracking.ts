import { Logger } from "@nestjs/common";
import type * as SentryNode from "@sentry/node";

const logger = new Logger("ErrorTracking");

// Type-only import above, real `require` below: the Sentry SDK (and the
// OpenTelemetry stack it brings with it) costs roughly 8MB of heap just
// to load, whether or not it's ever initialized. A deployment with no
// SENTRY_DSN shouldn't hold all of that in memory for the life of the
// process, so the SDK is only loaded once there is a DSN to use it with.
let sentry: typeof SentryNode | undefined;

/**
 * Crash reporting via Sentry — same progressive-enhancement shape as
 * PushService/MailService: unconfigured (no SENTRY_DSN) means this stays a
 * silent no-op forever after, and never blocks boot. This function is the
 * one and only place that decides whether Sentry is live — nothing
 * downstream (SentryExceptionsFilter) needs its own "is this configured"
 * branch, since Sentry.captureException() is itself a documented no-op
 * when Sentry.init() was never called.
 */
export function initErrorTracking(dsn: string, environment: string): void {
  if (!dsn) {
    logger.warn(
      "SENTRY_DSN not set — errors are only logged locally, not reported. See api/README.md.",
    );
    return;
  }
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const Sentry: typeof SentryNode = require("@sentry/node");
  Sentry.init({
    dsn,
    environment,
    // Error capture only — no performance/tracing overhead or extra
    // sampling config to reason about for what this integration is for.
    tracesSampleRate: 0,
  });
  sentry = Sentry;
  logger.log("Error tracking (Sentry) initialized.");
}

/**
 * Reports an exception to Sentry — a no-op until initErrorTracking() has
 * run with a DSN (the same "silent unless configured" contract
 * Sentry.captureException() itself had when this imported the SDK
 * unconditionally).
 */
export function captureException(exception: unknown): void {
  sentry?.captureException(exception);
}
