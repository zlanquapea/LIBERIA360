import { safeNext, signupHrefFor } from './invite-redirect';

describe('safeNext', () => {
  it('accepts a same-site relative path', () => {
    expect(safeNext('/invite/abc123')).toBe('/invite/abc123');
  });

  it('falls back to /account for null', () => {
    expect(safeNext(null)).toBe('/account');
  });

  it('falls back to /account for an absolute URL (open-redirect guard)', () => {
    expect(safeNext('https://evil.example/phish')).toBe('/account');
  });

  it('falls back to /account for a protocol-relative URL (open-redirect guard)', () => {
    expect(safeNext('//evil.example/phish')).toBe('/account');
  });

  it('falls back to /account for a path with no leading slash', () => {
    expect(safeNext('account')).toBe('/account');
  });
});

describe('signupHrefFor', () => {
  it('carries the invite token through as ?invite=', () => {
    expect(signupHrefFor('/invite/abc123')).toBe('/signup?invite=abc123');
  });

  it('strips a trailing query string from the token', () => {
    expect(signupHrefFor('/invite/abc123?foo=bar')).toBe('/signup?invite=abc123');
  });

  it('falls back to a bare /signup for a non-invite destination', () => {
    expect(signupHrefFor('/account')).toBe('/signup');
  });
});
