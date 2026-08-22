import { Transform, Type } from "class-transformer";
import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
} from "class-validator";
import { EventCategory } from "../entities/event.enums";

export class QueryEventsDto {
  @IsOptional()
  @IsEnum(EventCategory)
  category?: EventCategory;

  @IsOptional()
  @IsString()
  county?: string; // county slug, consistent with GET /places?county=

  @IsOptional()
  @IsDateString()
  dateFrom?: string;

  @IsOptional()
  @IsDateString()
  dateTo?: string;

  // Public browsing (the /events page) always wants "what's upcoming" —
  // findAll defaults to hiding anything whose startDate has already
  // passed unless this is set or dateFrom is given explicitly. Admin's
  // events management table sets this so a past event is still there to
  // edit or remove, not just newly-created ones.
  //
  // A plain `@Type(() => Boolean)` would coerce the *string* "false" to
  // `true` (any non-empty string is truthy) since query params always
  // arrive as strings — see QueryLoginActivityDto's onlyFailed for the
  // same fix.
  @IsOptional()
  @Transform(({ value }) => value === "true" || value === true)
  @IsBoolean()
  includePast?: boolean;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number = 20;
}
