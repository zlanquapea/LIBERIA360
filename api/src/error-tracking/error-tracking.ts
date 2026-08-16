import { Logger } from "@nestjs/common";
import * as Sentry from "@sentry/node";

const logger = new Logger("ErrorTracking");

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
  Sentry.init({
    dsn,
    environment,
    // Error capture only — no performance/tracing overhead or extra
    // sampling config to reason about for what this integration is for.
    tracesSampleRate: 0,
  });
  logger.log("Error tracking (Sentry) initialized.");
}
