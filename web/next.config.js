/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  productionBrowserSourceMaps: false,
  poweredByHeader: false,
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
    const apiOrigin = process.env.API_ORIGIN ?? 'http://localhost:3001';
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

module.exports = nextConfig;
