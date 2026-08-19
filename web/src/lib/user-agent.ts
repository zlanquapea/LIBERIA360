// Turns a raw User-Agent string (captured server-side — see
// api/src/common/request-info.ts) into a short "Browser on OS" label for
// the admin audit log and security pages. Deliberately just enough
// pattern-matching to be readable at a glance, not a real UA parser —
// pulling in a dependency (ua-parser-js et al.) for a handful of display
// labels isn't worth it. Order matters: check more specific tokens (Edg,
// OPR) before the generic ones they'd otherwise match (Chrome, Safari).
export function parseUserAgent(userAgent: string | null): string {
  if (!userAgent) return 'Unknown device';

  const browser = (() => {
    if (/Edg\//.test(userAgent)) return 'Edge';
    if (/OPR\//.test(userAgent)) return 'Opera';
    if (/Firefox\//.test(userAgent)) return 'Firefox';
    if (/CriOS\//.test(userAgent)) return 'Chrome';
    if (/Chrome\//.test(userAgent)) return 'Chrome';
    if (/Safari\//.test(userAgent) && /Version\//.test(userAgent)) return 'Safari';
    return null;
  })();

  const os = (() => {
    if (/iPhone|iPad|iPod/.test(userAgent)) return 'iOS';
    if (/Android/.test(userAgent)) return 'Android';
    if (/Windows/.test(userAgent)) return 'Windows';
    if (/Mac OS X/.test(userAgent)) return 'macOS';
    if (/Linux/.test(userAgent)) return 'Linux';
    return null;
  })();

  if (browser && os) return `${browser} on ${os}`;
  if (browser) return browser;
  if (os) return os;

  // Not a browser at all — a script, curl, a monitoring probe. Show the
  // first token rather than the full string, which is often long.
  return userAgent.split('/')[0].split(' ')[0] || 'Unknown device';
}
