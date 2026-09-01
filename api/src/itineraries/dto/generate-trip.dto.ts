import {
  ArrayMaxSize,
  IsArray,
  IsDateString,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from "class-validator";
import { BudgetBand, TripVisibility } from "../entities/itinerary.enums";

/** "Plan a Trip" (Tech Spec §4.3, redesigned per the Sept 2026 product
 * note — "add a start date and end date," "the user should have
 * control"): a trip is framed by a real date range instead of a bare day
 * count, and no route is auto-generated from it (see
 * ItinerariesService.generateTrip's doc comment) — the day count everyone
 * else in this app reads off the trip (durationDays) is derived from
 * startDate/endDate rather than accepted as a separate field that could
 * drift out of sync with them. */
export class GenerateTripDto {
  @IsDateString()
  startDate: string;

  @IsDateString()
  endDate: string;

  @IsArray()
  @ArrayMaxSize(10)
  @IsString({ each: true })
  interests: string[]; // category slugs — recorded, no longer used to pick stops

  @IsEnum(BudgetBand)
  budgetBand: BudgetBand;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  title?: string;

  // The fields below are all optional here — a guest previewing a trip
  // (POST /itineraries/preview, which uses this same DTO) shouldn't have
  // to pick a destination or decide public/private just to see what
  // they're about to create. CreateTripDto (the real save endpoint)
  // requires title/destinationPlaceId/visibility by overriding these three.
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
}
