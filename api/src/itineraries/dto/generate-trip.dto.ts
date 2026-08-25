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
  Max,
  MaxLength,
  Min,
} from "class-validator";
import { BudgetBand } from "../entities/itinerary.enums";

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
}
