import { ArgumentsHost, Catch, HttpException } from "@nestjs/common";
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
 */
@Catch()
export class SentryExceptionsFilter extends BaseExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const isExpectedClientError =
      exception instanceof HttpException && exception.getStatus() < 500;
    if (!isExpectedClientError) {
      Sentry.captureException(exception);
    }
    super.catch(exception, host);
  }
}
