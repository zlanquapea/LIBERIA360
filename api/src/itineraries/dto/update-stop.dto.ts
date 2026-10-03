import {
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from "class-validator";

export class UpdateStopDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string | null;

  // Moves the stop to a different day of the trip — the only way to
  // reorganize an itinerary besides removing and re-adding a stop.
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(30)
  day?: number;

  // 0-based position within the stop's (new) day. Omitted keeps the
  // current position, or the end of the day after a move.
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  position?: number;
}
