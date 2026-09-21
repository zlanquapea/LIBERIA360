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
}
