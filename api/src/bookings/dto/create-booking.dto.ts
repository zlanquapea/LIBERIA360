import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
} from "class-validator";
import { BookingRentalUnit } from "../entities/booking.enums";

const TIME_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/;

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

  // Car-listing bookings only, and only for a listing with pricePerHour
  // set. Omit (or DAY) to keep booking by day; HOUR requires both time
  // fields below and is validated against the same calendar day as
  // requestedDate — see BookingsService.create.
  @IsOptional()
  @IsEnum(BookingRentalUnit)
  rentalUnit?: BookingRentalUnit;

  @IsOptional()
  @IsString()
  @Matches(TIME_PATTERN, { message: "requestedStartTime must be HH:mm" })
  requestedStartTime?: string;

  @IsOptional()
  @IsString()
  @Matches(TIME_PATTERN, { message: "requestedEndTime must be HH:mm" })
  requestedEndTime?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  pickupLocation?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;
}
