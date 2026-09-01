import { Type } from "class-transformer";
import { IsInt, IsOptional, IsUUID, Max, Min } from "class-validator";

/** GET /itineraries/public — the "Trips You Can Join" discovery list.
 * `destinationPlaceId` is already wired up (not yet surfaced anywhere in
 * the UI) so a destination page can later ask for "upcoming community
 * trips to here" with no backend work — see the trip-social-features
 * README note on what's queued for the next phase. */
export class QueryPublicTripsDto {
  @IsOptional()
  @IsUUID()
  destinationPlaceId?: string;

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
