import {
  ArrayMaxSize,
  IsArray,
  IsDateString,
  IsEnum,
  IsInt,
  IsLatitude,
  IsLongitude,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from "class-validator";
import { BudgetBand, TripVisibility } from "../entities/itinerary.enums";

/** POST /itineraries — the real "create a trip" endpoint, as opposed to
 * POST /itineraries/preview (GenerateTripDto), which needs nothing beyond
 * duration/interests/budget since nothing is saved there. A full separate
 * class rather than extending GenerateTripDto — decorator metadata
 * doesn't cleanly "narrow from optional to required" across a subclass
 * (class-validator combines a property's decorators up the whole
 * prototype chain, so a parent's @IsOptional() would keep applying here
 * too), and this codebase's own convention is already separate sibling
 * DTOs for overlapping-but-different-requirements shapes (see
 * CreatePlaceSubmissionDto vs UpdateMyPlaceDto, CreateEventDto vs
 * UpdateEventDto).
 *
 * Product spec (Aug 2026): "Every trip must have a name before it can be
 * created," "the destination field should use locations already in the
 * system," "the user should clearly choose Public or Private" — so
 * title/destinationPlaceId/visibility are required here, unlike on
 * GenerateTripDto.
 */
export class CreateTripDto {
  @IsInt()
  @Min(1)
  @Max(14)
  durationDays: number;

  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;

  @IsArray()
  @ArrayMaxSize(10)
  @IsString({ each: true })
  interests: string[];

  @IsEnum(BudgetBand)
  budgetBand: BudgetBand;

  @IsOptional()
  @IsLatitude()
  startLat?: number;

  @IsOptional()
  @IsLongitude()
  startLng?: number;

  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  title: string;

  @IsUUID()
  destinationPlaceId: string;

  @IsEnum(TripVisibility)
  visibility: TripVisibility;

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  description?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  coverImage?: string;
}
