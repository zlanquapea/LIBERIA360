import type { AuthUser } from './types';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api/v1';

export class AuthApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
    this.name = 'AuthApiError';
  }
}

export interface AuthResult {
  accessToken: string;
  user: AuthUser;
}

// class-validator's ValidationPipe returns `message` as a string[] (one
// entry per failed rule); ConflictException/UnauthorizedException return a
// single string. Normalize both into one readable line for the UI.
function extractMessage(status: number, path: string, body: unknown): string {
  const message = (body as { message?: unknown } | null)?.message;
  if (Array.isArray(message)) return message.join(', ');
  if (typeof message === 'string') return message;
  return `Request to ${path} failed with ${status}`;
}

async function postJson<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    throw new AuthApiError(res.status, extractMessage(res.status, path, data));
  }
  return data as T;
}

export function register(input: { name: string; email: string; password: string }): Promise<AuthResult> {
  return postJson<AuthResult>('/auth/register', input);
}

export function login(input: { email: string; password: string }): Promise<AuthResult> {
  return postJson<AuthResult>('/auth/login', input);
}

export async function fetchMe(token: string): Promise<AuthUser> {
  const res = await fetch(`${API_URL}/auth/me`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    throw new AuthApiError(res.status, `Request to /auth/me failed with ${res.status}`);
  }
  return res.json() as Promise<AuthUser>;
}
