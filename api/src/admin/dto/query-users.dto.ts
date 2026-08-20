import { Type } from "class-transformer";
import {
  IsBooleanString,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
} from "class-validator";
import { TravelerType } from "../../users/entities/user.enums";

const TRAVELER_TYPES = Object.values(TravelerType);

export class QueryUsersDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;

  // Matched against name/email, case-insensitive — the two things an
  // admin actually has on hand when looking someone up, same as
  // AdminTeamService.search's exact-email lookup but fuzzy and over
  // everyone, not just existing team members.
  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsIn(TRAVELER_TYPES)
  travelerType?: TravelerType;

  // Left as a string, not coerced to boolean: this is a tri-state filter
  // (admins only / non-admins only / no filter), and undefined has to
  // stay undefined for "no filter" rather than collapsing to false the
  // way a naive `value === "true"` transform would — the service checks
  // `=== "true"` / `=== "false"` explicitly.
  @IsOptional()
  @IsBooleanString()
  isAdmin?: string;
}
