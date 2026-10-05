import { Transform, Type } from "class-transformer";
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from "class-validator";

/** GET /itineraries/public — the "Trips You Can Join" discovery list.
 * `destinationPlaceId` is already wired up (not yet surfaced anywhere in
 * the UI) so a destination page can later ask for "upcoming community
 * trips to here" with no backend work — see the trip-social-features
 * README note on what's queued for the next phase. */
export class QueryPublicTripsDto {
  @IsOptional()
  @IsUUID()
  destinationPlaceId?: string;

  /** Only organised trips people book spots on. */
  @IsOptional()
  @Transform(({ value }) => value === true || value === "true")
  @IsBoolean()
  hosted?: boolean;

  /** Organised trips that are free, or that cost something. */
  @IsOptional()
  @IsIn(["free", "paid"])
  price?: "free" | "paid";

  /** A county slug — trips heading there. */
  @IsOptional()
  @IsString()
  @MaxLength(80)
  county?: string;

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
