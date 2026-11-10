import {
  CLIENT_IP_HEADER,
  PROXY_SECRET_HEADER,
  proxySecret,
} from "./visitor-ip";

/** Headers every server-side fetch to the API should carry so the API
 * rate-limits (and audit-logs) the visitor the page is being rendered for
 * rather than this web server — see visitor-ip.ts. proxy.ts has already
 * resolved the visitor's address onto the incoming request by the time any
 * page code runs.
 *
 * Returns nothing in the browser (those calls go through the /api rewrite,
 * which proxy.ts stamps itself), when INTERNAL_PROXY_SECRET isn't
 * configured, or when there is no visitor at all (build-time data
 * fetching, generateStaticParams, sitemap) — the API then simply attributes
 * the call to this server's own address. */
export async function visitorHeaders(): Promise<Record<string, string>> {
  if (typeof window !== "undefined") return {};
  const secret = proxySecret();
  if (!secret) return {};
  try {
    const { headers } = await import("next/headers");
    const ip = (await headers()).get(CLIENT_IP_HEADER);
    return ip ? { [CLIENT_IP_HEADER]: ip, [PROXY_SECRET_HEADER]: secret } : {};
  } catch (err) {
    // Next signals "this route can't be prerendered" by throwing from
    // headers(); swallowing that would hide the bailout from it.
    if ((err as { digest?: string })?.digest === "DYNAMIC_SERVER_USAGE") {
      throw err;
    }
    // Anything else means there is no request to read (build time).
    return {};
  }
}
