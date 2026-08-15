import type { AuthUser, TravelerType } from './types';
import { apiRequest, authHeader } from './http';

export interface AuthResult {
  accessToken: string;
  user: AuthUser;
}

// What POST /auth/login returns instead of AuthResult when the account has
// 2FA enabled — see TwoFactorRequiredResult in auth.service.ts.
export interface TwoFactorRequiredResult {
  twoFactorRequired: true;
  pendingToken: string;
}

export interface RegisterInput {
  name: string;
  email: string;
  password: string;
  travelerType?: TravelerType;
  interests?: string[];
}

export function register(input: RegisterInput): Promise<AuthResult> {
  return apiRequest<AuthResult>('/auth/register', { method: 'POST', body: JSON.stringify(input) });
}

export function login(input: { email: string; password: string }): Promise<AuthResult | TwoFactorRequiredResult> {
  return apiRequest<AuthResult | TwoFactorRequiredResult>('/auth/login', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

// Login step 2 — exchanges the pendingToken from a twoFactorRequired login
// response, plus a TOTP or recovery code, for a real AuthResult.
export function verifyTwoFactor(input: { pendingToken: string; code: string }): Promise<AuthResult> {
  return apiRequest<AuthResult>('/auth/2fa/verify', { method: 'POST', body: JSON.stringify(input) });
}

export function fetchMe(token: string): Promise<AuthUser> {
  return apiRequest<AuthUser>('/auth/me', { headers: authHeader(token) });
}

export interface UpdateProfileInput {
  name?: string;
  phone?: string;
  homeCountyId?: string;
  travelerType?: TravelerType;
  interests?: string[];
}

export function updateProfile(token: string, input: UpdateProfileInput): Promise<AuthUser> {
  return apiRequest<AuthUser>('/auth/me', {
    method: 'PATCH',
    headers: authHeader(token),
    body: JSON.stringify(input),
  });
}

export interface TwoFactorSetupResult {
  secret: string; // for manual entry if the QR code can't be scanned
  qrCodeDataUrl: string;
}

export function setupTwoFactor(token: string): Promise<TwoFactorSetupResult> {
  return apiRequest<TwoFactorSetupResult>('/auth/2fa/setup', { method: 'POST', headers: authHeader(token) });
}

// Confirms setup with a real code from the app; returns 10 one-time
// recovery codes, shown to the user exactly once.
export function enableTwoFactor(token: string, code: string): Promise<{ recoveryCodes: string[] }> {
  return apiRequest<{ recoveryCodes: string[] }>('/auth/2fa/enable', {
    method: 'POST',
    headers: authHeader(token),
    body: JSON.stringify({ code }),
  });
}

export function disableTwoFactor(token: string, password: string): Promise<{ success: true }> {
  return apiRequest<{ success: true }>('/auth/2fa/disable', {
    method: 'POST',
    headers: authHeader(token),
    body: JSON.stringify({ password }),
  });
}
