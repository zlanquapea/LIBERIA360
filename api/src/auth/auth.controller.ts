import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Patch,
  UseGuards,
  Post,
} from "@nestjs/common";
import { Throttle, seconds } from "@nestjs/throttler";
import { AuthService } from "./auth.service";
import { RegisterDto } from "./dto/register.dto";
import { LoginDto } from "./dto/login.dto";
import { UpdateProfileDto } from "./dto/update-profile.dto";
import { EnableTwoFactorDto } from "./dto/enable-two-factor.dto";
import { DisableTwoFactorDto } from "./dto/disable-two-factor.dto";
import { VerifyTwoFactorDto } from "./dto/verify-two-factor.dto";
import { ForgotPasswordDto } from "./dto/forgot-password.dto";
import { ResetPasswordDto } from "./dto/reset-password.dto";
import { VerifyEmailDto } from "./dto/verify-email.dto";
import { ChangePasswordDto } from "./dto/change-password.dto";
import { DeleteAccountDto } from "./dto/delete-account.dto";
import { JwtAuthGuard } from "./guards/jwt-auth.guard";
import { CurrentUser } from "./decorators/current-user.decorator";
import { User } from "../users/entities/user.entity";
import { UsersService } from "../users/users.service";
import { toPublicUser } from "../users/user.serializer";

@Controller("auth")
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly usersService: UsersService,
  ) {}

  @Post("register")
  register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  // Stricter than the global default (see app.module.ts) — this is exactly
  // the endpoint a password-guessing script would hit.
  @Post("login")
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 5, ttl: seconds(60) } })
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  // Login step 2 — exchanges the pendingToken from a twoFactorRequired
  // login response, plus a TOTP or recovery code, for a real accessToken.
  // Deliberately unauthenticated: the pendingToken itself is the proof of
  // "already passed the password check". Same tight limit as login — a
  // 6-digit TOTP code only has a million possibilities, so this is exactly
  // as brute-forceable as a weak password without it.
  @Post("2fa/verify")
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 5, ttl: seconds(60) } })
  verifyTwoFactor(@Body() dto: VerifyTwoFactorDto) {
    return this.authService.verifyTwoFactor(dto);
  }

  @Get("me")
  @UseGuards(JwtAuthGuard)
  me(@CurrentUser() user: User) {
    return toPublicUser(user);
  }

  @Patch("me")
  @UseGuards(JwtAuthGuard)
  async updateMe(@CurrentUser() user: User, @Body() dto: UpdateProfileDto) {
    const updated = await this.usersService.update(user.id, dto);
    return toPublicUser(updated);
  }

  @Post("2fa/setup")
  @UseGuards(JwtAuthGuard)
  setupTwoFactor(@CurrentUser() user: User) {
    return this.authService.setupTwoFactor(user);
  }

  @Post("2fa/enable")
  @UseGuards(JwtAuthGuard)
  async enableTwoFactor(
    @CurrentUser() user: User,
    @Body() dto: EnableTwoFactorDto,
  ) {
    const recoveryCodes = await this.authService.enableTwoFactor(
      user,
      dto.code,
    );
    return { recoveryCodes };
  }

  @Post("2fa/disable")
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async disableTwoFactor(
    @CurrentUser() user: User,
    @Body() dto: DisableTwoFactorDto,
  ) {
    await this.authService.disableTwoFactor(user, dto.password);
    return { success: true };
  }

  // Same rate limit as login/2fa-verify: this is exactly the endpoint a
  // scripted attacker would hit to enumerate registered emails or spam
  // reset links at an inbox they don't own.
  @Post("forgot-password")
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 5, ttl: seconds(60) } })
  async forgotPassword(@Body() dto: ForgotPasswordDto) {
    await this.authService.forgotPassword(dto.email);
    // Identical response whether or not the email exists — see
    // AuthService.forgotPassword's doc comment.
    return {
      message:
        "If an account exists for that email, a reset link has been sent.",
    };
  }

  @Post("reset-password")
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 5, ttl: seconds(60) } })
  async resetPassword(@Body() dto: ResetPasswordDto) {
    await this.authService.resetPassword(dto.token, dto.newPassword);
    return { success: true };
  }

  @Post("verify-email")
  @HttpCode(HttpStatus.OK)
  async verifyEmail(@Body() dto: VerifyEmailDto) {
    await this.authService.verifyEmail(dto.token);
    return { success: true };
  }

  @Post("resend-verification")
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 5, ttl: seconds(60) } })
  async resendVerification(@CurrentUser() user: User) {
    await this.authService.resendVerification(user);
    return { success: true };
  }

  @Patch("password")
  @UseGuards(JwtAuthGuard)
  async changePassword(
    @CurrentUser() user: User,
    @Body() dto: ChangePasswordDto,
  ) {
    return this.authService.changePassword(
      user,
      dto.currentPassword,
      dto.newPassword,
    );
  }

  // "Sign out of all other devices" — returns a fresh token for the
  // calling session so it isn't logged out by its own request; every
  // other token issued before this call stops working immediately.
  @Post("logout-all")
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async logoutAllDevices(@CurrentUser() user: User) {
    return this.authService.logoutAllDevices(user);
  }

  @Delete("me")
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async deleteAccount(
    @CurrentUser() user: User,
    @Body() dto: DeleteAccountDto,
  ) {
    await this.authService.deleteAccount(user, dto.password);
    return { success: true };
  }
}
