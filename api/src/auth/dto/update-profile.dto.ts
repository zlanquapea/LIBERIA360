import {
  ArrayMaxSize,
  IsArray,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
} from "class-validator";
import { TravelerType } from "../../users/entities/user.enums";

// The traveler-type/interests fields register.dto.ts captures at signup
// weren't previously editable afterward — nor was homeCountyId, actually
// (Phase 2 had no profile-update endpoint at all). This backs
// `PATCH /auth/me`, the first way to fix any of it post-signup.
export class UpdateProfileDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(150)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  phone?: string;

  @IsOptional()
  @IsUUID()
  homeCountyId?: string;

  @IsOptional()
  @IsEnum(TravelerType)
  travelerType?: TravelerType;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @IsString({ each: true })
  interests?: string[];
}
