import {
  ArrayMaxSize,
  IsArray,
  IsDateString,
  IsEnum,
  IsInt,
  IsLatitude,
  IsLongitude,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from "class-validator";
import { BudgetBand, TripVisibility } from "../entities/itinerary.enums";

/** "Build My Liberia Trip" (Tech Spec §4.3): trip length + interests +
 * budget + (optionally) a starting location. */
export class GenerateTripDto {
  @IsInt()
  @Min(1)
  @Max(14)
  durationDays: number;

  @IsOptional()
  @IsDateString()
  startDate?: string; // stored for context; doesn't affect place selection

  @IsArray()
  @ArrayMaxSize(10)
  @IsString({ each: true })
  interests: string[]; // category slugs

  @IsEnum(BudgetBand)
  budgetBand: BudgetBand;

  // Product review readout (Aug 25, 2026): "Allow users to enter their
  // budget, number of days, interests and starting location." Optional —
  // ItinerariesService falls back to the Monrovia center when omitted,
  // same as before this existed. Must be supplied together (see
  // ItinerariesService.resolveStart); a request with only one of the two
  // is rejected rather than silently ignored.
  @IsOptional()
  @IsLatitude()
  startLat?: number;

  @IsOptional()
  @IsLongitude()
  startLng?: number;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  title?: string;

  // The fields below are all optional here — a guest previewing a route
  // (POST /itineraries/preview, which uses this same DTO) shouldn't have
  // to pick a destination or decide public/private just to see a
  // generated itinerary. CreateTripDto (the real save endpoint) requires
  // title/destinationPlaceId/visibility by overriding these three.
  @IsOptional()
  @IsUUID()
  destinationPlaceId?: string;

  @IsOptional()
  @IsEnum(TripVisibility)
  visibility?: TripVisibility;

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  description?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  coverImage?: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;
}
