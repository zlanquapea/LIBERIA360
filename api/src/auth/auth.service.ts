import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import * as bcrypt from "bcrypt";
import { randomUUID } from "crypto";
import { authenticator } from "otplib";
import * as QRCode from "qrcode";
import { UsersService } from "../users/users.service";
import { User } from "../users/entities/user.entity";
import { RegisterDto } from "./dto/register.dto";
import { LoginDto } from "./dto/login.dto";
import { VerifyTwoFactorDto } from "./dto/verify-two-factor.dto";
import {
  JwtPayload,
  TwoFactorPendingPayload,
} from "./types/jwt-payload.interface";
import { toPublicUser, PublicUser } from "../users/user.serializer";
import { AuthProvider } from "../users/entities/user.enums";
import { encryptSecret, decryptSecret } from "./two-factor-crypto";
import { generateRecoveryCodes } from "./two-factor-recovery-codes";
import { generateToken, hashToken, hashesMatch } from "./token-hash";
import { AppConfig } from "../config/configuration";
import { MailService } from "../mail/mail.service";

const EMAIL_VERIFICATION_TTL_MS = 24 * 60 * 60 * 1000; // 24h
const PASSWORD_RESET_TTL_MS = 60 * 60 * 1000; // 1h

const BCRYPT_ROUNDS = 12;
const TOTP_ISSUER = "LIBERIA360";
// Long enough to scan a QR code and type a 6-digit code, short enough that
// a leaked pending token is worthless a few minutes later.
const PENDING_TOKEN_TTL = "5m";

export interface AuthResult {
  accessToken: string;
  user: PublicUser;
}

// What POST /auth/login returns instead of AuthResult when the account has
// 2FA enabled — the frontend must collect a code and call
// POST /auth/2fa/verify with this token before it gets a real accessToken.
export interface TwoFactorRequiredResult {
  twoFactorRequired: true;
  pendingToken: string;
}

