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

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    configService: ConfigService<AppConfig, true>,
    private readonly usersService: UsersService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
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
    return user;
  }
}
