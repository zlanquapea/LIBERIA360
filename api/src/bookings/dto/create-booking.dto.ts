import {
  IsDateString,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from "class-validator";

// Exactly one of businessId/creatorId — enforced in BookingsService.create.
export class CreateBookingDto {
  @IsOptional()
  @IsUUID()
  businessId?: string;

  @IsOptional()
  @IsUUID()
  creatorId?: string;

  @IsDateString()
  requestedDate: string;

  // For a multi-night hotel stay; omit for a single-date booking.
  @IsOptional()
  @IsDateString()
  requestedEndDate?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(50)
  partySize?: number;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;
}
