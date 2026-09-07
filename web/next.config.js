const createNextIntlPlugin = require('next-intl/plugin');

// Points at the request-config module that loads each locale's message
// file (src/i18n/request.ts) — see I18N_PLAN.md for the overall approach.
const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  productionBrowserSourceMaps: false,
  poweredByHeader: false,
  // next-intl and its whole ICU-formatting dependency chain ship ESM-only
  // builds. This isn't needed for Next's own build (webpack/Turbopack
  // already handle ESM packages fine), but next/jest's
  // transformIgnorePatterns is hardcoded to skip all of node_modules
  // except this exact list (see node_modules/next/dist/build/jest/jest.js's
  // own comment: "Custom config can append to transformIgnorePatterns but
  // not modify it") — so this is the only supported way to get Jest to
  // actually transform these instead of choking on `export` syntax the
  // moment a translated component (most shell chrome, Phase 2) is
  // imported in a test. Full list found by chasing each "Unexpected token
  // 'export'" back to its importer: next-intl -> use-intl ->
  // intl-messageformat -> @formatjs/icu-messageformat-parser ->
  // @formatjs/icu-skeleton-parser, plus use-intl's other two direct deps.
  transpilePackages: [
    'next-intl',
    'use-intl',
    '@formatjs/fast-memoize',
    '@formatjs/icu-messageformat-parser',
    '@formatjs/icu-skeleton-parser',
    '@schummar/icu-type-parser',
    'icu-minify',
    'intl-messageformat',
  ],
  experimental: {
    // The proxy rewrites below (added for the same-origin reverse-proxy —
    // see the /api rewrite) buffer the whole request body in memory, and
    // Next defaults that buffer to 10MB, silently truncating anything
    // larger with no error to the client. Creator video uploads
    // (uploads/uploads.controller.ts, video-uploads-api.ts) accept up to
    // 50MB, so the default would corrupt every video in the 10-50MB range
    // instead of rejecting it cleanly. Sized with headroom over that 50MB
    // ceiling for multipart boundary/header overhead.
    proxyClientMaxBodySize: '60mb',
  },
  async rewrites() {
    // API_ORIGIN is the new server-only name, but existing Railway services
    // were configured with NEXT_PUBLIC_API_URL before the same-origin proxy
    // was introduced. Keep that value as a migration fallback so deploying
    // this version cannot silently redirect production traffic to localhost.
    // The legacy value commonly includes /api/v1, whereas rewrite
    // destinations need the bare origin.
    // Render Blueprints can inject another service's private host and port,
    // but cannot interpolate those two values into a URL. Accept the pair so
    // the Blueprint can wire the services together without a placeholder that
    // has to be replaced manually after the first deploy.
    const renderPrivateOrigin =
      process.env.API_HOST && process.env.API_PORT
        ? `http://${process.env.API_HOST}:${process.env.API_PORT}`
        : undefined;
    const configuredApiOrigin =
      process.env.API_ORIGIN ||
      renderPrivateOrigin ||
      process.env.NEXT_PUBLIC_API_URL;
    const apiOrigin = (configuredApiOrigin || 'http://localhost:3001')
      .replace(/\/+$/, '')
      .replace(/\/api\/v1$/, '');
    return [
      { source: '/api/:path*', destination: `${apiOrigin}/api/:path*` },
      { source: '/uploads/:path*', destination: `${apiOrigin}/uploads/:path*` },
    ];
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'Content-Security-Policy', value: "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https:; font-src 'self' data:; connect-src 'self' https:; media-src 'self' blob: https:; worker-src 'self' blob:; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'; upgrade-insecure-requests" },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(self), geolocation=(self), microphone=()' },
          { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
        ],
      },
    ];
  },
  images: {
    // Phase 1 catalog media is expected to come from S3-compatible storage +
    // CDN (Tech Spec §6.1). Left open here — configure remotePatterns once a
    // media host is chosen.
    remotePatterns: [],
  },
};

module.exports = withNextIntl(nextConfig);
