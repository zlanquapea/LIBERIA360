import { ArgumentsHost, Catch, HttpException, Logger } from "@nestjs/common";
import { BaseExceptionFilter } from "@nestjs/core";
import * as Sentry from "@sentry/node";

/**
 * Global exception filter — reports to Sentry before delegating to Nest's
 * normal exception handling (via BaseExceptionFilter, so the actual HTTP
 * response shape is unchanged either way). Only genuinely unexpected
 * failures get reported: a 4xx HttpException (bad input, unauthorized,
 * not found, ...) is expected, routine traffic, not a crash — reporting
 * every 404 to Sentry would drown out the failures actually worth looking
 * at. Everything else (an unhandled 500, a non-HttpException thrown from
 * anywhere in the app) gets captured.
 *
 * Safe to register unconditionally, configured or not: captureException()
 * is a documented no-op when Sentry.init() was never called (see
 * initErrorTracking) — this filter doesn't need its own configured check.
 *
 * Security audit (Sep 4, 2026 — CVSS 8.2): a pentest flagged that
 * unhandled backend failures (e.g. a raw TypeORM/driver error escaping a
 * service) could reach the client as a verbose message — schema/column
 * names, driver text, or a stack trace, all useful to an attacker mapping
 * this app's internals. Nest's own `BaseExceptionFilter` already replies
 * with a generic `{statusCode: 500, message: "Internal Server Error"}`
 * for anything that isn't itself an `HttpException` (or shaped like one),
 * logging the real detail server-side instead — but that safety net lived
 * entirely inside a dependency's undocumented default behavior, easy to
 * lose across an upgrade or an `ExceptionsHandler` change nobody notices.
 * `catch` below now makes that guarantee explicit and independent of it:
 * only a real `HttpException` (the app's own deliberate 4xx/5xx throws,
 * whose message is always something written for an end user) is ever
 * allowed to shape the response body; anything else always gets the same
 * generic message here, never the thrown error's own `.message`.
 */
@Catch()
export class SentryExceptionsFilter extends BaseExceptionFilter {
  private readonly errorLogger = new Logger(SentryExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const isExpectedClientError =
      exception instanceof HttpException && exception.getStatus() < 500;
    if (!isExpectedClientError) {
      Sentry.captureException(exception);
    }

    if (exception instanceof HttpException) {
      super.catch(exception, host);
      return;
    }

    // Not a deliberate HttpException — an unhandled bug of some kind.
    // Log the real detail server-side (where an operator can act on it)
    // and reply with a fixed, generic body regardless of what the
    // exception itself says, rather than trusting a base class or a
    // driver library to have already sanitized it for us. (Nest's own
    // `handleUnknownError` would echo `exception.message` verbatim for
    // *any* object carrying both a `.statusCode` and a `.message` — not
    // just a real HttpException — which is a looser bar than it sounds:
    // a body-parser SyntaxError, say, is shaped exactly like that.)
    this.errorLogger.error(
      "Unhandled exception",
      exception instanceof Error ? exception.stack : String(exception),
    );
    const applicationRef =
      this.applicationRef ??
      (this.httpAdapterHost && this.httpAdapterHost.httpAdapter);
    if (!applicationRef) {
      // Same contract as BaseExceptionFilter's own constructor — one of
      // these two is always supplied in a real Nest app (main.ts passes
      // the adapter directly). Nothing sane to reply with if neither is.
      throw new Error(
        "SentryExceptionsFilter has no HTTP adapter to reply with",
      );
    }
    const response = host.getArgByIndex(1);
    const body = { statusCode: 500, message: "Internal server error" };
    if (!applicationRef.isHeadersSent(response)) {
      applicationRef.reply(response, body, body.statusCode);
    } else {
      applicationRef.end(response);
    }
  }
}
