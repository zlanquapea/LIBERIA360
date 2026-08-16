import { Module } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtModule, JwtSignOptions } from "@nestjs/jwt";
import { PassportModule } from "@nestjs/passport";
import { UsersModule } from "../users/users.module";
import { MailModule } from "../mail/mail.module";
import { AuthService } from "./auth.service";
import { AuthController } from "./auth.controller";
import { JwtStrategy } from "./strategies/jwt.strategy";
import { AppConfig } from "../config/configuration";

@Module({
  imports: [
    UsersModule,
    MailModule,
    PassportModule,
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService<AppConfig, true>) => {
        const jwt = configService.get("jwt", { infer: true });
        return {
          secret: jwt.secret,
          // JWT_EXPIRES_IN is a plain string from the environment (e.g.
          // "7d") — @nestjs/jwt's types want the narrower `ms`-package
          // StringValue template-literal type, which an env var can't be
          // statically proven to match. The cast is safe as long as
          // JWT_EXPIRES_IN is a valid `ms` duration string; jsonwebtoken
          // throws at sign-time otherwise, not silently misbehaves.
          signOptions: {
            expiresIn: jwt.expiresIn as JwtSignOptions["expiresIn"],
          },
        };
      },
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy],
  exports: [AuthService],
})
export class AuthModule {}
