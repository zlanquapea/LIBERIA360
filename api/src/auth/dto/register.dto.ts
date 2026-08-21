import {
  ArrayMaxSize,
  IsArray,
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  MaxLength,
  MinLength,
} from "class-validator";
import { TravelerType } from "../../users/entities/user.enums";

export class RegisterDto {
  @IsString()
  @MinLength(1)
  @MaxLength(150)
  name: string;

  @IsEmail()
  email: string;

  @IsString()
  @MinLength(8, { message: "Password must be at least 8 characters" })
  @MaxLength(72) // bcrypt silently truncates beyond 72 bytes — reject longer up front
  password: string;

  @IsOptional()
  @IsUUID()
  homeCountyId?: string;

  @IsOptional()
  @IsEnum(TravelerType)
  travelerType?: TravelerType;

  // Category slugs — not validated against the categories table here (same
  // as GenerateTripDto's interests) since a stale slug is harmless: it
  // just never matches anything and quietly contributes nothing.
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @IsString({ each: true })
  interests?: string[];

  // Carried through from an invite link (Section 3: "Invitation → Create
  // Account → Confirm Account → Accept Invitation → Join Trip") so the
  // new account gets linked to the pending trip invitation automatically
  // — see ItinerariesService.linkInvitationToNewAccount. Optional and
  // never validated against anything here: an unknown/stale/already-used
  // token just silently fails to link (registration must never fail
  // because of it), exactly like the token-hash lookup it feeds.
  @IsOptional()
  @IsString()
  @Length(64, 64)
  inviteToken?: string;
}
