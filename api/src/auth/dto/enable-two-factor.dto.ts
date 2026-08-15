import { IsString, Length } from "class-validator";

// Confirms POST /auth/2fa/setup by proving the app was scanned correctly —
// enabling only happens once this 6-digit code checks out.
export class EnableTwoFactorDto {
  @IsString()
  @Length(6, 6)
  code: string;
}