export interface TwoFactorSetupResult {
  secret: string; // for manual entry if the QR code can't be scanned
  qrCodeDataUrl: string;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService<AppConfig, true>,
    private readonly mailService: MailService,
  ) {}

  async register(dto: RegisterDto): Promise<AuthResult> {
    const existing = await this.usersService.findByEmail(dto.email);
    if (existing) {
      throw new ConflictException("An account with this email already exists");
    }

    const passwordHash = await bcrypt.hash(dto.password, BCRYPT_ROUNDS);
    const verificationToken = generateToken();
    const user = await this.usersService.create({
      name: dto.name,
      email: dto.email,
      passwordHash,
      authProvider: AuthProvider.EMAIL,
      homeCountyId: dto.homeCountyId ?? null,
      travelerType: dto.travelerType ?? null,
      interests: dto.interests ?? [],
      emailVerificationTokenHash: hashToken(verificationToken),
      emailVerificationTokenExpiresAt: new Date(
        Date.now() + EMAIL_VERIFICATION_TTL_MS,
      ),
    });

    // Never let a broken mail provider fail registration itself —
    // MailService already swallows send errors internally, this just
    // keeps that contract explicit at the call site too.
    await this.mailService
      .sendEmailVerification(user.email, this.verifyEmailUrl(verificationToken))
      .catch(() => undefined);

    return this.buildAuthResult(user);
  }

  /** POST /auth/forgot-password. Always resolves the same way regardless
   * of whether the email exists — the controller returns one generic
   * message either way, so this can't be used to enumerate accounts. */
  async forgotPassword(email: string): Promise<void> {
    const user = await this.usersService.findByEmail(email);
    if (!user || !user.passwordHash) {
      return;
    }
    const resetToken = generateToken();
    await this.usersService.update(user.id, {
      passwordResetTokenHash: hashToken(resetToken),
      passwordResetTokenExpiresAt: new Date(Date.now() + PASSWORD_RESET_TTL_MS),
    });
    await this.mailService
      .sendPasswordReset(user.email, this.resetPasswordUrl(resetToken))
      .catch(() => undefined);
  }

  /** POST /auth/reset-password. Also bumps tokenVersion — a password
   * reset (the exact scenario where an account may have been compromised)
   * is the clearest case where every other signed-in session should be
   * forced to re-authenticate. */
  async resetPassword(token: string, newPassword: string): Promise<void> {
    const user = await this.findByValidToken(
      token,
      "passwordResetTokenHash",
      "passwordResetTokenExpiresAt",
    );
    if (!user) {
      throw new UnauthorizedException("Invalid or expired reset link");
    }

    const passwordHash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);
    await this.usersService.update(user.id, {
      passwordHash,
      passwordResetTokenHash: null,
      passwordResetTokenExpiresAt: null,
      tokenVersion: user.tokenVersion + 1,
    });
  }

  /** POST /auth/verify-email. */
  async verifyEmail(token: string): Promise<void> {
    const user = await this.findByValidToken(
      token,
      "emailVerificationTokenHash",
      "emailVerificationTokenExpiresAt",
    );
    if (!user) {
      throw new UnauthorizedException("Invalid or expired verification link");
    }
    await this.usersService.update(user.id, {
      emailVerified: true,
      emailVerificationTokenHash: null,
      emailVerificationTokenExpiresAt: null,
    });
  }

  /** POST /auth/resend-verification — no-ops quietly if already verified,
   * so a stale "resend" click from an old tab isn't an error. */
  async resendVerification(user: User): Promise<void> {
    if (user.emailVerified) {
      return;
    }
    const verificationToken = generateToken();
    await this.usersService.update(user.id, {
      emailVerificationTokenHash: hashToken(verificationToken),
      emailVerificationTokenExpiresAt: new Date(
        Date.now() + EMAIL_VERIFICATION_TTL_MS,
      ),
    });
    await this.mailService
      .sendEmailVerification(user.email, this.verifyEmailUrl(verificationToken))
      .catch(() => undefined);
  }

  /** PATCH /auth/password — requires the current password (same reasoning
   * as disableTwoFactor: an already-open session shouldn't be enough on
   * its own to change the thing that session is authenticated by).
   * Bumps tokenVersion and returns a fresh token so the *calling* session
   * stays logged in while every other one is forced to re-authenticate. */
  async changePassword(
    user: User,
    currentPassword: string,
    newPassword: string,
  ): Promise<AuthResult> {
    if (
      !user.passwordHash ||
      !(await bcrypt.compare(currentPassword, user.passwordHash))
    ) {
      throw new UnauthorizedException("Current password is incorrect");
    }
    const passwordHash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);
    const updated = await this.usersService.update(user.id, {
      passwordHash,
      tokenVersion: user.tokenVersion + 1,
    });
    return this.buildAuthResult(updated);
  }

  /** POST /auth/logout-all — invalidates every token issued before now,
   * including (without the fresh token this returns) the caller's own. */
  async logoutAllDevices(user: User): Promise<AuthResult> {
    const updated = await this.usersService.update(user.id, {
      tokenVersion: user.tokenVersion + 1,
    });
    return this.buildAuthResult(updated);
  }

  /** DELETE /auth/me — anonymizes rather than hard-deletes; see User
   * entity's `deletedAt` doc comment for why. Password-confirmed, same
   * pattern as disableTwoFactor. */
  async deleteAccount(user: User, password: string): Promise<void> {
    if (
      !user.passwordHash ||
      !(await bcrypt.compare(password, user.passwordHash))
    ) {
      throw new UnauthorizedException("Incorrect password");
    }

    await this.usersService.update(user.id, {
      name: "Deleted user",
      email: `deleted-${randomUUID()}@deleted.liberia360.invalid`,
      passwordHash: null,
      phone: null,
      homeCountyId: null,
      travelerType: null,
      interests: [],
      isAdmin: false,
      isSuperAdmin: false,
      twoFactorEnabled: false,
      twoFactorSecret: null,
      twoFactorRecoveryCodes: null,
      emailVerified: false,
      emailVerificationTokenHash: null,
      emailVerificationTokenExpiresAt: null,
      passwordResetTokenHash: null,
      passwordResetTokenExpiresAt: null,
      tokenVersion: user.tokenVersion + 1,
      deletedAt: new Date(),
    });
  }

  async login(dto: LoginDto): Promise<AuthResult | TwoFactorRequiredResult> {
    const user = await this.usersService.findByEmail(dto.email);
    if (!user || !user.passwordHash) {
      throw new UnauthorizedException("Invalid email or password");
    }

    const passwordMatches = await bcrypt.compare(
      dto.password,
      user.passwordHash,
    );
    if (!passwordMatches) {
      throw new UnauthorizedException("Invalid email or password");
    }

    if (user.twoFactorEnabled) {
      const payload: TwoFactorPendingPayload = {
        sub: user.id,
        purpose: "2fa-pending",
      };
      return {
        twoFactorRequired: true,
        pendingToken: this.jwtService.sign(payload, {
          expiresIn: PENDING_TOKEN_TTL,
        }),
      };
    }

    return this.buildAuthResult(user);
  }

  /** POST /auth/2fa/setup — generates (but does not yet enable) a TOTP
   * secret, and a QR code for scanning it into an authenticator app.
   * Re-running this before /enable simply replaces the pending secret. */
  async setupTwoFactor(user: User): Promise<TwoFactorSetupResult> {
    const secret = authenticator.generateSecret();
    const encryptionKey = this.configService.get("twoFactor", {
      infer: true,
    }).encryptionKey;

    await this.usersService.update(user.id, {
      twoFactorSecret: encryptSecret(secret, encryptionKey),
    });

    const otpauthUri = authenticator.keyuri(user.email, TOTP_ISSUER, secret);
    const qrCodeDataUrl = await QRCode.toDataURL(otpauthUri);

    return { secret, qrCodeDataUrl };
  }

  /** POST /auth/2fa/enable — confirms setup with a real code from the app,
   * then turns 2FA on and hands back one-time recovery codes (shown once,
   * only bcrypt hashes are ever persisted). */
  async enableTwoFactor(user: User, code: string): Promise<string[]> {
    if (!user.twoFactorSecret) {
      throw new UnauthorizedException("Call /auth/2fa/setup first");
    }

    const encryptionKey = this.configService.get("twoFactor", {
      infer: true,
    }).encryptionKey;
    const secret = decryptSecret(user.twoFactorSecret, encryptionKey);

    if (!authenticator.verify({ token: code, secret })) {
      throw new UnauthorizedException("Invalid authenticator code");
    }

    const recoveryCodes = generateRecoveryCodes();
    const hashedRecoveryCodes = await Promise.all(
      recoveryCodes.map((c) => bcrypt.hash(c, BCRYPT_ROUNDS)),
    );

    await this.usersService.update(user.id, {
      twoFactorEnabled: true,
      twoFactorRecoveryCodes: hashedRecoveryCodes,
    });

    return recoveryCodes;
  }

  /** POST /auth/2fa/disable — requires the password again so an
   * already-open session can't turn 2FA off on its own. */
  async disableTwoFactor(user: User, password: string): Promise<void> {
    if (
      !user.passwordHash ||
      !(await bcrypt.compare(password, user.passwordHash))
    ) {
      throw new UnauthorizedException("Incorrect password");
    }

    await this.usersService.update(user.id, {
      twoFactorEnabled: false,
      twoFactorSecret: null,
      twoFactorRecoveryCodes: null,
    });
  }

  /** POST /auth/2fa/verify — login step 2. Exchanges a pendingToken from
   * step 1 plus a TOTP or recovery code for a real accessToken. */
  async verifyTwoFactor(dto: VerifyTwoFactorDto): Promise<AuthResult> {
    const payload = this.decodePendingToken(dto.pendingToken);
    const user = await this.usersService.findById(payload.sub);
    if (!user || !user.twoFactorEnabled || !user.twoFactorSecret) {
      throw new UnauthorizedException(
        "Two-factor authentication is not enabled",
      );
    }

    const encryptionKey = this.configService.get("twoFactor", {
      infer: true,
    }).encryptionKey;
    const secret = decryptSecret(user.twoFactorSecret, encryptionKey);

    if (authenticator.verify({ token: dto.code, secret })) {
      return this.buildAuthResult(user);
    }

    const usedRecoveryCode = await this.consumeRecoveryCode(user, dto.code);
    if (usedRecoveryCode) {
      return this.buildAuthResult(user);
    }

    throw new UnauthorizedException("Invalid or expired code");
  }

  private decodePendingToken(token: string): TwoFactorPendingPayload {
    let payload: TwoFactorPendingPayload;
    try {
      payload = this.jwtService.verify<TwoFactorPendingPayload>(token);
    } catch {
      throw new UnauthorizedException(
        "Login session expired, please sign in again",
      );
    }
    if (payload.purpose !== "2fa-pending") {
      throw new UnauthorizedException("Invalid token");
    }
    return payload;
  }

  /** Checks `code` against the user's unused recovery codes and, on a
   * match, removes that one (one-time use) — returns whether it matched. */
  private async consumeRecoveryCode(
    user: User,
    code: string,
  ): Promise<boolean> {
    const hashes = user.twoFactorRecoveryCodes ?? [];
    const normalized = code.trim().toLowerCase();

    for (let i = 0; i < hashes.length; i++) {
      if (await bcrypt.compare(normalized, hashes[i])) {
        const remaining = [...hashes.slice(0, i), ...hashes.slice(i + 1)];
        await this.usersService.update(user.id, {
          twoFactorRecoveryCodes: remaining,
        });
        return true;
      }
    }
    return false;
  }

  private buildAuthResult(user: User): AuthResult {
    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      tokenVersion: user.tokenVersion,
    };
    return {
      accessToken: this.jwtService.sign(payload),
      user: toPublicUser(user),
    };
  }

  /** Shared lookup for both the email-verification and password-reset
   * tokens: find the user whose stored hash exactly matches the incoming
   * token's hash (see token-hash.ts — SHA-256, not bcrypt, specifically so
   * this can be an equality lookup instead of comparing against every
   * user's hash one at a time), then confirm it hasn't expired. */
  private async findByValidToken(
    token: string,
    hashColumn: "emailVerificationTokenHash" | "passwordResetTokenHash",
    expiryColumn:
      "emailVerificationTokenExpiresAt" | "passwordResetTokenExpiresAt",
  ): Promise<User | null> {
    const tokenHash = hashToken(token);
    const user = await this.usersService.findByTokenHash(hashColumn, tokenHash);
    if (!user) {
      return null;
    }
    const storedHash = user[hashColumn];
    const expiresAt = user[expiryColumn];
    if (
      !storedHash ||
      !expiresAt ||
      expiresAt.getTime() < Date.now() ||
      !hashesMatch(storedHash, tokenHash)
    ) {
      return null;
    }
    return user;
  }

  private verifyEmailUrl(token: string): string {
    const webAppUrl = this.configService.get("webAppUrl", { infer: true });
    return `${webAppUrl}/verify-email?token=${token}`;
  }

  private resetPasswordUrl(token: string): string {
    const webAppUrl = this.configService.get("webAppUrl", { infer: true });
    return `${webAppUrl}/reset-password?token=${token}`;
  }
}
