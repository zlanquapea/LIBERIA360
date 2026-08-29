import {
  IsBoolean,
  IsDateString,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from "class-validator";

// Exactly one of businessId/creatorId/carListingId — enforced in
// BookingsService.create.
export class CreateBookingDto {
  @IsOptional()
  @IsUUID()
  businessId?: string;

  @IsOptional()
  @IsUUID()
  creatorId?: string;

  @IsOptional()
  @IsUUID()
  carListingId?: string;

  @IsDateString()
  requestedDate: string;

  // For a multi-night hotel stay, or a car rental's return date (required
  // for a car-listing booking — enforced in BookingsService.create, not
  // here, since it's optional for every other target).
  @IsOptional()
  @IsDateString()
  requestedEndDate?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(50)
  partySize?: number;

  // Car-listing bookings only — see Booking.withDriver/pickupLocation's
  // doc comment. Ignored for a business/creator target.
  @IsOptional()
  @IsBoolean()
  withDriver?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  pickupLocation?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;
}
