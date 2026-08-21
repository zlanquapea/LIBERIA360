import { HttpError } from './http';
import { reportError } from './error-reporting';

export interface FriendlyErrorOptions {
  /** Shown for a 404. Every NotFoundException in this API embeds the raw
   * record id/slug (`Itinerary "e576ae27-…" not found`) — exactly right
   * for a server log, never something a user should see. Give the noun
   * that makes sense here, e.g. "We couldn't find this trip." */
  notFoundMessage?: string;
  /** Shown for a 403, overriding the API's own message (already
   * human-written, e.g. "You don't manage this place" — left alone by
   * default). Use this only when a call site wants different wording. */
  forbiddenMessage?: string;
  /** Shown for a 401, only when this call site's 401 actually means "your
   * session expired" (an authenticated mutation) rather than "wrong
   * credentials" (a login/verify endpoint, which already returns a
   * specific, human-written message worth showing as-is). Omit to leave
   * 401 messages untouched. */
  unauthorizedMessage?: string;
  /** Shown for a 5xx, an unrecognized error shape, or a message that
   * looks technical despite a 4xx status. */
  fallbackMessage?: string;
  /** Extra detail recorded alongside the real error in developer logs
   * (Sentry, when configured — see error-reporting.ts) — e.g. the action
   * being attempted and the id involved. Never shown to the user. */
  context?: Record<string, unknown>;
}

const DEFAULT_NOT_FOUND = "We couldn't find that. It may have already been removed.";
const DEFAULT_FALLBACK = 'Something went wrong. Please try again.';
const NETWORK_MESSAGE = "We couldn't connect to the server. Please check your connection and try again.";
const RATE_LIMITED_MESSAGE = "You're doing that too much. Please wait a moment and try again.";

// Catches the two shapes of "this leaked something technical" that can
// otherwise slip through on a 4xx that would normally pass straight to
// the user: a raw UUID, and http.ts's own last-resort fallback string
// (`Request to /api/v1/... failed with 500`) for a body with no usable
// `message` field.
const LOOKS_TECHNICAL_RE =
  /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}|^Request to .* failed with \d+$/i;

function isNetworkError(error: unknown): boolean {
  return error instanceof TypeError && /fetch|network/i.test(error.message);
}

export function isNotFoundError(error: unknown): error is HttpError {
  return error instanceof HttpError && error.status === 404;
}

/** Translate anything a mutation/fetch can throw into copy that's safe to
 * put in front of a user, while still recording the real technical error
 * for developers (a no-op unless NEXT_PUBLIC_SENTRY_DSN is configured —
 * see error-reporting.ts). Use this in every catch block that ends in
 * setError(...) instead of reading `err.message` off an HttpError
 * directly — that's the raw backend/database-shaped string, not
 * something written for an end user.
 *
 * 400/403/409/422 etc. are deliberately left alone here: this API's
 * validation, permission, and conflict messages ("email must be a valid
 * email", "You don't manage this place", "You've already reviewed this
 * place") are already written to be read by a person, and overriding them
 * would make error messages *less* specific, not more. 404 is the one
 * status this always overrides — see notFoundMessage above for why. */
export function getFriendlyErrorMessage(error: unknown, options: FriendlyErrorOptions = {}): string {
  reportError(error, options.context);

  if (error instanceof HttpError) {
    if (error.status === 404) return options.notFoundMessage ?? DEFAULT_NOT_FOUND;
    if (error.status === 401 && options.unauthorizedMessage) return options.unauthorizedMessage;
    if (error.status === 403 && options.forbiddenMessage) return options.forbiddenMessage;
    if (error.status === 429) return RATE_LIMITED_MESSAGE;
    if (error.status >= 500) return options.fallbackMessage ?? DEFAULT_FALLBACK;
    if (LOOKS_TECHNICAL_RE.test(error.message)) return options.fallbackMessage ?? DEFAULT_FALLBACK;
    return error.message;
  }

  if (isNetworkError(error)) return NETWORK_MESSAGE;

  return options.fallbackMessage ?? DEFAULT_FALLBACK;
}
