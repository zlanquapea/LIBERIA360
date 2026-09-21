import {
  ArrayMaxSize,
  IsArray,
  IsDateString,
  IsEnum,
  IsInt,
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
 * dates/interests/budget since nothing is saved there. A full separate
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
 * created," "the user should clearly choose Public or Private" — so
 * title/visibility are required here, unlike on GenerateTripDto.
 * destinationPlaceId used to be required too ("the destination field
 * should use locations already in the system") but that turned into
 * paperwork ahead of the actual planning (Sep 2026 UX pass) — it's now
 * optional here as well, same as on GenerateTripDto.
 */
export class CreateTripDto {
  @IsDateString()
  startDate: string;

  @IsDateString()
  endDate: string;

  @IsArray()
  @ArrayMaxSize(10)
  @IsString({ each: true })
  interests: string[];

  @IsEnum(BudgetBand)
  budgetBand: BudgetBand;

  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  title: string;

  @IsOptional()
  @IsUUID()
  destinationPlaceId?: string;

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

  // Simple traveler headcount — see Itinerary.partySize's doc comment.
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(50)
  partySize?: number;

  // Only meaningful when visibility is PUBLIC — see
  // Itinerary.maxParticipants's doc comment.
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(50)
  maxParticipants?: number;
}
