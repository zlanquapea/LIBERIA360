import { IsString, MaxLength, MinLength } from "class-validator";

// Login step 2, once step 1 (POST /auth/login) has returned a pendingToken
// because the account has 2FA enabled. `code` accepts either a 6-digit
// authenticator code or an XXXXX-XXXXX recovery code — AuthService tries
// the TOTP check first, then falls back to recovery codes.
export class VerifyTwoFactorDto {
  @IsString()
  pendingToken: string;

  @IsString()
  @MinLength(6)
  @MaxLength(20)
  code: string;
}
