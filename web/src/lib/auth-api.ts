import type { AuthUser, TravelerType } from './types';
import { apiRequest, authHeader } from './http';

export interface AuthResult {
  accessToken: string;
  user: AuthUser;
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

export function login(input: { email: string; password: string }): Promise<AuthResult> {
  return apiRequest<AuthResult>('/auth/login', { method: 'POST', body: JSON.stringify(input) });
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
