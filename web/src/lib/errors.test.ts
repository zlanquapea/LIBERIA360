import { HttpError } from './http';
import { getFriendlyErrorMessage, isNotFoundError } from './errors';
import { reportError } from './error-reporting';

jest.mock('./error-reporting', () => ({ reportError: jest.fn() }));

describe('isNotFoundError', () => {
  it('is true for an HttpError with status 404', () => {
    expect(isNotFoundError(new HttpError(404, 'Itinerary "abc-123" not found'))).toBe(true);
  });

  it('is false for any other status or error type', () => {
    expect(isNotFoundError(new HttpError(403, "You don't manage this place"))).toBe(false);
    expect(isNotFoundError(new Error('boom'))).toBe(false);
    expect(isNotFoundError(null)).toBe(false);
  });
});

describe('getFriendlyErrorMessage', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it('replaces a 404 (which always embeds a raw record id) with a generic or custom message', () => {
    const err = new HttpError(404, 'Itinerary "e576ae27-8bbb-4a08-8cef-1285d837e55f" not found');
    expect(getFriendlyErrorMessage(err)).toBe("We couldn't find that. It may have already been removed.");
    expect(getFriendlyErrorMessage(err, { notFoundMessage: "We couldn't find this trip." })).toBe(
      "We couldn't find this trip.",
    );
  });

  it('leaves an already user-facing 400/403/409 message alone', () => {
    expect(getFriendlyErrorMessage(new HttpError(400, 'email must be a valid email'))).toBe(
      'email must be a valid email',
    );
    expect(getFriendlyErrorMessage(new HttpError(403, "You don't manage this place"))).toBe(
      "You don't manage this place",
    );
    expect(getFriendlyErrorMessage(new HttpError(409, 'You have already reviewed this place'))).toBe(
      'You have already reviewed this place',
    );
  });

  it('overrides 403 when a custom forbiddenMessage is given', () => {
    expect(getFriendlyErrorMessage(new HttpError(403, 'Forbidden'), { forbiddenMessage: 'Nope.' })).toBe('Nope.');
  });

  it('leaves 401 alone by default but honors an explicit unauthorizedMessage override', () => {
    expect(getFriendlyErrorMessage(new HttpError(401, 'Invalid email or password'))).toBe('Invalid email or password');
    expect(
      getFriendlyErrorMessage(new HttpError(401, 'jwt expired'), {
        unauthorizedMessage: 'Your session has expired. Please log in again.',
      }),
    ).toBe('Your session has expired. Please log in again.');
  });

  it('maps 429 to a friendly rate-limit message regardless of the raw text', () => {
    expect(getFriendlyErrorMessage(new HttpError(429, 'ThrottlerException: Too Many Requests'))).toBe(
      "You're doing that too much. Please wait a moment and try again.",
    );
  });

  it('replaces any 5xx with the generic fallback', () => {
    expect(getFriendlyErrorMessage(new HttpError(500, 'Internal server error'))).toBe(
      'Something went wrong. Please try again.',
    );
    expect(getFriendlyErrorMessage(new HttpError(503, 'Service unavailable'), { fallbackMessage: 'Down for maintenance.' })).toBe(
      'Down for maintenance.',
    );
  });

  it('falls back even on a 4xx if the message still looks technical (a raw id, or the unmatched-body shape)', () => {
    expect(getFriendlyErrorMessage(new HttpError(409, 'Place "9c1e2b3a-1111-2222-3333-444455556666" already claimed'))).toBe(
      'Something went wrong. Please try again.',
    );
    expect(getFriendlyErrorMessage(new HttpError(500, 'Request to /api/v1/itineraries/abc failed with 500'))).toBe(
      'Something went wrong. Please try again.',
    );
  });

  it('maps a fetch-level network failure to a connectivity message', () => {
    expect(getFriendlyErrorMessage(new TypeError('Failed to fetch'))).toBe(
      "We couldn't connect to the server. Please check your connection and try again.",
    );
  });

  it('falls back to the generic message for anything unrecognized', () => {
    expect(getFriendlyErrorMessage('a plain string')).toBe('Something went wrong. Please try again.');
    expect(getFriendlyErrorMessage(undefined)).toBe('Something went wrong. Please try again.');
  });

  it('always reports the real error for developers, with any given context, regardless of what the user sees', () => {
    const err = new HttpError(404, 'Itinerary "abc-123" not found');
    getFriendlyErrorMessage(err, { context: { action: 'delete-itinerary', itineraryId: 'abc-123' } });
    expect(reportError).toHaveBeenCalledWith(err, { action: 'delete-itinerary', itineraryId: 'abc-123' });
  });
});
