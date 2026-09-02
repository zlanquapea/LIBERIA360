// Shared by lib/api.ts (server-component data fetching) and proxy.ts (session
// validation) — both need the API's real, bare origin server-side, and
// neither should compute it differently from the other. Kept as its own tiny,
// side-effect-free module rather than folded into lib/api.ts so proxy.ts
// isn't pulled into that file's much larger surface (every catalog-read
// function, its types, ...) just for this one string.
export function serverApiOrigin(): string {
  // NEXT_PUBLIC_API_URL is retained as a compatibility fallback for hosts
  // (notably existing Railway services) configured before API_ORIGIN became
  // the preferred server-only variable. It may contain the old /api/v1
  // suffix, so normalize it before constructing an origin from it.
  const privateServiceOrigin =
    process.env.API_HOST && process.env.API_PORT
      ? `http://${process.env.API_HOST}:${process.env.API_PORT}`
      : undefined;
  const configuredOrigin =
    process.env.API_ORIGIN ||
    privateServiceOrigin ||
    process.env.NEXT_PUBLIC_API_URL;
  return (configuredOrigin || "http://localhost:3001")
    .replace(/\/+$/, "")
    .replace(/\/api\/v1$/, "");
}
