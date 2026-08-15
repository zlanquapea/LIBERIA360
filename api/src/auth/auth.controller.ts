import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Patch,
  UseGuards,
  Post,
} from "@nestjs/common";
import { AuthService } from "./auth.service";
import { RegisterDto } from "./dto/register.dto";
import { LoginDto } from "./dto/login.dto";
import { UpdateProfileDto } from "./dto/update-profile.dto";
import { EnableTwoFactorDto } from "./dto/enable-two-factor.dto";
import { DisableTwoFactorDto } from "./dto/disable-two-factor.dto";
import { VerifyTwoFactorDto } from "./dto/verify-two-factor.dto";
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

  @Post("login")
  @HttpCode(HttpStatus.OK)
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  // Login step 2 — exchanges the pendingToken from a twoFactorRequired
  // login response, plus a TOTP or recovery code, for a real accessToken.
  // Deliberately unauthenticated: the pendingToken itself is the proof of
  // "already passed the password check".
  @Post("2fa/verify")
  @HttpCode(HttpStatus.OK)
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
}
