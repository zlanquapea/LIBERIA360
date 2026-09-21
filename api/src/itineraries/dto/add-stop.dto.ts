import {
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from "class-validator";

// Exactly one of placeId/eventId/carListingId — enforced in
// ItinerariesService.addStop rather than a class-validator decorator here,
// same as Booking's own business/creator/carListing XOR (see
// BookingsService.create) — a cross-field "exactly one" rule reads more
// clearly as a service-level check with a specific error message per case
// than as a generic decorator.
export class AddStopDto {
  @IsOptional()
  @IsUUID()
  placeId?: string;

  @IsOptional()
  @IsUUID()
  eventId?: string;

  @IsOptional()
  @IsUUID()
  carListingId?: string;

  @IsInt()
  @Min(1)
  @Max(30)
  day: number;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}
