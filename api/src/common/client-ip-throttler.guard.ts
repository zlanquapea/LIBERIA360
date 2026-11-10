import { Injectable } from "@nestjs/common";
import { ThrottlerGuard } from "@nestjs/throttler";
import type { Request } from "express";
import { resolveClientIp } from "./client-ip";

/** The stock ThrottlerGuard keys every bucket on `req.ip`, which behind the
 * web service is the web service itself — one shared budget for every
 * visitor, on the 120/min default and on the 5/min login/2FA/password-reset
 * overrides alike. Keying on the visitor's own address (see
 * resolveClientIp) gives each visitor their own budget instead. */
@Injectable()
export class ClientIpThrottlerGuard extends ThrottlerGuard {
  protected async getTracker(req: Record<string, any>): Promise<string> {
    return resolveClientIp(req as Request) ?? "unknown";
  }
}
