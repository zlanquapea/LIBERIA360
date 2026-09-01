import { Injectable, UnauthorizedException } from "@nestjs/common";
import { PassportStrategy } from "@nestjs/passport";
import { ConfigService } from "@nestjs/config";
import { ExtractJwt, Strategy } from "passport-jwt";
import { UsersService } from "../../users/users.service";
import {
  JwtPayload,
  TwoFactorPendingPayload,
} from "../types/jwt-payload.interface";
import { AppConfig } from "../../config/configuration";
import { User } from "../../users/entities/user.entity";
import type { Request } from "express";

const SESSION_COOKIE = "liberia360_session";

function tokenFromCookie(request: Request): string | null {
  const cookie = request.headers.cookie;
  if (!cookie) return null;
  for (const part of cookie.split(";")) {
    const [name, ...value] = part.trim().split("=");
    if (name === SESSION_COOKIE) {
      try {
        return decodeURIComponent(value.join("="));
      } catch {
        // A malformed percent-encoding (e.g. a lone "%") makes
        // decodeURIComponent throw URIError. That's just an invalid
        // credential, not a server error — fall through to "no token
        // found" so it takes the ordinary 401 path instead of a 500.
        return null;
      }
    }
  }
  return null;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    configService: ConfigService<AppConfig, true>,
    private readonly usersService: UsersService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        // Bearer header first: an explicit Authorization header is a
        // deliberate credential a caller went out of its way to attach, so
        // it should never be silently shadowed by an ambient session
        // cookie the same HTTP client happens to also be carrying (e.g. a
        // non-browser client/test harness that reuses one cookie-jar-backed
        // client across several logged-in identities). A real browser
        // never sends this header at all — the web application never
        // receives or stores a bearer token — so this ordering changes
        // nothing for normal cookie-only requests.
        ExtractJwt.fromAuthHeaderAsBearerToken(),
        // Cookie fallback for the web application. Retained bearer support
        // above is for trusted non-browser clients during migration.
        tokenFromCookie,
      ]),
      ignoreExpiration: false,
      secretOrKey: configService.get("jwt", { infer: true }).secret,
    });
  }

  async validate(payload: JwtPayload | TwoFactorPendingPayload): Promise<User> {
    // A 2fa-pending token proves the password step passed, nothing more —
    // it must never work as a bearer token against ordinary protected
    // endpoints, only as input to POST /auth/2fa/verify (which decodes it
    // manually, bypassing this guard entirely).
    if ("purpose" in payload) {
      throw new UnauthorizedException(
        "This token cannot be used to authenticate",
      );
    }

    const user = await this.usersService.findById(payload.sub);
    if (!user) {
      throw new UnauthorizedException("User no longer exists");
    }
    // Rejects a token issued before the most recent password change,
    // "sign out of all other devices", or account deletion — see
    // JwtPayload's doc comment. `payload.tokenVersion` is missing (not 0)
    // on a token that predates this field existing at all, which should
    // also be rejected rather than coerced to a false match.
    if (payload.tokenVersion !== user.tokenVersion) {
      throw new UnauthorizedException("Session expired — please sign in again");
    }
    return user;
  }
}
