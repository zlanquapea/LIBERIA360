import {
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from "class-validator";

export class AddStopDto {
  @IsUUID()
  placeId: string;

  @IsInt()
  @Min(1)
  @Max(30)
  day: number;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}
