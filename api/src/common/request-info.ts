import type { Request } from "express";
import { resolveClientIp } from "./client-ip";

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

/** The address comes from resolveClientIp, not `req.ip` directly: behind the
 * web service `req.ip` is the web service's own address for every request,
 * so the visitor's address is taken from the header the web service sets
 * (trusted only with INTERNAL_PROXY_SECRET — see common/client-ip.ts). */
export function getRequestInfo(req: Request): RequestInfo {
  return {
    ipAddress: resolveClientIp(req) ?? null,
    userAgent: req.headers["user-agent"] ?? null,
  };
}
