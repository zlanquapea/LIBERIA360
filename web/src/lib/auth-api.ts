import type { AuthUser } from './types';
import { apiRequest, authHeader } from './http';

export interface AuthResult {
  accessToken: string;
  user: AuthUser;
}

export function register(input: { name: string; email: string; password: string }): Promise<AuthResult> {
  return apiRequest<AuthResult>('/auth/register', { method: 'POST', body: JSON.stringify(input) });
}

export function login(input: { email: string; password: string }): Promise<AuthResult> {
  return apiRequest<AuthResult>('/auth/login', { method: 'POST', body: JSON.stringify(input) });
}

export function fetchMe(token: string): Promise<AuthUser> {
  return apiRequest<AuthUser>('/auth/me', { headers: authHeader(token) });
}
