import {
  ArrayMaxSize,
  IsArray,
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
} from "class-validator";
import {
  BudgetBand,
  TransportMode,
  TripPace,
} from "../entities/itinerary.enums";

/** PATCH /itineraries/:id/details — the practical planning inputs. Dates
 * stay as set at creation: changing them changes the trip's length,
 * which would strand stops on days that no longer exist. A null clears
 * a field. */
export class UpdateTripDetailsDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  startingLocation?: string | null;

  @IsOptional()
  @IsEnum(TransportMode)
  transportMode?: TransportMode | null;

  @IsOptional()
  @IsEnum(TripPace)
  pace?: TripPace | null;

  @IsOptional()
  @IsEnum(BudgetBand)
  budgetBand?: BudgetBand;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(12)
  @IsString({ each: true })
  @MaxLength(40, { each: true })
  interests?: string[];

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string | null;
}
