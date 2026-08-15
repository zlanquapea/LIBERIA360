/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    // Phase 1 catalog media is expected to come from S3-compatible storage +
    // CDN (Tech Spec §6.1). Left open here — configure remotePatterns once a
    // media host is chosen.
    remotePatterns: [],
  },
};

module.exports = nextConfig;
