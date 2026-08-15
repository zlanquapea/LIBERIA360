import { IsString, MinLength } from "class-validator";

// Requires the password again — an already-open session/browser tab
// shouldn't be enough on its own to turn 2FA off.
export class DisableTwoFactorDto {
  @IsString()
  @MinLength(1)
  password: string;
}
