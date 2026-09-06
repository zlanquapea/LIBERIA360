import { Injectable } from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";

/**
 * Same "jwt" passport strategy as JwtAuthGuard, but never blocks the
 * request when no valid session is present. Passport's default
 * AuthGuard.handleRequest throws UnauthorizedException when the
 * strategy didn't produce a user (missing/expired/invalid token) —
 * exactly the behavior a route needs when auth is required, but wrong
 * for a route that's public and only wants to *personalize* its
 * response when the caller happens to be signed in (e.g. a feed
 * listing's per-post "did I like/save this" flags). Overriding
 * handleRequest to swallow that instead of throwing means a guest
 * request still succeeds with req.user left undefined, while a request
 * carrying a valid session cookie still gets req.user populated exactly
 * as JwtAuthGuard would.
 */
@Injectable()
export class OptionalJwtAuthGuard extends AuthGuard("jwt") {
  handleRequest<TUser = unknown>(_err: unknown, user: TUser): TUser {
    return user;
  }
}
