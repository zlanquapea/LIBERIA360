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
    if (name === SESSION_COOKIE) return decodeURIComponent(value.join("="));
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
        tokenFromCookie,
        // Retained for trusted non-browser clients during migration. The web
        // application never receives or stores this bearer token.
        ExtractJwt.fromAuthHeaderAsBearerToken(),
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
