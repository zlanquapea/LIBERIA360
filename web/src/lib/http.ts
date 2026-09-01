// Shared JSON HTTP helpers for client-side *mutations* against the API —
// reads still go through lib/api.ts's server-fetch (with its revalidate
// cache), since those run in server components and don't need auth
// headers or POST bodies.

const API_URL = "/api/v1";

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
    this.name = "HttpError";
  }
}

// class-validator's ValidationPipe returns `message` as a string[] (one
// entry per failed rule); Nest's built-in exceptions (Conflict,
// Unauthorized, NotFound, ...) return a single string. Normalize both into
// one readable line for the UI.
function extractMessage(status: number, path: string, body: unknown): string {
  const message = (body as { message?: unknown } | null)?.message;
  if (Array.isArray(message)) return message.join(", ");
  if (typeof message === "string") return message;
  return `Request to ${path} failed with ${status}`;
}

export async function apiRequest<T>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    credentials: "same-origin",
    headers: { "Content-Type": "application/json", ...init.headers },
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    throw new HttpError(res.status, extractMessage(res.status, path, data));
  }
  return data as T;
}

export function authHeader(token: string): Record<string, string> {
  // Authentication is carried by the Secure, HttpOnly session cookie.
  // Keep the argument temporarily so feature-specific API helpers can be
  // migrated without a flag day; it is never exposed as a bearer header.
  void token;
  return {};
}
