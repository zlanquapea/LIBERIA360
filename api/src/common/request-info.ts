import type { Request } from "express";

/** IP + device, captured once per request for anything that needs "who did
 * this and from what" — the admin audit trail and the login-activity log
 * (see admin/entities/admin-action.entity.ts and
 * security/entities/login-activity.entity.ts). Deliberately just the raw
 * user-agent string, not a parsed browser/OS — that parsing is a display
 * concern the frontend does (see web/src/lib/user-agent.ts), not something
 * worth a new dependency or normalization logic on the write path. */
export interface RequestInfo {
  ipAddress: string | null;
  userAgent: string | null;
}

/** `req.ip` is Express's own client-IP resolution — accurate for a direct
 * connection, but only reflects `X-Forwarded-For` if the app has `trust
 * proxy` configured (it doesn't yet; see DEPLOYMENT.md's rate-limiting
 * caveat for the same underlying gap). Behind a reverse proxy without that
 * setting, every request appears to come from the proxy's own address —
 * a known, documented limitation, not a bug in this helper. */
export function getRequestInfo(req: Request): RequestInfo {
  return {
    ipAddress: req.ip ?? null,
    userAgent: req.headers["user-agent"] ?? null,
  };
}
